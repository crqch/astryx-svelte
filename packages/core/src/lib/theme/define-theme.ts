import { expandColorScale, type ColorScaleConfig } from './expand-color-scale.js';
import type { MotionScaleConfig } from './expand-motion-scale.js';
import {
	expandThemeMotion,
	MOTION_TEMPO_PROPERTY,
	preTempoName,
	type MotionCharacter,
	type ThemeMotionConfig,
	type ThemeMotionKnobs
} from './theme-motion.js';
import { expandRadiusScale, type RadiusScaleConfig } from './expand-radius-scale.js';
import {
	expandTypeScale,
	generateTextColorComponents,
	generateTypeScaleComponents,
	type TypeScaleConfig
} from './expand-type-scale.js';
import { resolveOnMedia, type OnMediaOverrides, type ResolvedOnMedia } from './on-media-tokens.js';
import { registerTheme } from './theme-registry.js';
import type { SyntaxThemeDefinition } from './syntax/define-syntax-theme.js';
import type { IconRegistry } from '../components/icon/icon-registry.js';
import type { IndicatorRegistry } from '../components/indicator/types.js';
import { deepMergeComponents } from './merge-components.js';
import type { FontWeight, TypographyConfig } from './types.js';

/**
 * Ported from Astryx's `src/theme/defineTheme.ts`, covering the surface the
 * shipped themes exercise.
 *
 * **Nothing is omitted from this shape any more.** Three fields were on a
 * "deferred because no shipped theme uses it" list and all three came off it,
 * none on the terms the list assumed. The **radius expander** went when the y2k
 * theme turned out to use it. The HCT-generative **`color`** field went when a
 * surface audit found `theme/index.ts` missing `expandColorScale` entirely.
 * **`extends`** was the last, and it was the worst of the three: the CLI's
 * shipped `theme.doc.mjs` had been documenting it — upstream's prose, carried
 * over verbatim — so it was not a quiet gap a consumer might never notice but a
 * documented feature that silently did nothing.
 *
 * The lesson those three earned together: "no shipped theme uses it" is a claim
 * about this repo's themes, and it says nothing about what the published surface
 * promises or what a consumer's theme will reach for.
 *
 * `color` had to arrive with all three of its pieces at once —
 * `expandColorScale`, its `hct` helpers and `contrast.ts` — but only
 * `contrast.ts` is genuinely new in upstream's 0.3.0. `expandColorScale` dates
 * to v0.0.13 (`ddc384c0d`) and `hct` likewise predates v0.2.0, so the expander
 * was an old gap that had *additionally* accumulated substantial 0.3.0 change.
 * Two things changed there. `accent` became optional: an accent-less config
 * seeds the neutral ramp from the default accent's hue (`#0064E0`) and leaves
 * `--color-accent`, `--color-accent-muted` and `--color-on-accent`
 * *ungenerated*, so they fall through to the token defaults. And
 * `--color-border-emphasized` is now tone-bumped until it clears 3:1 against
 * the generated surface (WCAG 1.4.11) — porting the expander without the
 * contrast half emits borders that fail it. **No oracle here would catch
 * that**: all five ported themes declare that token literally, so nothing this
 * repo builds passes through the generator at all.
 */

/** A token value: one string, or a [light, dark] pair compiled to light-dark(). */
export type TokenValue = string | readonly [light: string, dark: string];

/**
 * Upstream declares its flat `tokenDefaults` map here. Ours lives in
 * `./tokens.ts` instead, and the reason is structural rather than stylistic:
 * building it means importing `styles/tokens.stylex.ts`, and this package ships
 * its `.stylex.js` modules **uncompiled** for the consumer's StyleX plugin — so
 * a plain-Node importer of that module hits a runtime `stylex.defineVars` and
 * throws. This file is loaded under plain Node (the theme build reads
 * `generate-theme-rules.js`, which imports it), and must stay clear of StyleX.
 * Upstream has no such constraint: its published `dist/` is already compiled.
 */

export type TokenMap = Record<string, TokenValue>;

/**
 * One style key's declarations. A `:`-prefixed key holds a nested block applied
 * under that pseudo-class, so a theme can restyle an interaction state without
 * the component having to publish a custom property for it.
 */
export type StyleOverrides = Record<string, TokenValue | TokenMap>;

/** Component overrides, keyed by style key (see parseStyleKey). */
export type ComponentOverrides = Record<string, Record<string, StyleOverrides>>;

/**
 * SYNC: `ThemeConfig` is the theme surface. Adding, removing, or renaming a
 * field means updating:
 * - /packages/cli/assets/theme.template.ts (documents every field; the drift
 *   guard is packages/cli/scripts/check-theme-template.test.mjs)
 * - /packages/cli/assets/docs/theme.doc.mjs (`astryx-svelte docs theme`)
 */
