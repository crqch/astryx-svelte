/**
 * @file vite.ts
 *
 * The Vite preset — one import that replaces the three-part StyleX setup every
 * consumer of this package would otherwise copy by hand.
 *
 * ```ts
 * // vite.config.ts
 * import { astryx } from '@astryx-sv/core/vite';
 * import { sveltekit } from '@sveltejs/kit/vite';
 *
 * export default defineConfig({ plugins: [astryx(), sveltekit()] });
 * ```
 *
 * **Why this exists at all**, since it has no upstream counterpart:
 * `@astryxdesign/core` is built with Babel and ships prebuilt CSS, so its
 * consumers import a stylesheet and are done. This package is built by
 * `svelte-package`, which transpiles TypeScript and does not run StyleX, so
 * `dist/**\/*.stylex.js` publishes **uncompiled** and every consumer runs the
 * compiler themselves. Three things have to be true for that to work, and all
 * three fail *silently* — the components render, with correct markup and no
 * styling, and nothing throws.
 *
 * Hand-configuring them is the single most common way to get this wrong, and
 * the compiler options are worse than merely fiddly: they must match
 * `packages/core/vite.config.ts` **exactly**, or the atomic CSS a consumer
 * compiles differs from the output the class oracle verified against upstream.
 * A preset is the only form in which "exactly" is checkable.
 *
 * This is a deliberate addition to the published surface, like the
 * `liquid-glass` theme — it is build tooling required by the port's
 * distribution model, not invented component API.
 *
 * @input  the consumer's vite config
 * @output the StyleX plugin, plus the two settings that keep Vite from routing
 *         this package around it
 * @position `@astryx-sv/core/vite`
 */

import stylexPlugin from '@stylexjs/unplugin/vite';
import type { Plugin, PluginOption, Rollup } from 'vite';

// The package's `exports` map lists `types` after `import`, so TypeScript
// resolves the untyped `.mjs` and loses the call signature. The runtime export
// is a plugin factory; assert that shape. Same workaround as this package's own
// vite.config.ts and the docs site's.
const stylex = stylexPlugin as unknown as (options?: Record<string, unknown>) => PluginOption;

/** Packages whose `.stylex.js` modules must reach the compiler. */
const ASTRYX_PACKAGES = ['@astryx-sv/core'];

export interface AstryxViteOptions {
	/**
	 * Further packages that ship uncompiled `.stylex.js` and must be routed
	 * through the compiler — your own component library built on Astryx, for
	 * instance. `@astryx-sv/core` is always included.
	 */
	include?: string[];
	/**
	 * Root for StyleX's module resolution. Defaults to the process working
	 * directory, which is what a single-app project wants. A monorepo that
	 * imports `.stylex` modules across packages needs the workspace root
	 * instead, because StyleX resolves those paths relative to it.
	 */
	rootDir?: string;
	/**
	 * Defaults to `NODE_ENV !== 'production'`. Only override this if you are
	 * driving the build yourself and know `NODE_ENV` is wrong.
	 */
	dev?: boolean;
}

/**
 * Atomic StyleX class and keyframe names: `x` + a content hash. Keyframes carry
 * a `-` suffix, and their RTL variants a `-B` one; no trailing `\b`, which would
 * fail between the suffix's `-` and the following space and drop the suffix.
 */
