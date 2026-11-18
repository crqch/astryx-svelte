/** NO-UPSTREAM: coverage beyond upstream — the header below says why. */

/**
 * Coverage with **no upstream analogue**: `@astryxdesign/core` ships prebuilt
 * CSS and has no Vite preset to test. This one exists because the two settings
 * it injects are the port's worst failure mode — both fail *silently*, and a
 * preset that quietly stopped emitting one would reintroduce exactly the bug it
 * was written to remove, with no error anywhere to say so.
 *
 * So the cases are about the seam, not the compiler: that the preset returns
 * the StyleX plugin, that its `config()` hook names this package in **both**
 * `optimizeDeps.exclude` and `ssr.noExternal`, and that a consumer's extra
 * packages survive into both.
 *
 * The shake companion is the same kind of seam: without it the compiler emits
 * every transformed module's rules after tree-shaking, so every consumer ships
 * the whole sheet again — with no error anywhere to say so. Its cases assert it
 * runs after the compiler's emit and drops exactly the atomic rules nothing
 * references, closing over the companions and keyframes the kept rules need.
 *
 * Imported through `$lib/…` as the rule requires.
 */

import { describe, expect, it } from 'vitest';

import { astryx } from '$lib/vite.js';

/** The preset returns a nested plugin array; find the config-injecting half. */
function configOf(plugins: unknown) {
	const flat = (Array.isArray(plugins) ? plugins : [plugins]).flat(Infinity) as Array<{
		name?: string;
		config?: () => unknown;
	}>;
	const seam = flat.find((p) => p?.name === 'astryx-svelte:keep-stylex-on-the-transform-path');
	return seam?.config?.() as
		| { optimizeDeps?: { exclude?: string[] }; ssr?: { noExternal?: string[] } }
		| undefined;
}

/** The shake companion and the compiler whose emit it filters. */
function shakeSeam(plugins: unknown) {
	const flat = (Array.isArray(plugins) ? plugins : [plugins]).flat(Infinity) as Array<{
		name?: string;
		enforce?: string;
		generateBundle?: (this: unknown, options: unknown, bundle: unknown) => void;
	}>;
	return {
		flat,
		shake: flat.find((p) => p?.name === 'astryx-svelte:tree-shake-collected-css'),
		compiler: flat.find((p) => p?.enforce === 'pre' && typeof p?.generateBundle === 'function')
	};
}

/** A processed-style sheet: atomic layers, companions, keyframes, and app CSS. */
const SHAKE_CSS = [
	'@layer astryx-base.priority1 {',
	'  .xkeep123 { margin: var(--xcomp123); font-weight: var(--font-weight-semibold);',
	'    color: var(--color-missing, red); animation: xspin123- .3s linear; }',
	'  .xkeep123:where([dir=rtl]) { animation-name: xspin123-B; }',
	'  .xdrop123 { margin: 0; }',
	'  .xtoken123 { --font-weight-semibold: 600; }',
	'  .xdecl123 { --color-missing: blue; }',
	'  :root { --xcomp123: 4px; }',
	'  @keyframes xspin123- { from { opacity: 0; } }',
	'  @keyframes xspin123-B { from { opacity: 1; } }',
	'  @keyframes xother123- { from { opacity: 1; } }',
	'}',
	'@layer astryx-base.priority9 { .xdrop123 { padding: 0; } }',
	'@layer app { .plain { color: red; } }',
	':root { --color-surface: #fff; }'
].join('\n');

/** Runs the companion over a fake bundle; the stub keeps the asset fileName. */
function runShake(bundle: Record<string, unknown>) {
	const { shake } = shakeSeam(astryx());
	if (!shake?.generateBundle) throw new Error('preset lost its shake seam');
	const ctx = { emitFile: () => 'ref', getFileName: () => 'assets/index.css' };
	shake.generateBundle.call(ctx, {}, bundle);
	return (bundle['assets/index.css'] as { source: string }).source;
}