/** Breakpoint names accepted by an adaptation's `when.width`. */
export type AdaptationBreakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/** One condition under which an adaptation's value applies. */
export interface AdaptationCondition {
	/** Pointer accuracy the device must report. */
	pointer?: 'coarse' | 'fine';
	/** Viewport width bound. */
	width?: {
		below?: AdaptationBreakpoint;
		above?: AdaptationBreakpoint;
	};
}

/** The overrides an adaptation applies when its condition matches. */
export interface AdaptationValue {
	typography?: TypographyConfig;
	/** Motion knobs or duration-scale fields, completed from the root motion axis. */
	motion?: Partial<MotionScaleConfig> & ThemeMotionKnobs;
	tokens?: TokenMap;
	components?: ComponentOverrides;
}

/** One adaptation rule: a media condition and the theme value it applies. */
export interface ThemeAdaptationRule {
	when: AdaptationCondition;
	value: AdaptationValue;
}

/** A theme's responsive adaptations, ported from upstream's `adaptations`. */
export interface ThemeAdaptationsConfig {
	/** Custom width breakpoints, in px. Defaults to the shared scale. */
	widthBreakpoints?: Partial<Record<AdaptationBreakpoint, number>>;
	rules?: ThemeAdaptationRule[];
}

/** A resolved adaptation rule, as the stylesheet generator consumes it. @internal */
export interface ResolvedAdaptationRule {
	when: AdaptationCondition;
	query: string;
	tokens: Record<string, string>;
}

export interface ThemeConfig {
	name: string;
	typography?: TypographyConfig;
	/** Border-radius scale. Expanded to the `--radius-*` tokens. */
	radius?: RadiusScaleConfig;
	/**
	 * Motion configuration: two knobs (`spec:AST-108`), a motion scale, or both.
	 *
	 * - `tempo` (default 1, clamped to 0.75–1.5) scales every motion duration:
	 *   the duration tokens and touch motion's springs.
	 * - `character` (`'crisp'`, `'standard'` or `'expressive'`) sets the
	 *   entrance and move curves; exits and fades never overshoot.
	 *
	 * Every theme follows each person's Reduce Motion setting; nothing loosens it.
	 *
	 * A motion scale computes duration min/max variants from base values and a
	 * ratio (min = base × ratio, max = base / ratio); its durations win over
	 * `tempo`, and explicit `tokens` overrides win over both. Finger tracking,
	 * momentum, the keyboard, hover, the press's onset delay and tap flash, and
	 * busy loops never follow the knobs; the press release fade follows `tempo`.
	 *
	 * @example
	 * ```ts
	 * motion: { tempo: 1.2, character: 'crisp' }
	 *
	 * // A motion scale, as before:
	 * motion: { fast: 175, medium: 410, slow: 975, ratio: 0.75 }
	 *
	 * // Suggested starting points:
	 * //   Snappy:    { fast: 100, medium: 250, ratio: 0.75 }
	 * //   Default:   { fast: 175, medium: 410, slow: 975, ratio: 0.75 }
	 * //   Cinematic: { fast: 200, medium: 500, slow: 1200, ratio: 0.7 }
	 * ```
	 */
	motion?: ThemeMotionConfig;
	/**
	 * Color scale configuration. Generates color token overrides from a single
	 * accent color using the HCT perceptual color model.
	 *
	 * Only generates tokens derivable from the accent — status colors,
	 * categorical hues, and fixed tokens (on-dark/on-light) use defaults.
	 * Explicit `tokens` entries always take precedence.
	 *
	 * `accent` is optional — omit it for a neutral-only theme, which keeps the
	 * default accent tokens and only themes the neutrals.
	 *
	 * @example
	 * ```ts
	 * color: { accent: '#0064E0', neutralStyle: 'cool', contrast: 'standard' }
	 *
	 * // Neutral-only — accent tokens stay at their defaults
	 * color: { neutralStyle: 'warm' }
	 * ```
	 */
	color?: ColorScaleConfig;
	/**
	 * Default syntax highlighting theme for code components. Sets the
	 * `--color-syntax-*` tokens at the theme root; a `<SyntaxTheme>` further in
	 * overrides them for its subtree.
	 *
	 * @example
	 * ```ts
	 * import { dracula } from '@astryx-svelte/core/theme/syntax';
	 * defineTheme({ name: 'my-theme', syntax: dracula });
	 * ```
	 */
	syntax?: SyntaxThemeDefinition;
	/**
	 * Base theme to extend. The new theme starts with the base theme's tokens,
	 * components, icons and indicators, then applies this input's own on top —
	 * the base always has lowest precedence, and `name` is always the child's.
	 *
	 * Use it to build a variant that customises a few aspects without restating a
	 * whole theme.
	 *
	 * Only the four merged keys inherit. `syntax`, `onDark` and `onLight` do not,
	 * which is upstream's behaviour and not an oversight here: `syntax` folds into
	 * the token map before this point, so it inherits through `resolvedTokens`
	 * anyway, and the on-media maps are resolved unconditionally from the port's
	 * own defaults for every theme.
	 *
	 * @example
	 * ```ts
	 * import { neutralTheme } from '@astryx-svelte/theme-neutral';
	 *
	 * const myTheme = defineTheme({
	 * 	name: 'my-brand',
	 * 	extends: neutralTheme,
	 * 	icons: myIcons,
	 * 	tokens: { '--color-accent': '#FF0000' }
	 * });
	 * ```
	 */
	extends?: DefinedTheme;
	tokens?: TokenMap;
	/**
	 * Tokens scoped to this theme's own namespace, emitted beside `tokens` at
	 * the theme root. Upstream's `localTokens`.
	 */
	localTokens?: TokenMap;
	/**
	 * Responsive overrides. A rule's `when` compiles to a media query and its
	 * `value.typography` re-expands the type scale inside it; this is how a
	 * mobile reader gets the larger type floor without changing the desktop
	 * scale.
	 */
	adaptations?: ThemeAdaptationsConfig;
	components?: ComponentOverrides;
	/**
	 * Icon registry — semantic icon names mapped to snippets, scoped to this
	 * theme.
	 *
	 * `Icon` and `useIcon` resolve these from the nearest `<Theme>` before
	 * falling through to the global `registerIcons` map and the built-in
	 * defaults, so two nested themes each render their own glyphs. `<Theme>`
	 * used to hand them to `registerIcons` instead — a document-wide write that
	 * made the last theme mounted win — and upstream removed that at 0.3.0.
	 */
	icons?: Partial<IconRegistry>;
	/**
	 * Indicator overrides — replaces the components that draw stateful control
	 * visuals with the theme's own, by name.
	 *
	 * Replacement is by indicator name, not per call site, so a single entry
	 * reaches every component that draws that indicator: mapping `check` to
	 * `RadioIndicator` gives radio visuals to every single-selection mark in the
	 * app.
	 *
	 * Each entry is checked against its indicator's family, so a replacement
	 * must accept the states that family passes.
	 */
	indicators?: IndicatorRegistry;
	/** Additions to the defaults for content on a dark surface (`<MediaTheme>`). */
	onDark?: OnMediaOverrides;
	/** Additions to the defaults for content on a light surface. Same shape as `onDark`. */
	onLight?: OnMediaOverrides;
}