const ATOMIC = /(?<![-\w])x[a-zA-Z0-9]{5,}(?:-[a-zA-Z0-9]*)?/g;
/** Companion custom properties StyleX extracts for cross-module consts. */
const COMPANION = /--x[-a-zA-Z0-9]{4,}/g;
/** A var() reference, capturing whether it carries a fallback. */
const VAR_REF = /var\(\s*(--[\w-]+)\s*(,)?/g;
/** Any custom property declaration. */
const DECLARES = /(--[\w-]+)\s*:/g;

/** A parsed CSS block: either a leaf rule or an at-rule with children. */
interface CssBlock {
	start: number;
	end: number;
	head: string;
	body: string;
	children: CssBlock[] | null;
}

/**
 * Splits CSS into blocks without interpreting it: braces inside strings are
 * skipped, at-rules without a block stay leaves. Enough structure to drop whole
 * rules and empty wrappers while leaving every other byte untouched.
 */
function parseCss(src: string, from = 0, to = src.length): CssBlock[] {
	const out: CssBlock[] = [];
	let i = from;
	let headStart = from;
	while (i < to) {
		const ch = src[i];
		if (ch === '"' || ch === "'") {
			const quote = ch;
			i++;
			while (i < to && src[i] !== quote) i += src[i] === '\\' ? 2 : 1;
			i++;
			continue;
		}
		if (ch === '{') {
			const head = src.slice(headStart, i).trim();
			let depth = 1;
			let j = i + 1;
			while (j < to && depth > 0) {
				const c = src[j];
				if (c === '"' || c === "'") {
					const quote = c;
					j++;
					while (j < to && src[j] !== quote) j += src[j] === '\\' ? 2 : 1;
				} else if (c === '{') depth++;
				else if (c === '}') depth--;
				j++;
			}
			const bodyStart = i + 1;
			const bodyEnd = j - 1;
			const nested = head.startsWith('@') && !/^@keyframes/i.test(head);
			out.push({
				start: headStart,
				end: j,
				head,
				body: src.slice(bodyStart, bodyEnd),
				children: nested ? parseCss(src, bodyStart, bodyEnd) : null
			});
			i = j;
			headStart = j;
			continue;
		}
		if (ch === ';') {
			const head = src.slice(headStart, i).trim();
			if (head) out.push({ start: headStart, end: i + 1, head, body: '', children: null });
			i++;
			headStart = i;
			continue;
		}
		i++;
	}
	return out;
}

/**
 * Ties the CSS StyleX collects to the classes the final bundle actually uses.
 *
 * The unplugin collects rules in `transform` — every module the bundler loads,
 * which for a barrel import is this whole package — and emits the merged set in
 * `generateBundle`, *after* tree-shaking has decided what survives. The JS shakes;
 * the CSS does not, so an app importing two components ships every component's
 * styles.
 *
 * This companion runs after that emit (`enforce: 'post'`) and drops the atomic
 * rules no chunk references, closed over what the kept rules themselves need:
 * compound-selector classes, keyframe names (including RTL `-B` variants), and
 * every custom property a kept rule reads without a fallback — companion
 * declarations (`--x…`) and token defaults alike, whose declaring rules live in
 * modules whose JS shook away, under an atomic class or under `:root`. It
 * filters the *processed* sheet, where every name is final — pruning the
 * collector's raw rules instead cannot work, because `processStylexRules`
 * inlines and renames cross-module references based on which rules it is given.
 * Non-atomic CSS in the same asset (resets, themes, semantic `:root`) is kept
 * byte for byte, as is every rule's text: this drops rules, never rewrites them.
 *
 * Dev serves the full sheet untouched — `generateBundle` never runs there.
 */
function treeShakeCollectedCss(): Plugin {
	return {
		name: 'astryx-svelte:tree-shake-collected-css',
		enforce: 'post',
		generateBundle(_options, bundle) {
			const needed = new Set<string>();
			for (const item of Object.values(bundle)) {
				if (item.type === 'chunk') {
					// Compiled stylex.props carries class names as string literals.
					for (const m of item.code.matchAll(
						/["'`](x[a-zA-Z0-9]{5,}(?:-[a-zA-Z0-9]*)?(?: x[a-zA-Z0-9]{5,}(?:-[a-zA-Z0-9]*)?)*)["'`]/g
					)) {
						for (const token of m[1].split(' ')) needed.add(token);
					}
				} else if (item.fileName.endsWith('.html') && typeof item.source === 'string') {
					// Prerendered markup carries them in class attributes.
					for (const m of item.source.matchAll(/class="([^"]+)"/g)) {
						for (const token of m[1].split(/\s+/)) {
							if (/^x[a-zA-Z0-9]{5,}(?:-[a-zA-Z0-9]*)?$/.test(token)) needed.add(token);
						}
					}
				}
			}
			if (needed.size === 0) return;
			for (const asset of Object.values(bundle)) {
				if (asset.type !== 'asset' || !asset.fileName.endsWith('.css')) continue;
				if (typeof asset.source !== 'string') continue;
				const next = shakeCss(asset.source, needed);
				if (next !== asset.source) replaceCssAsset(this, bundle, asset, next);
			}
		}
	};
}

/** Drops unreferenced atomic rules and the wrappers they empty; keeps everything else. */
function shakeCss(src: string, needed: Set<string>): string {
	const tree = parseCss(src);
	const leaves: CssBlock[] = [];
	const walk = (blocks: CssBlock[]) => {
		for (const block of blocks) {
			if (block.children) walk(block.children);
			else leaves.push(block);
		}
	};
	walk(tree);

	// Which leaves are shakeable at all: atomic selectors, atomic keyframes, and
	// companion declarations. Everything else (app CSS, semantic rules) is kept.
	const tokens = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[0]);
	const kind = (block: CssBlock): 'atomic' | 'keyframes' | 'root-comp' | 'keep' => {
		if (/^@keyframes/i.test(block.head)) return 'keyframes';
		if (tokens(block.head, ATOMIC).length > 0) return 'atomic';
		if (/^:root\b/.test(block.head) && tokens(block.body, COMPANION).length > 0) return 'root-comp';
		return 'keep';
	};
	// A var() read without a fallback must resolve inside the sheet; one with a
	// fallback resolves itself and must not drag its declarers into the closure.
	const refs = (text: string) => [...text.matchAll(VAR_REF)].filter((m) => !m[2]).map((m) => m[1]);
	// Group 1, not the whole match: DECLARES carries the colon in m[0].
	const declared = (text: string) => [...text.matchAll(DECLARES)].map((m) => m[1]);

	const shakeable = leaves.filter((leaf) => kind(leaf) !== 'keep');
	const kept = new Set<CssBlock>();
	const neededNames = new Set<string>();
	for (let grew = true; grew;) {
		grew = false;
		for (const leaf of shakeable) {
			if (kept.has(leaf)) continue;
			const hit =
				kind(leaf) === 'keyframes'
					? needed.has(leaf.head.replace(/^@keyframes\s+/i, '').trim())
					: tokens(leaf.head, ATOMIC).some((token) => needed.has(token)) ||
						declared(leaf.body).some((name) => neededNames.has(name));
			if (!hit) continue;
			kept.add(leaf);
			grew = true;
			for (const token of tokens(leaf.head + leaf.body, ATOMIC)) needed.add(token);
			for (const name of refs(leaf.body)) neededNames.add(name);
		}
	}

	// Drop dropped leaves, then any wrapper left without a kept descendant.
	const dropped: CssBlock[] = shakeable.filter((leaf) => !kept.has(leaf));
	const hasKept = (block: CssBlock): boolean =>
		block.children ? block.children.some(hasKept) : kept.has(block) || kind(block) === 'keep';
	const emptyWrappers = (blocks: CssBlock[]): CssBlock[] =>
		blocks.flatMap((block) =>
			block.children && !hasKept(block)
				? [block]
				: block.children
					? emptyWrappers(block.children)
					: []
		);
	// Maximal ranges only: a wrapper's range contains its leaves', and splicing
	// both would cut the second range out of already-shifted text.
	const sorted = [...dropped, ...emptyWrappers(tree)]
		.map((block) => [block.start, block.end] as const)
		.sort((a, b) => a[0] - b[0]);
	const maximal: Array<readonly [number, number]> = [];
	for (const range of sorted) {
		const last = maximal[maximal.length - 1];
		if (!last || range[0] >= last[1]) maximal.push(range);
	}
	let out = src;
	for (const [start, end] of maximal.reverse()) out = out.slice(0, start) + out.slice(end);
	return out;
}