const cssBundle = (code: string, html?: string) => ({
	'index.js': { type: 'chunk', code },
	'assets/index.css': { type: 'asset', fileName: 'assets/index.css', source: SHAKE_CSS },
	...(html ? { 'index.html': { type: 'asset', fileName: 'index.html', source: html } } : {})
});

describe('astryx() vite preset', () => {
	it('returns the StyleX plugin alongside the config seam', () => {
		const plugins = (astryx() as unknown[]).flat(Infinity) as Array<{ name?: string }>;
		// The unplugin factory names itself; assert something StyleX-ish is present
		// rather than pinning its exact plugin name, which is not our contract.
		expect(plugins.length).toBeGreaterThan(1);
		expect(plugins.some((p) => p?.name === 'astryx-svelte:keep-stylex-on-the-transform-path')).toBe(
			true
		);
	});

	it('excludes core from the dev pre-bundler', () => {
		expect(configOf(astryx())?.optimizeDeps?.exclude).toContain('@astryx-sv/core');
	});

	it('keeps core internal to the SSR build', () => {
		expect(configOf(astryx())?.ssr?.noExternal).toContain('@astryx-sv/core');
	});

	it('carries a consumer package into both settings, not just one', () => {
		// The asymmetric case is the dangerous one: a package handled in dev and
		// externalised on the server renders styled locally and unstyled in
		// production, which is the hardest version of this bug to diagnose.
		const config = configOf(astryx({ include: ['@acme/design'] }));
		expect(config?.optimizeDeps?.exclude).toContain('@acme/design');
		expect(config?.ssr?.noExternal).toContain('@acme/design');
	});

	it('does not duplicate core when a consumer names it too', () => {
		const config = configOf(astryx({ include: ['@astryx-sv/core'] }));
		expect(config?.optimizeDeps?.exclude).toEqual(['@astryx-sv/core']);
	});

	it('drops atomic rules no chunk references, and the wrappers they empty', () => {
		const out = runShake(cssBundle('const c = "xkeep123";'));
		expect(out).toContain('.xkeep123');
		expect(out).not.toContain('.xdrop123');
		expect(out).not.toContain('priority9');
		expect(out).not.toContain('xother123-');
	});

	it('closes over the companions and keyframes the kept rules need', () => {
		// A companion's declaring module shakes away with its JS, but the kept rule
		// still reads var(--x…); dropping the declaration silently unstyles it. The
		// definer may sit under an atomic class (token defaults) or under :root, and
		// keyframes carry RTL -B variants the closure must reach too.
		const out = runShake(cssBundle('const c = "xkeep123";'));
		expect(out).toContain('--xcomp123: 4px');
		expect(out).toContain('--font-weight-semibold: 600');
		expect(out).toContain('@keyframes xspin123-');
		expect(out).toContain('@keyframes xspin123-B');
		// A read with a fallback resolves itself: its definer stays dropped.
		expect(out).not.toContain('.xdecl123');
	});

	it('keeps app CSS and semantic :root byte for byte', () => {
		const out = runShake(cssBundle('const c = "xkeep123";'));
		expect(out).toContain('@layer app { .plain { color: red; } }');
		expect(out).toContain(':root { --color-surface: #fff; }');
		// Nothing atomic referenced: the sheet is left exactly as emitted.
		expect(runShake(cssBundle('const c = 1;'))).toBe(SHAKE_CSS);
	});

	it('reads class names out of prerendered markup too', () => {
		const out = runShake(cssBundle('const c = 1;', '<div class="xkeep123"></div>'));
		expect(out).toContain('.xkeep123');
		expect(out).not.toContain('.xdrop123');
	});

	it('runs after the compiler emit, in a later enforce band', () => {
		// Vite runs `pre` generateBundle hooks before `post` ones; the shake filters
		// the sheet the compiler appended, so it must land in the later band.
		const { shake, compiler } = shakeSeam(astryx());
		if (!shake || !compiler) throw new Error('preset lost its shake seam');
		expect(compiler.enforce).toBe('pre');
		expect(shake.enforce).toBe('post');
	});
});