export interface DefinedTheme extends ThemeConfig {
	/** Tokens after expanding the typography and motion scales. */
	readonly resolvedTokens: Record<string, string>;
	/**
	 * Set on a theme whose CSS ships as a separate file (this repo's
	 * `scripts/build-theme.mjs`, upstream's `astryx theme build`). `<Theme>`
	 * skips runtime style injection for one, since the stylesheet is already
	 * there. `defineTheme` never sets it — the build artifact does, as upstream's
	 * does.
	 */
	readonly __built?: true;
	/**
	 * On-media overrides after merging the theme's `onDark` over the defaults.
	 * Always present — the defaults apply whether or not a theme names them.
	 * @internal
	 */
	readonly __onDark: ResolvedOnMedia;
	/** As `__onDark`, for the light surface. @internal */
	readonly __onLight: ResolvedOnMedia;
	/** Adaptation rules after their typography scales have been expanded. @internal */
	readonly __adaptationRules: readonly ResolvedAdaptationRule[];
	/**
	 * Effective motion axis, inherited through `extends`, so a child can
	 * complete a partial motion config field by field. @internal
	 */
	readonly __axes?: { readonly motion?: ThemeMotionConfig };
}

/** Compiles a `[light, dark]` pair into `light-dark()`; passes strings through. */
export function resolveTokenValue(value: TokenValue): string {
	return Array.isArray(value) ? `light-dark(${value[0]}, ${value[1]})` : (value as string);
}

/**
 * Flattens a syntax theme into `--color-syntax-<role>` entries, which join the
 * colour namespace rather than forming one of their own.
 */
function syntaxTokenMap(syntax: SyntaxThemeDefinition | undefined): Record<string, string> {
	const tokens: Record<string, string> = {};
	for (const [name, value] of Object.entries(syntax?.tokens ?? {})) {
		tokens[`--color-syntax-${name}`] = value;
	}
	return tokens;
}