/** Re-emits a CSS asset under a fresh content hash and repoints every reference. */
function replaceCssAsset(
	ctx: Rollup.PluginContext,
	bundle: Rollup.OutputBundle,
	asset: Rollup.OutputAsset,
	source: string
): void {
	const base = (asset.name ?? asset.fileName.replace(/^.*\//, '')).replace(
		/(-[a-z0-9]{8,})?\.css$/i,
		'.css'
	);
	const next = ctx.getFileName(ctx.emitFile({ type: 'asset', name: base, source }));
	const old = asset.fileName;
	if (!next || next === old) {
		asset.source = source;
		return;
	}
	for (const item of Object.values(bundle)) {
		if (item.type === 'chunk') {
			if (item.code.includes(old)) item.code = item.code.split(old).join(next);
			const imported = (item as { viteMetadata?: { importedCss?: Set<string> } }).viteMetadata
				?.importedCss;
			if (imported instanceof Set && imported.has(old)) {
				imported.delete(old);
				imported.add(next);
			}
		} else if (typeof item.source === 'string' && item.source.includes(old)) {
			item.source = item.source.split(old).join(next);
		}
	}
	delete bundle[old];
}

/**
 * The StyleX compiler wired the way this package's own build wires it, plus the
 * two escapes Vite would otherwise take and the prune that makes its CSS
 * tree-shake.
 *
 * Place it **before** `sveltekit()`, as this package's own config does.
 */
export function astryx(options: AstryxViteOptions = {}): PluginOption {
	const {
		include = [],
		rootDir = process.cwd(),
		dev = process.env.NODE_ENV !== 'production'
	} = options;

	const packages = [...new Set([...ASTRYX_PACKAGES, ...include])];

	// Options mirror packages/core/vite.config.ts, which in turn mirrors
	// Astryx's own Vite integration (@astryxdesign/build/vite) so the emitted
	// classes match theirs byte for byte. Changing one here without changing
	// it there is how a consumer ends up with CSS no oracle has ever checked.
	const compiler = stylex({
		dev,
		runtimeInjection: false,
		treeshakeCompensation: true,
		// `{prefix}` rather than `true`: StyleX splits its output into
		// `priority1…priorityN`, and layer order is order of *first appearance*,
		// so unprefixed they land wherever they happen to appear and invert the
		// cascade against `astryx-theme`. Prefixed, they are **sub-layers of
		// `astryx-base`** — the same layer the pre-built `astryx.css` wraps
		// everything in — so both ways of getting this package's CSS put it in
		// the same place, and `base.css` no longer has to name each bucket.
		// `useLayers: {prefix}` landed in StyleX 0.19; before it, naming the
		// buckets by hand was the only option.
		useCSSLayers: { prefix: 'astryx-base' },
		// Without explicit targets, lightningcss lowers `light-dark()` into
		// `var(--lightningcss-light, …) var(--lightningcss-dark, …)`, which
		// resolves to nothing and silently empties every colour token. These
		// are the first versions with native `light-dark()`, and are the
		// targets Astryx ships in @astryxdesign/build.
		lightningcssOptions: {
			targets: {
				chrome: 123 << 16,
				firefox: 120 << 16,
				safari: (17 << 16) | (5 << 8)
			}
		},
		unstable_moduleResolution: { type: 'commonJS', rootDir }
	});

	return [
		compiler,
		treeShakeCollectedCss(),
		{
			name: 'astryx-svelte:keep-stylex-on-the-transform-path',
			// Vite has **two** ways to route a dependency around its own plugin
			// pipeline, and each defeats the compiler on its own:
			//
			//  - the dev-time pre-bundler runs esbuild outside the pipeline, so a
			//    pre-bundled dependency never reaches the StyleX transform and its
			//    `stylex.create` calls survive into the browser as runtime no-ops;
			//  - the SSR build externalises `node_modules` by default, importing
			//    them from disk at runtime instead of transforming them.
			//
			// Returning partial config here merges with the user's own, so a
			// project that already lists other packages in either field keeps them.
			config: () => ({
				optimizeDeps: { exclude: packages },
				ssr: { noExternal: packages }
			})
		}
	];
}