/**
 * Resolves a theme definition into its final token map.
 *
 * Precedence matches upstream's `defineTheme` step order exactly: generated
 * scales, then `syntax`, then the author's explicit `tokens`. An explicit
 * override always beats both an expander and the syntax theme — so a theme that
 * sets `syntax: dracula` *and* its own `--color-syntax-keyword` gets its own.
 *
 * The syntax fold happens **here** rather than at CSS-emit time: doing it in
 * `generateThemeCss` put it after `config.tokens` and inverted that precedence,
 * and it also left `resolvedTokens` — a public readonly field — missing entries
 * upstream's equivalent map contains.
 */
/**
 * Upstream's `resolveFontWeight`: a named weight becomes a token reference so a
 * theme that also retunes `--font-weight-*` stays coherent; anything else is a
 * raw CSS value and passes through untouched.
 */
function resolveFontWeight(weight: FontWeight): string {
	const named: Record<string, string> = {
		normal: 'var(--font-weight-normal)',
		medium: 'var(--font-weight-medium)',
		semibold: 'var(--font-weight-semibold)',
		bold: 'var(--font-weight-bold)'
	};
	return named[weight] ?? weight;
}

/**
 * Upstream's `buildFontFamily`. A family name containing a space is quoted —
 * `DM Sans` is two identifiers to a CSS parser and only `"DM Sans"` names the
 * font. The fallback stack is passed through as written, since a theme author
 * quotes inside it themselves.
 *
 * Missed until the matcha/butter/gothic/y2k themes landed: `neutral` names
 * `Figtree`, `ui-monospace` and nothing else, so every family it declares is a
 * single identifier and the bug could not show. The theme oracle caught all
 * three of matcha's on its first run.
 */
function buildFontFamily(family?: string, fallbacks?: string): string | undefined {
	if (!family) return undefined;
	const quoted = family.includes(' ') ? `"${family}"` : family;
	return fallbacks ? `${quoted}, ${fallbacks}` : quoted;
}

/**
 * Upstream's `typeScaleConfig` build: the role-level weights a theme author
 * writes on `typography.heading`/`body`/`code` are resolved to CSS values here
 * and handed to `expandTypeScale` as a flat `weights` map. The expander itself
 * knows nothing about role names or named weights.
 *
 * Returns `undefined` when there is no `scale`, which is upstream's rule and not
 * an omission: without sizes there are no leadings to derive, so a weights-only
 * config emits no type tokens at all. This port used to emit the weight tokens
 * anyway, from a branch upstream has no counterpart for.
 */
function typeScaleConfigFrom(typo: TypographyConfig | undefined): TypeScaleConfig | undefined {
	if (!typo?.scale) return undefined;

	const headingWeights: Record<number, string> = {};
	const headingRole = typo.heading;
	for (const [level, weight] of Object.entries(headingRole?.weights ?? {})) {
		if (weight) headingWeights[Number(level)] = resolveFontWeight(weight);
	}
	// The role-level default fills every level `weights` did not name; `weights`
	// wins where both are set.
	const defaultHeadingWeight = headingRole?.weight
		? resolveFontWeight(headingRole.weight)
		: undefined;
	if (defaultHeadingWeight) {
		for (let level = 1; level <= 6; level++) {
			if (!(level in headingWeights)) headingWeights[level] = defaultHeadingWeight;
		}
	}

	// `body` and `code` set their own text role's weight; there is no `large`,
	// `label` or `supporting` role to carry one, exactly as upstream has none.
	const textWeights: Record<string, string> = {};
	if (typo.body?.weight) textWeights.body = resolveFontWeight(typo.body.weight);
	if (typo.code?.weight) textWeights.code = resolveFontWeight(typo.code.weight);

	return {
		base: typo.scale.base,
		ratio: typo.scale.ratio,
		weights: {
			...(Object.keys(headingWeights).length > 0 ? { heading: headingWeights } : {}),
			...(Object.keys(textWeights).length > 0 ? { text: textWeights } : {})
		}
	};
}

/**
 * Upstream's step 1d. Applied whether or not there is a `scale` — a theme can
 * name its faces without retuning the sizes — and `heading` inherits `body`'s
 * stack when it declares no family of its own. That inheritance was missing
 * here: a theme naming only `body.family` left `--font-family-heading` at the
 * base theme's value, so its headings kept the wrong face.
 */
function fontFamilyTokens(typo: TypographyConfig | undefined): Record<string, string> {
	if (!typo) return {};
	const bodyFamily = buildFontFamily(typo.body?.family, typo.body?.fallbacks);
	const headingFamily =
		buildFontFamily(typo.heading?.family, typo.heading?.fallbacks) ?? bodyFamily;
	const codeFamily = buildFontFamily(typo.code?.family, typo.code?.fallbacks);

	const tokens: Record<string, string> = {};
	if (bodyFamily) tokens['--font-family-body'] = bodyFamily;
	if (headingFamily) tokens['--font-family-heading'] = headingFamily;
	if (codeFamily) tokens['--font-family-code'] = codeFamily;
	return tokens;
}

const DEFAULT_WIDTH_BREAKPOINTS: Record<AdaptationBreakpoint, number> = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536
};

/** Compile an adaptation condition into the media query upstream emits. */
function adaptationQuery(
	when: AdaptationCondition,
	breakpoints: Record<AdaptationBreakpoint, number>
): string {
	const parts: string[] = [];
	if (when.width?.below != null) parts.push(`(width < ${breakpoints[when.width.below]}px)`);
	if (when.width?.above != null) parts.push(`(width > ${breakpoints[when.width.above]}px)`);
	if (when.pointer != null) parts.push(`(pointer: ${when.pointer})`);
	return parts.join(' and ');
}

/** The slow band's duration tokens. */
const SLOW_BAND = ['--duration-slow-min', '--duration-slow', '--duration-slow-max'] as const;

/**
 * The base's tokens for the duration-scale fields a child leaves unset
 * (`spec:AST-108` FR5, field by field): a child that sets no `slow` of its own
 * regenerates only the fast and medium bands, so an inherited slow band stays
 * as the base's tokens hold it, at the ratio it was made with; and a child
 * that sets no `easing` keeps the base's `--ease-standard`, an explicit one
 * included.
 */
function inheritedScaleTokens(
	base: DefinedTheme,
	baseMotion: ThemeMotionConfig,
	own: ThemeMotionConfig
): Record<string, TokenValue> | undefined {
	const names = [
		...('slow' in baseMotion && !('slow' in own) ? SLOW_BAND : []),
		...('easing' in baseMotion && !('easing' in own) ? (['--ease-standard'] as const) : [])
	];
	if (names.length === 0) return undefined;
	const tokens = base.resolvedTokens;
	return Object.fromEntries(
		names.flatMap((name) => (tokens[name] !== undefined ? [[name, tokens[name]]] : []))
	);
}

/**
 * Refuses a duration scale that is missing `fast`, `medium` or `ratio` after
 * inheritance. The scale applies only when all three are present, so a partial
 * one beside a knob (`{fast: 100, tempo: 1.2}`) would otherwise be dropped
 * silently, though its fields win over `tempo` (`spec:AST-108` FR5).
 */
function assertCompleteMotionScale(motion: ThemeMotionConfig, themeName: string): void {
	const scale = motion as Partial<MotionScaleConfig>;
	const writesScale =
		scale.fast !== undefined ||
		scale.medium !== undefined ||
		scale.ratio !== undefined ||
		scale.slow !== undefined ||
		scale.easing !== undefined;
	if (
		writesScale &&
		(scale.fast === undefined || scale.medium === undefined || scale.ratio === undefined)
	) {
		throw new Error(
			`defineTheme("${themeName}"): \`motion\` sets a duration scale field, so it must supply \`fast\`, \`medium\`, and \`ratio\` unless each missing field is inherited from \`extends\`.`
		);
	}
}

function assertFiniteNumber(value: unknown, path: string): asserts value is number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`${path} must be a finite number.`);
	}
}

/**
 * Complete an adaptation rule's partial motion config from the theme's
 * effective root axis, as upstream's `completeMotion` does. A rule may not set
 * `reducedMotion`: it is theme-wide.
 */
function completeMotion(
	root: ThemeMotionConfig | undefined,
	rule: Partial<MotionScaleConfig> & ThemeMotionKnobs,
	path: string
): ThemeMotionConfig {
	if ((rule as { reducedMotion?: unknown }).reducedMotion !== undefined) {
		throw new Error(
			`${path}.reducedMotion is a theme-wide setting: set it on the theme's own ` +
				'motion, not in an adaptation rule.'
		);
	}
	const tempo = rule.tempo ?? root?.tempo;
	const character = rule.character ?? root?.character;
	const knobs: ThemeMotionKnobs = {
		...(tempo !== undefined ? { tempo } : {}),
		...(character !== undefined ? { character } : {})
	};
	if (knobs.tempo !== undefined) {
		assertFiniteNumber(knobs.tempo, `${path}.tempo`);
	}
	const rootScale: Partial<MotionScaleConfig> = root != null && 'fast' in root ? root : {};
	const writesScale =
		rule.fast !== undefined ||
		rule.medium !== undefined ||
		rule.ratio !== undefined ||
		rule.slow !== undefined ||
		rule.easing !== undefined;
	if (!writesScale && !('fast' in rootScale)) {
		// Knobs only, over a root with no scale: the knobs generate the tokens.
		return knobs;
	}
	const fast = rule.fast ?? rootScale.fast;
	const medium = rule.medium ?? rootScale.medium;
	const ratio = rule.ratio ?? rootScale.ratio;
	if (fast === undefined || medium === undefined || ratio === undefined) {
		throw new Error(
			`${path} must supply \`fast\`, \`medium\`, and \`ratio\` unless each missing field exists on the effective root motion axis.`
		);
	}
	assertFiniteNumber(fast, `${path}.fast`);
	assertFiniteNumber(medium, `${path}.medium`);
	assertFiniteNumber(ratio, `${path}.ratio`);
	const slow = rule.slow ?? rootScale.slow;
	if (slow !== undefined) {
		assertFiniteNumber(slow, `${path}.slow`);
	}
	const easing = rule.easing ?? rootScale.easing;
	return {
		fast,
		medium,
		ratio,
		...(slow !== undefined ? { slow } : {}),
		...(easing !== undefined ? { easing } : {}),
		...knobs
	};
}

/** The default `--ease-standard`; mirrors the token stylesheet on the plain-Node path. */
const DEFAULT_STANDARD_EASE = 'cubic-bezier(0.24, 1, 0.4, 1)';

/**
 * Apply a motion layer's tokens, then the copies busy loops read (FR4): a
 * layer that writes durations writes their pre-tempo values, and a tempo of 1
 * when it sets none, so its springs keep the pace of its durations inside a
 * theme with a tempo.
 */
function assignMotionTokens(
	target: Record<string, string>,
	motion: ThemeMotionConfig | undefined
): void {
	if (motion == null) return;
	const generated = expandThemeMotion(motion);
	Object.assign(target, generated);
	let writesDurations = false;
	for (const [name, value] of Object.entries(generated)) {
		const preTempo = preTempoName(name);
		if (preTempo !== name) {
			writesDurations = true;
			if (!(preTempo in generated)) target[preTempo] = value;
		}
	}
	if (writesDurations && !(MOTION_TEMPO_PROPERTY in generated)) {
		target[MOTION_TEMPO_PROPERTY] = '1';
	}
}

/**
 * Apply explicit token overrides. An explicit duration beats tempo, so a busy
 * loop reading the pre-tempo value reads it too (FR4).
 */
function assignExplicitTokens(target: Record<string, string>, tokens: TokenMap | undefined): void {
	for (const [name, value] of Object.entries(tokens ?? {})) {
		if (value === undefined) continue;
		target[name] = resolveTokenValue(value);
		const preTempo = preTempoName(name);
		if (preTempo !== name && tokens?.[preTempo] === undefined) {
			target[preTempo] = target[name];
		}
	}
}

/**
 * At 'standard', `--ease-entrance` and `--ease-move` equal the resolved
 * `--ease-standard` (FR2): the layer's own, else the one beneath it. A layer
 * that sets them itself, or whose character, its own or the one it inherits,
 * picks its own curve, keeps them.
 */
function applyStandardEase(
	target: Record<string, string>,
	ownTokens: TokenMap | undefined,
	motion: ThemeMotionConfig | undefined,
	inheritedCharacter: MotionCharacter | undefined,
	standardBeneath: string | undefined
): void {
	const own = ownTokens ?? {};
	const ownCharacter = motion != null && 'character' in motion ? motion.character : undefined;
	const character = ownCharacter ?? inheritedCharacter;
	if (
		ownCharacter === 'standard' ||
		(own['--ease-standard'] !== undefined && (character === undefined || character === 'standard'))
	) {
		const standard = target['--ease-standard'] ?? standardBeneath ?? DEFAULT_STANDARD_EASE;
		for (const name of ['--ease-entrance', '--ease-move']) {
			if (own[name] === undefined) target[name] = standard;
		}
	}
}

/**
 * Resolve one adaptation's value into the token map its media block carries.
 * Upstream re-expands the type scale and re-emits the font families, completes
 * a partial motion config from the root axis, then layers the rule's explicit
 * tokens on top.
 */
function resolveAdaptation(
	themeName: string,
	rule: ThemeAdaptationRule,
	index: number,
	breakpoints: Record<AdaptationBreakpoint, number>,
	baseTypography: TypographyConfig | undefined,
	motionAxis: ThemeMotionConfig | undefined,
	rootTokens: Record<string, string>
): ResolvedAdaptationRule {
	// Only the fields the adaptation names change; its weights and families
	// inherit the theme's root typography, as upstream's merge does.
	const typography: TypographyConfig = {
		...baseTypography,
		...rule.value.typography,
		scale: rule.value.typography?.scale ?? baseTypography?.scale
	};
	const typeScale = typeScaleConfigFrom(typography);
	const motion = rule.value.motion
		? completeMotion(
				motionAxis,
				rule.value.motion,
				`defineTheme("${themeName}").adaptations.rules[${index}].value.motion`
			)
		: undefined;
	const tokens: Record<string, string> = {
		...(typeScale ? expandTypeScale(typeScale) : {}),
		...fontFamilyTokens(typography)
	};
	assignMotionTokens(tokens, motion);
	assignExplicitTokens(tokens, rule.value.tokens);
	// A rule without motion of its own keeps the theme's character, so its
	// explicit --ease-standard leaves that character's curves alone; one at
	// 'standard' matches the theme's --ease-standard.
	applyStandardEase(
		tokens,
		rule.value.tokens,
		motion,
		motionAxis?.character,
		rootTokens['--ease-standard']
	);
	return {
		when: rule.when,
		query: adaptationQuery(rule.when, breakpoints),
		tokens
	};
}

export function defineTheme(config: ThemeConfig): DefinedTheme {
	// Step 0, as upstream numbers it: pre-seed from the base theme so everything
	// below overwrites it. `base.resolvedTokens` and not `base.tokens` — upstream
	// has one token map and this port has two, and the resolved one is the
	// counterpart (see the note in `tokens.ts`). Seeding the raw map instead would
	// inherit only what the base's author typed by hand and silently drop every
	// token its expanders generated.
	const base = config.extends;
	const typeScaleConfig = typeScaleConfigFrom(config.typography);

	// Motion inherits field by field (`spec:AST-108` FR5): a duration-scale
	// field or knob the child leaves unset keeps its base's value, so the
	// child's motion tokens come from the merged configuration. They resolve
	// base first, then generated: what the child generates replaces the base's
	// tokens, its explicit ones included. A child's motion regenerates only what
	// it sets: an inherited slow band and an inherited easing keep the base's
	// tokens.
	const baseMotion = base?.__axes?.motion ?? base?.motion;
	const motion: ThemeMotionConfig | undefined =
		config.motion != null && baseMotion != null
			? { ...baseMotion, ...config.motion }
			: config.motion;
	if (motion != null) assertCompleteMotionScale(motion, config.name);
	const inheritedScale =
		config.motion != null && base != null && baseMotion != null
			? inheritedScaleTokens(base, baseMotion, config.motion)
			: undefined;
	const effectiveTokens: TokenMap | undefined =
		inheritedScale != null && Object.keys(inheritedScale).length > 0
			? { ...inheritedScale, ...config.tokens }
			: config.tokens;
	const motionAxis = motion ?? baseMotion;

	const resolvedTokens: Record<string, string> = {
		...base?.resolvedTokens,
		// Colour leads, as upstream's step order has it — its step 1, ahead of the
		// type scale. No generated key namespace actually collides (colour emits
		// `--color-*`, and the syntax fold below owns `--color-syntax-*` alone), so
		// today the position is parity rather than behaviour; it stops being inert
		// the moment an expander grows into another's namespace.
		...(config.color ? expandColorScale(config.color) : {}),
		...(typeScaleConfig ? expandTypeScale(typeScaleConfig) : {}),
		// Radius sits between the type scale and motion, as upstream's step order
		// has it — all three are expanders, so the order only matters against
		// `config.tokens`, which wins over every one of them.
		...(config.radius ? expandRadiusScale(config.radius) : {})
	};
	assignMotionTokens(resolvedTokens, motion);
	Object.assign(resolvedTokens, fontFamilyTokens(config.typography), syntaxTokenMap(config.syntax));
	assignExplicitTokens(resolvedTokens, effectiveTokens);
	assignExplicitTokens(resolvedTokens, config.localTokens);
	// An explicit --ease-standard follows the character the theme inherits when
	// it sets no motion of its own (FR2).
	applyStandardEase(resolvedTokens, effectiveTokens, motion, baseMotion?.character, undefined);

	// Public tokens whose canonical default references another public token.
	// Upstream repeats an omitted alias at the theme root so a nested theme binds
	// it locally without changing authored-token metadata. Processing in order
	// lets the icon and border aliases see the text roles created just above.
	const REFERENCE_DEFAULTS: ReadonlyArray<readonly [string, string]> = [
		['--color-text-info', '--color-text-blue'],
		['--color-text-success', '--color-text-green'],
		['--color-text-warning', '--color-text-yellow'],
		['--color-text-error', '--color-text-red'],
		['--color-on-info-muted', '--color-text-blue'],
		['--color-on-success-muted', '--color-text-green'],
		['--color-on-warning-muted', '--color-text-yellow'],
		['--color-on-error-muted', '--color-text-red'],
		['--color-icon-info', '--color-text-info'],
		['--color-icon-success', '--color-text-success'],
		['--color-icon-warning', '--color-text-warning'],
		['--color-icon-error', '--color-text-error'],
		['--color-border-info', '--color-text-info'],
		['--color-border-success', '--color-text-success'],
		['--color-border-warning', '--color-text-warning'],
		['--color-border-error', '--color-text-error'],
		['--duration-exit', '--duration-fast']
	];
	for (const [role, source] of REFERENCE_DEFAULTS) {
		if (resolvedTokens[role] === undefined && resolvedTokens[source] !== undefined) {
			resolvedTokens[role] = `var(${source})`;
		}
	}

	// A semantic size the theme pins to a raw length follows the reader's
	// Dynamic Type setting, exactly as a generated scale step does. Upstream's
	// readerTextSizeEntries rewrites these at build time.
	const textSizeStyles: Record<string, string> = {
		body: 'body',
		label: 'body',
		code: 'body',
		large: 'title3',
		supporting: 'footnote',
		'display-1': 'large-title',
		'display-2': 'large-title',
		'display-3': 'title1'
	};
	for (const [name, value] of Object.entries(resolvedTokens)) {
		const match = /^--text-([a-z0-9-]+)-size$/.exec(name);
		if (match == null || value.startsWith('var(') || !/^[\d.]+(?:rem|px)$/.test(value)) continue;
		const style = textSizeStyles[match[1]];
		if (style != null) {
			resolvedTokens[name] = `calc(${value} * var(--_dynamic-type-${style}, 1))`;
		}
	}

	// Generated component bindings first, so a theme's own `components` entry for
	// the same style key still wins — upstream's precedence. A component only
	// receives the generated colour rules when the theme actually touches it:
	// upstream emits Link's rules only when the theme styles Link.
	const generated: Record<
		string,
		Record<string, Record<string, string>>
	> = generateTextColorComponents();
	const authored = (name: string) =>
		config.components?.[name] != null || base?.components?.[name] != null;
	for (const name of Object.keys(generated)) {
		const keep =
			name === 'heading' || name === 'text'
				? typeScaleConfig != null || authored(name)
				: authored(name);
		if (!keep) delete generated[name];
	}
	if (typeScaleConfig) {
		for (const [name, styles] of Object.entries(generateTypeScaleComponents(typeScaleConfig))) {
			generated[name] = { ...generated[name], ...styles };
		}
	}
	// A Heading override anywhere in the stack gets the public `weight` choices
	// re-emitted, even when the theme brings its own Heading rules rather than a
	// type scale: the component's ordinary weight class sits below the theme
	// layer, so without these the prop cannot beat a type or level default.
	if (config.components?.heading != null || base?.components?.heading != null) {
		generated.heading = {
			...Object.fromEntries(
				Object.entries({
					normal: 'var(--font-weight-normal)',
					medium: 'var(--font-weight-medium)',
					semibold: 'var(--font-weight-semibold)',
					bold: 'var(--font-weight-bold)'
				}).map(([name, value]) => [`weight:${name}`, { fontWeight: value }])
			),
			...generated.heading
		};
	}

	let components = deepMergeComponents(generated, config.components);
	// The base goes underneath the whole generated-then-explicit stack, not
	// alongside it — upstream's step 3 ordering. A child's own entry for a style
	// key still wins, and so does a generated one.
	if (base?.components) {
		components = deepMergeComponents(base.components, components);
	}

	// Icons and indicators merge one level deep, keyed by name: a child that
	// replaces `check` keeps every other glyph the base registered.
	const icons =
		config.icons && base?.icons
			? { ...base.icons, ...config.icons }
			: (config.icons ?? base?.icons);
	const indicators =
		config.indicators && base?.indicators
			? { ...base.indicators, ...config.indicators }
			: (config.indicators ?? base?.indicators);

	const theme: DefinedTheme = {
		...config,
		// After the spread, so the merged values win over the child's own raw ones.
		// `name` deliberately is not merged: it comes from the spread, so a child
		// always keeps its own.
		icons,
		indicators,
		components,
		resolvedTokens,
		// Resolved unconditionally: the on-media defaults are what make
		// `<MediaTheme>` work at all, so a theme that says nothing about media
		// surfaces still emits them.
		__onDark: resolveOnMedia('dark', config.onDark),
		__onLight: resolveOnMedia('light', config.onLight),
		__axes: { motion: motionAxis },
		__adaptationRules: (config.adaptations?.rules ?? []).map((rule, index) =>
			resolveAdaptation(
				config.name,
				rule,
				index,
				{
					...DEFAULT_WIDTH_BREAKPOINTS,
					...config.adaptations?.widthBreakpoints
				},
				config.typography,
				motionAxis,
				resolvedTokens
			)
		)
	};

	// Defining a theme registers it, so a name-keyed lookup (`getIcon(name,
	// 'brand')`) resolves without a `<Theme>` having mounted. Upstream's, added
	// at 0.3.0 alongside the registry.
	registerTheme(theme);
	return theme;
}
