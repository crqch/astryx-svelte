/**
 * Liquid Glass — a macOS theme, and the **first theme package here with no
 * upstream counterpart**.
 *
 * Every other `packages/themes/*` package is a transcription of an
 * `@astryxdesign/theme-*` and is held to the repo's parity rule by
 * `scripts/compare-upstream.mjs`, which diffs its compiled CSS against
 * upstream's. This one has nothing to diff against, so it is checked a
 * different way — see `scripts/check-theme.mjs`, which validates that every
 * token name it sets is a real Astryx token and every component it overrides is
 * a real `themeProps()` component. That check is the reason a typo here fails
 * the build rather than silently emitting a rule that matches nothing.
 *
 * ## What it is
 *
 * macOS as of the Liquid Glass design language: translucent materials that blur
 * and saturate what sits behind them, a specular highlight along the top edge,
 * hairline rims, capsule controls, soft wide shadows, the SF system face, and
 * Apple's system colour palette.
 *
 * The work is split the way the theme system wants it:
 *
 * - **Tokens carry the colour.** Every surface token is a translucent fill, so
 *   the material reads as glass without a single component override. A theme
 *   that only changed `backdrop-filter` and left the surfaces opaque would blur
 *   nothing.
 * - **Component overrides carry what a token cannot express** — the
 *   `backdrop-filter` itself, and the capsule geometry.
 *
 * ## Colours
 *
 * Apple's published system palette, used verbatim rather than re-derived. Fills
 * and rims use the vivid stop at low alpha (which is how macOS composites them —
 * `systemFill` and friends are alpha colours, not solid ones); text and icons
 * use Apple's **accessible** variants, which exist precisely because the vivid
 * stop is unreadable as text. The one value that lands under 4.5:1 is
 * `--color-text-teal` in light mode (#008299, ~4.0:1), which is Apple's own
 * published accessible teal; it is kept rather than hand-tuned, since a
 * categorical text token is a label rather than body copy.
 *
 * The accessible stops are *text* stops, and a solid surface that carries a
 * label is not text on the page — it is text on the fill. `--color-on-success`,
 * `--color-on-error` and `--color-on-warning` are therefore **mode pairs**, not
 * one value: the bright dark-mode stops (#30db5b, #ff6961, #ffd426) need dark
 * ink where their light-mode counterparts take white. A single white
 * `--color-on-success` measured 1.8:1 on the dark fill, which is where the
 * semantic `Badge` and `Step` number read.
 *
 * ## States
 *
 * Every state colour is a token pair, so the hover / pressed / selected /
 * disabled / focus stops flip with the mode rather than against it:
 *
 * - **hover / pressed** — `--color-overlay-hover` / `--color-overlay-pressed`,
 *   the neutral washes core's shared interaction overlay stacks over the base
 *   fill. Low-alpha black in light mode, low-alpha white in dark.
 * - **selected** — `--color-accent-muted`, at the same alpha as the categorical
 *   fills (`systemFill` @ 15% light / 18% dark) so a selected row matches the
 *   accent hue's own badge instead of being a fainter one.
 * - **disabled** — alpha text/icon ramps plus the components' own 0.5 opacity,
 *   which reads correctly over every translucent surface.
 * - **focus** — `--focus-outline-color` is left at its `var(--color-accent)`
 *   default, so the platform ring is systemBlue in both modes.
 *
 * State *changes* are transitioned by the component overrides further down,
 * with `--duration-fast` and the macOS `--ease-standard` curve, and zeroed under
 * `prefers-reduced-motion` by `scripts/build-theme.mjs`.
 *
 * ## Cost
 *
 * `backdrop-filter` forces a compositing layer and re-filters on every paint
 * behind it. It is applied to floating surfaces, app chrome and cards — things
 * that are few and large — and deliberately **not** to buttons, badges, tokens
 * or list items, which are many and small. `variant:secondary` on `Button` is
 * the single exception, because the glass capsule button is the most
 * recognisable thing in the whole design language.
 */

import { defineSyntaxTheme, defineTheme } from '@astryx-svelte/core/theme/define';

/**
 * Apple's vibrancy materials, thin → thick. Each is a full `backdrop-filter`
 * value; the saturation boost is what stops a blurred backdrop reading as grey
 * mud, and is the half of the recipe people forget.
 */
type Material = 'thin' | 'regular' | 'thick';

const SATURATE = '180%';
const BLUR: Record<Material, string> = { thin: '12px', regular: '24px', thick: '48px' };

/**
 * The three materials as **literal** CSS values.
 *
 * Interpolated here, at build time, rather than referenced through the
 * `--glass-*` custom properties this theme also publishes — and that is a
 * correctness requirement, not a style choice. **Safari's `backdrop-filter`
 * silently ignores any value containing `var()`**, whatever it resolves to
 * (mdn/browser-compat-data#25914, still open, reproduced through Safari 18.3).
 * A `backdrop-filter: var(--glass-material)` therefore renders no material at
 * all on the one browser a macOS theme most needs to be right on, and does so
 * without an error, a warning, or any difference on the Chromium machine it was
 * written on.
 *
 * `scripts/check-theme.mjs` fails the build if a `var()` ever reappears inside a
 * `backdrop-filter` in the output. Retire both this note and that check when
 * WebKit fixes the bug; the `--glass-*` knobs below become live at the same
 * moment.
 */
const MATERIAL: Record<Material, string> = {
	thin: `saturate(${SATURATE}) blur(${BLUR.thin})`,
	regular: `saturate(${SATURATE}) blur(${BLUR.regular})`,
	thick: `saturate(${SATURATE}) blur(${BLUR.thick})`
};

/** The capsule radius, which is the one shape a squircle must not be applied to. */
const FULL = 'var(--radius-full)';

/**
 * The inset between a menu's edge and its rows — macOS's menus, popovers and
 * sidebars all float their selection highlight inside a margin rather than
 * running it to the edge.
 */
const MENU_INSET = '5px';

/**
 * A radius concentric with its container's.
 *
 * **The geometry principle of the whole design language.** Tahoe's rule is that
 * a nested corner shares its container's centre of curvature, which means
 * `inner = outer − gap`; SwiftUI ships it as `ConcentricRectangle` and
 * `containerShape`, and it is why Tahoe's windows-with-toolbars grew a larger
 * radius than windows without. Get it wrong in either direction and the eye
 * reads it immediately: too small and the inner shape looks pinched, too large
 * and its corners cut into the container's.
 *
 * Written as a live `calc()` over the two custom properties rather than as a
 * precomputed number, so retuning `--radius-container` moves both halves of the
 * pair together. That is the same construction `chat-composer.stylex.ts` already
 * uses for its send button, so the idiom is the codebase's own rather than this
 * theme's invention.
 */
function concentric(container: string, gap: string): Record<string, string> {
	return { borderRadius: `calc(${container} - ${gap})`, cornerShape: 'squircle' };
}

/**
 * `corner-shape: squircle` — the continuous-curvature corner, and the most
 * macOS-specific geometry available in CSS.
 *
 * Apple's corners have never been circular arcs; `squircle` is the shorthand for
 * `superellipse(2)`, which is the curve that lands on the iOS/macOS look.
 * Chromium 139+ only (~65% of users, not Baseline) with no Firefox or Safari
 * timeline, but it degrades to nothing: the property has no effect without a
 * non-zero `border-radius`, and a browser that does not know it simply keeps the
 * ordinary rounded corner the radius already produced. That makes it a free
 * enhancement rather than a support decision.
 *
 * Never applied at `--radius-full`: a capsule is already the shape Apple wants
 * there, and superellipsing a half-height radius rounds it *off* into something
 * that is neither.
 */
function squircle(borderRadius: string): Record<string, string> {
	return borderRadius === FULL ? { borderRadius } : { borderRadius, cornerShape: 'squircle' };
}

/**
 * The state transition every interactive surface in this theme shares.
 *
 * Core declares this on *some* components and not others: `Button`,
 * `SegmentedControlItem`, `Switch`, `Link` and the inputs already transition
 * their own state colours, but the menu rows (`DropdownMenuItem`,
 * `TypeaheadItem`, `CommandPaletteItem`, `TabMenuItem`, `NavHeadingMenuItem`,
 * `SelectorOption`) and the nav/tree rows only paint a background, so their
 * hover / selected / disabled states snap. Applying the same declaration from
 * the theme layer is also the only way to fix it without touching core, which
 * this package does not own.
 *
 * `background-image` is listed because core's shared interaction overlay is a
 * stacked gradient, and while two gradients do not interpolate, including the
 * property keeps the theme from *narrowing* a component's own transition.
 * `transform` is listed for the same reason and is the one that matters:
 * `Button`'s press scale transitions `transform`, so a theme rule that named
 * only the colour properties would replace that list and make the press snap.
 * No layout property is listed: animating width/height/padding on a hover would
 * run layout every frame, which is the jank this is meant to avoid.
 *
 * The duration is the motion token rather than a literal, so retuning `motion`
 * retunes every state change; `scripts/build-theme.mjs` appends the
 * `prefers-reduced-motion: reduce` block that zeroes it, derived from the same
 * overrides rather than kept as a second list.
 */
const STATE_TRANSITION = {
	transitionProperty:
		'background-color, background-image, border-color, color, box-shadow, opacity, transform',
	transitionDuration: 'var(--duration-fast)',
	transitionTimingFunction: 'var(--ease-standard)'
};

/**
 * One surface's glass declarations.
 *
 * The prefixed property is written in its final CSS form rather than as
 * `WebkitBackdropFilter`, because `generateThemeRules`' camelCase→kebab pass
 * only inserts a dash *between* characters — a leading capital would come out as
 * `webkit-backdrop-filter`, with the dash that makes it a vendor prefix missing.
 * Safari below 18 knows only the prefixed name, and a macOS theme that gave up
 * on Safari would be a strange thing.
 *
 * `borderRadius` is part of this rather than a separate concern: a
 * `backdrop-filter` is clipped to the element's border box *including* its
 * radius, so a blurred surface with square corners bleeds past the rounded
 * surface it sits in. Passing the radius here keeps the two — and the corner
 * shape — in step.
 */
function glass(material: Material, borderRadius?: string): Record<string, string> {
	const filter = MATERIAL[material];
	return {
		backdropFilter: filter,
		'-webkit-backdrop-filter': filter,
		...(borderRadius === undefined ? {} : squircle(borderRadius))
	};
}

/**
 * Xcode's default syntax palette, light and dark. Chosen over one derived from
 * the categorical tokens because a macOS theme's code blocks should look like
 * the editor the platform ships.
 */
const liquidGlassSyntax = defineSyntaxTheme({
	name: 'astryx-liquid-glass',
	tokens: {
		keyword: ['#ad3da4', '#ff7ab2'],
		string: ['#d12f1b', '#ff8170'],
		comment: ['#5d6c79', '#7f8c98'],
		number: ['#272ad8', '#d9c97c'],
		function: ['#4b21b0', '#dabaff'],
		type: ['#3900a0', '#dabaff'],
		variable: ['#1d1d1f', '#f5f5f7'],
		operator: ['#1d1d1f', '#f5f5f7'],
		constant: ['#272ad8', '#d9c97c'],
		tag: ['#ad3da4', '#ff7ab2'],
		attribute: ['#804fb8', '#b281eb'],
		property: ['#23575c', '#6bdfff'],
		punctuation: ['#3c3c4399', '#ebebf599'],
		background: ['#ffffff', '#1f1f24']
	}
});

/**
 * Opaque replacements for the translucent surface tokens, applied under
 * `@media (prefers-reduced-transparency: reduce)`.
 *
 * macOS ships **Reduce Transparency** in Accessibility → Display, and when a
 * person turns it on the system stops compositing vibrancy anywhere: sidebars,
 * menus and sheets go flat. A theme built entirely out of translucent materials
 * that ignored that setting would be the one theme in the set that a user's
 * stated accessibility preference could not switch off.
 *
 * Only the *surfaces* go opaque. The alpha in the text, border and shadow tokens
 * stays: the preference is about layer translucency and vibrancy, which is what
 * makes text on a moving backdrop hard to read, not about flattening every
 * colour that happens to carry an alpha channel.
 *
 * This is applied by `scripts/build-theme.mjs`, which appends the media block to
 * the generated stylesheet, rather than expressed here — `defineTheme` has no
 * media-query seam, and adding one would mean changing a file ported from
 * upstream for a feature upstream does not have.
 *
 * Chrome/Edge 118+, ~73% of users; no Firefox, and — the irony is worth naming —
 * no Safari. It degrades to the translucent default, which is the same thing
 * every browser did before the block existed.
 */
export const reducedTransparencyTokens: Record<string, string> = {
	'--color-background-surface': 'light-dark(#ffffff, #2c2c2e)',
	'--color-background-card': 'light-dark(#ffffff, #2c2c2e)',
	'--color-background-popover': 'light-dark(#f7f7fa, #3a3a3c)',
	'--color-background-muted': 'light-dark(#e8e8ed, #3a3a3c)',
	'--color-neutral': 'light-dark(#e8e8ed, #3a3a3c)',
	// The inverted pair is the Toast's surface (and its error variant), which is
	// also a glass surface — 90% is *visibly* translucent over a bright page, so
	// it goes fully opaque with the rest rather than staying a near-miss.
	'--color-background-inverted': 'light-dark(#1d1d1f, #f5f5f7)',
	'--color-background-error-inverted': 'light-dark(#d70015, #ff6961)'
};

/**
 * The component overrides that make Reduce Transparency complete.
 *
 * `reducedTransparencyTokens` can only reach values that come *from* a token.
 * The secondary Button's fill is a literal in its component override — it has
 * to be, because there is no "control fill" token — so the token block left it
 * at `#ffffff8f` / `#ffffff1f` while every other surface went opaque. Unblurred
 * but still see-through is worse than either end of the preference: the button
 * keeps showing the page through it, which is the one thing the setting exists
 * to stop. `scripts/build-theme.mjs` emits these for the same block, so the
 * rule and the token list cannot drift apart.
 */
export const reducedTransparencyComponents: Record<
	string,
	Record<string, Record<string, string>>
> = {
	button: {
		'variant:secondary': {
			// macOS flattens a vibrancy control to its control background, not to
			// the window surface: white in light mode, a raised grey in dark.
			backgroundColor: 'light-dark(#ffffff, #3a3a3c)'
		}
	}
};

export const liquidGlassTheme = defineTheme({
	name: 'liquid-glass',

	// SF, reached through the system-font keywords rather than a webfont — the
	// face is already on every Mac and is not licensed for the web anywhere else.
	// `-apple-system` picks SF Pro on Safari, `BlinkMacSystemFont` on Chromium;
	// the rest of the stack is the graceful decline elsewhere. Base 15 rather
	// than macOS's own 13: 13px is a desktop-app metric and reads cramped in a
	// browser, and 15/1.2 keeps the ramp Apple's proportions.
	typography: {
		scale: { base: 15, ratio: 1.2 },
		body: {
			family: '-apple-system',
			fallbacks:
				'BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable", "Segoe UI", Roboto, ' +
				'Helvetica, Arial, sans-serif'
		},
		heading: {
			family: '-apple-system',
			fallbacks:
				'BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable", "Segoe UI", Roboto, ' +
				'Helvetica, Arial, sans-serif',
			// SF Display's optical sizes want more weight at headline sizes and less
			// at the small end, which is how macOS itself sets titles.
			weights: { 1: 'bold', 2: 'bold', 3: 'semibold', 4: 'semibold' }
		},
		code: {
			family: 'ui-monospace',
			fallbacks: '"SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace'
		}
	},

	// Quick, and eased on the curve macOS uses for sheets and sidebars — see
	// `--ease-standard` below, which is the half that actually makes it feel
	// native. Produces fast 105/150/195ms and medium 245/350/455ms.
	motion: { fast: 150, medium: 350, slow: 600, ratio: 0.7 },

	syntax: liquidGlassSyntax,

	tokens: {
		// ====================================================================
		// The material.
		//
		// These seven are this theme's own custom properties rather than Astryx
		// tokens, and they are published on purpose — but read the caveat, it is
		// load-bearing.
		//
		// They are **descriptive, not live**. The component rules below carry
		// literal material values, because Safari's `backdrop-filter` ignores any
		// `var()` (see MATERIAL above), so overriding `--glass-blur` does *not*
		// retune this theme's surfaces. What they are good for is your own CSS —
		// a custom panel that wants to match, or a `@supports`/media block of your
		// own — and as the single readable statement of what the material is.
		// They become live the day WebKit fixes the bug.
		//
		// Written out flat rather than composed from each other for the same
		// reason: a consumer who does write `backdrop-filter: var(--glass-material)`
		// gets a value with no nested references, which is the closest this can
		// come to working on Safari.
		//
		// The saturation boost is not decoration. A plain blur averages the
		// backdrop toward grey; pushing chroma back up is what makes the result
		// read as a translucent pane rather than as frosted plastic.
		// ====================================================================
		'--glass-blur-thin': BLUR.thin,
		'--glass-blur': BLUR.regular,
		'--glass-blur-thick': BLUR.thick,
		'--glass-saturate': SATURATE,
		'--glass-material-thin': MATERIAL.thin,
		'--glass-material': MATERIAL.regular,
		'--glass-material-thick': MATERIAL.thick,

		// The shared term in every concentric pair below: the inset between a
		// floating menu's edge and the rows inside it. Declared once because
		// concentricity is precisely the property of *not* letting the two drift.
		'--glass-menu-inset': MENU_INSET,

		// ====================================================================
		// Backgrounds.
		//
		// Every lifted surface is translucent, in the ladder macOS uses: the
		// deeper a thing floats above the window, the more opaque and the more
		// blurred it is, so a menu over a card over the window stays legible
		// three layers down.
		//
		//   body     opaque         the only opaque surface
		//   surface  72%  thick blur   window chrome
		//   card     80%  thin blur    content
		//   popover  85%  regular blur menus, popovers, sheets
		//
		// The body is flat rather than tinted: on a Mac the thing behind the
		// glass is the desktop picture, and a web page's honest equivalent is a
		// neutral canvas an app can replace with whatever it likes.
		// ====================================================================
		'--color-background-body': ['#e9e9ee', '#131315'],
		'--color-background-surface': ['#ffffffb8', '#2c2c2eb8'],
		'--color-background-card': ['#ffffffcc', '#2c2c2ecc'],
		'--color-background-popover': ['#f7f7fad9', '#3a3a3cd9'],
		// systemFill — Apple composites its neutral fills as alpha over whatever
		// is behind them, which is exactly what a glass theme needs.
		'--color-background-muted': ['#7676801f', '#7676803d'],
		'--color-background-inverted': ['#1d1d1fe6', '#f5f5f7e6'],
		'--color-background-error-inverted': ['#d70015e6', '#ff6961e6'],

		// Accent — systemBlue, the macOS default. `--color-text-accent` steps to
		// the link blue, which is darker in light mode for the same reason
		// Apple's is: systemBlue on white is 3.6:1 and fails as body text.
		//
		// `--color-accent-muted` is the accent's *fill* stop, so it shares the
		// categorical fills' alpha ladder (vivid @ 15% light / 18% dark). At the
		// first pass's 12% it was weaker than an info Badge of the same hue, which
		// made a selected row read as a fainter state than a coloured label and
		// left the light-mode pair inconsistent with its own dark side.
		'--color-accent': ['#007aff', '#0a84ff'],
		'--color-accent-muted': ['#007aff26', '#0a84ff2e'],
		'--color-text-accent': ['#0066cc', '#409cff'],
		'--color-icon-accent': ['#007aff', '#0a84ff'],
		'--color-neutral': ['#7676801f', '#7676803d'],

		// Overlays — the scrim behind a sheet, and the hover/pressed washes.
		'--color-overlay': ['#00000059', '#000000a6'],
		'--color-overlay-hover': ['#0000000d', '#ffffff14'],
		'--color-overlay-pressed': ['#0000001a', '#ffffff24'],

		// Text — Apple's label ramp. Secondary and disabled are alpha rather than
		// solid grey, so they stay correct over any of the four surfaces above.
		'--color-text-primary': ['#1d1d1f', '#f5f5f7'],
		'--color-text-secondary': ['#3c3c4399', '#ebebf599'],
		'--color-text-disabled': ['#3c3c434d', '#ebebf54d'],
		'--color-on-dark': '#ffffff',
		'--color-on-light': '#1d1d1f',
		'--color-on-accent': '#ffffff',
		'--color-on-success': ['#ffffff', '#1d1d1f'],
		'--color-on-error': ['#ffffff', '#1d1d1f'],
		'--color-on-warning': ['#ffffff', '#1d1d1f'],

		// Icon — same alpha ramp as the text tokens. A secondary glyph sits beside
		// secondary copy, so a 65%-vs-60% split read as two different greys on the
		// same row; the icon pair now matches the text pair stop for stop.
		'--color-icon-primary': ['#1d1d1f', '#f5f5f7'],
		'--color-icon-secondary': ['#3c3c4399', '#ebebf599'],
		'--color-icon-disabled': ['#3c3c434d', '#ebebf54d'],

		// ====================================================================
		// Status. Vivid stop at low alpha for the fill, accessible stop for the
		// text and icon — Apple ships both, and the pairing is the point: the
		// vivid stop is unreadable as text and the accessible stop is muddy as a
		// fill.
		//
		// The solid stops below are the accessible ones, because they are also
		// what `FieldStatus`, the input status borders and a destructive Button's
		// label read. Their `--color-on-*` partners are declared as mode pairs
		// next to the text ramp above; the light-mode accessible stops take white,
		// the bright dark-mode stops take ink.
		// ====================================================================
		'--color-success': ['#248a3d', '#30db5b'],
		'--color-error': ['#d70015', '#ff6961'],
		'--color-warning': ['#a05a00', '#ffd426'],
		'--color-success-muted': ['#34c75926', '#30d1582e'],
		'--color-error-muted': ['#ff3b3026', '#ff453a2e'],
		'--color-warning-muted': ['#ffcc0033', '#ffd60a2e'],

		// ====================================================================
		// Borders — hairlines, not lines. macOS separates surfaces with a
		// half-visible rim and lets the shadow do the lifting; a 1px solid grey
		// border on a translucent pane immediately reads as a web page.
		// ====================================================================
		'--color-border': ['#3c3c4326', '#ffffff1f'],
		'--color-border-emphasized': ['#3c3c434d', '#ffffff38'],

		// Effects
		'--color-skeleton': ['#7676801f', '#7676803d'],
		'--color-track': ['#7676803d', '#7676805c'],
		'--color-shadow': ['#00000026', '#00000080'],
		'--color-tint-hover': ['black', 'white'],

		// ====================================================================
		// Categorical hues — Apple's system colours, one per token group.
		//
		//   background  vivid @ 15% light / 18% dark
		//   border      vivid @ 35% light / 40% dark
		//   icon, text  the accessible variant
		//
		// The alpha fills are what let a coloured badge sit on glass without
		// punching an opaque hole through it.
		// ====================================================================

		// Red — systemRed #FF3B30 / #FF453A
		'--color-background-red': ['#ff3b3026', '#ff453a2e'],
		'--color-border-red': ['#ff3b3059', '#ff453a66'],
		'--color-icon-red': ['#d70015', '#ff6961'],
		'--color-text-red': ['#d70015', '#ff6961'],

		// Orange — systemOrange #FF9500 / #FF9F0A
		'--color-background-orange': ['#ff950026', '#ff9f0a2e'],
		'--color-border-orange': ['#ff950059', '#ff9f0a66'],
		'--color-icon-orange': ['#c93400', '#ffb340'],
		'--color-text-orange': ['#c93400', '#ffb340'],

		// Yellow — systemYellow #FFCC00 / #FFD60A. The fill runs a step heavier
		// than its neighbours: yellow sits at the luminance peak, so 15% over a
		// white-ish material is very nearly invisible.
		'--color-background-yellow': ['#ffcc0033', '#ffd60a2e'],
		'--color-border-yellow': ['#ffcc0059', '#ffd60a66'],
		'--color-icon-yellow': ['#a05a00', '#ffd426'],
		'--color-text-yellow': ['#a05a00', '#ffd426'],

		// Green — systemGreen #34C759 / #30D158
		'--color-background-green': ['#34c75926', '#30d1582e'],
		'--color-border-green': ['#34c75959', '#30d15866'],
		'--color-icon-green': ['#248a3d', '#30db5b'],
		'--color-text-green': ['#248a3d', '#30db5b'],

		// Teal — systemTeal #30B0C7 / #40C8E0
		'--color-background-teal': ['#30b0c726', '#40c8e02e'],
		'--color-border-teal': ['#30b0c759', '#40c8e066'],
		'--color-icon-teal': ['#008299', '#5de6ff'],
		'--color-text-teal': ['#008299', '#5de6ff'],

		// Cyan — systemCyan #32ADE6 / #64D2FF
		'--color-background-cyan': ['#32ade626', '#64d2ff2e'],
		'--color-border-cyan': ['#32ade659', '#64d2ff66'],
		'--color-icon-cyan': ['#0071a4', '#70d7ff'],
		'--color-text-cyan': ['#0071a4', '#70d7ff'],

		// Blue — systemBlue #007AFF / #0A84FF, the accent hue.
		'--color-background-blue': ['#007aff26', '#0a84ff2e'],
		'--color-border-blue': ['#007aff59', '#0a84ff66'],
		'--color-icon-blue': ['#0040dd', '#409cff'],
		'--color-text-blue': ['#0040dd', '#409cff'],

		// Purple — systemPurple #AF52DE / #BF5AF2
		'--color-background-purple': ['#af52de26', '#bf5af22e'],
		'--color-border-purple': ['#af52de59', '#bf5af266'],
		'--color-icon-purple': ['#8944ab', '#da8fff'],
		'--color-text-purple': ['#8944ab', '#da8fff'],

		// Pink — systemPink #FF2D55 / #FF375F
		'--color-background-pink': ['#ff2d5526', '#ff375f2e'],
		'--color-border-pink': ['#ff2d5559', '#ff375f66'],
		'--color-icon-pink': ['#d30f45', '#ff6482'],
		'--color-text-pink': ['#d30f45', '#ff6482'],

		// Gray — systemGray #8E8E93, the same value in both modes, as Apple has it.
		'--color-background-gray': ['#8e8e9326', '#8e8e932e'],
		'--color-border-gray': ['#8e8e9359', '#8e8e9366'],
		'--color-icon-gray': ['#6c6c70', '#98989d'],
		'--color-text-gray': ['#6c6c70', '#98989d'],

		// ====================================================================
		// Radius — concentric, in the Tahoe proportions. `--radius-full` is what
		// the capsule controls below reach for.
		// ====================================================================
		'--radius-none': '0px',
		'--radius-inner': '6px',
		'--radius-element': '10px',
		'--radius-container': '14px',
		'--radius-page': '26px',
		'--radius-chat': '20px',
		'--radius-full': '9999px',

		// ====================================================================
		// Shadows. Four parts, and each one is doing a job:
		//
		//   1. a tight contact shadow that seats the surface
		//   2. a wide soft shadow — macOS window shadows are enormous and faint
		//   3. an inset top highlight, the specular edge where light catches the
		//      lip of the pane; this is the single most identifiable Liquid Glass
		//      detail and no amount of blur substitutes for it
		//   4. a hairline inset rim, so a translucent surface still has an edge
		//      when it happens to sit over something the same colour as itself
		//
		// Parts 3 and 4 invert between modes: light mode's rim is a dark hairline
		// and its highlight is white, dark mode's rim *is* white.
		// ====================================================================
		'--shadow-low':
			'0 1px 1px light-dark(oklch(0 0 0 / 4%), oklch(0 0 0 / 40%)), ' +
			'0 4px 10px light-dark(oklch(0 0 0 / 6%), oklch(0 0 0 / 45%)), ' +
			'inset 0 1px 0 0 light-dark(oklch(1 0 0 / 65%), oklch(1 0 0 / 10%)), ' +
			'inset 0 0 0 1px light-dark(oklch(0 0 0 / 5%), oklch(1 0 0 / 8%))',
		'--shadow-med':
			'0 2px 4px light-dark(oklch(0 0 0 / 6%), oklch(0 0 0 / 45%)), ' +
			'0 10px 30px light-dark(oklch(0 0 0 / 10%), oklch(0 0 0 / 55%)), ' +
			'inset 0 1px 0 0 light-dark(oklch(1 0 0 / 75%), oklch(1 0 0 / 14%)), ' +
			'inset 0 0 0 1px light-dark(oklch(0 0 0 / 6%), oklch(1 0 0 / 10%))',
		'--shadow-high':
			'0 4px 8px light-dark(oklch(0 0 0 / 8%), oklch(0 0 0 / 50%)), ' +
			'0 24px 64px light-dark(oklch(0 0 0 / 14%), oklch(0 0 0 / 70%)), ' +
			'inset 0 1px 0 0 light-dark(oklch(1 0 0 / 85%), oklch(1 0 0 / 18%)), ' +
			'inset 0 0 0 1px light-dark(oklch(0 0 0 / 7%), oklch(1 0 0 / 12%))',

		// Selection and validation rings, on the system colours. Written with a
		// literal `light-dark()` rather than a [light, dark] pair because the pair
		// form compiles the *whole* value, and `light-dark()` takes colours only.
		'--shadow-inset-hover': 'inset 0 0 0 2px light-dark(#007aff40, #0a84ff4d)',
		'--shadow-inset-selected': 'inset 0 0 0 2px light-dark(#007aff80, #0a84ff99)',
		'--shadow-inset-success': 'inset 0 0 0 2px light-dark(#34c75966, #30d15866)',
		'--shadow-inset-warning': 'inset 0 0 0 2px light-dark(#ff950066, #ff9f0a66)',
		'--shadow-inset-error': 'inset 0 0 0 2px light-dark(#ff3b3066, #ff453a66)',

		// macOS's own sheet/sidebar curve: almost no ease-in, a long ease-out.
		// Motion that starts instantly and settles is what reads as responsive.
		'--ease-standard': 'cubic-bezier(0.32, 0.72, 0, 1)',

		// ====================================================================
		// Control heights.
		//
		// Derived rather than picked: Tahoe's regular control is about 1.55× the
		// body size once the capsule's padding is counted, which at base 15 puts
		// `md` at 34. `sm` is one 6px step down and `lg` one 8px step up.
		//
		// The first pass had these at 30/36/44, which was wrong in a specific
		// way worth naming: 44 is the *iOS* touch target, and reaching it makes a
		// desktop theme read as a phone theme. macOS controls are compact.
		//
		// The **spacing scale is deliberately untouched.** Astryx's default is
		// already Apple's 4pt grid (4/8/12/16/20/24/…) step for step, so there is
		// nothing here to correct — what actually needed setting is which step
		// each container spends, which is the `padding` overrides below.
		// ====================================================================
		'--size-element-sm': '28px',
		'--size-element-md': '34px',
		'--size-element-lg': '42px'
	},

	components: {
		// ================================================================
		// Capsules. Tahoe rounded every free-standing control to a full
		// capsule; these are the controls that are free-standing.
		// ================================================================
		button: {
			base: {
				...squircle(FULL),
				...STATE_TRANSITION
			},
			// The glass capsule button — the signature control of the whole
			// design language, and the one place the material is worth paying
			// for on something small. All three properties are set rather than
			// two, so the result does not depend on what the variant's default
			// fill happened to be.
			//
			// `border-color` alone was dead CSS before this pass: `Button`'s base
			// sets `border-width: 0; border-style: none`, so the hairline rim this
			// theme meant to draw never rendered. The width and style are set here,
			// inside the fixed control height, which is what makes the colour mean
			// something again.
			'variant:secondary': {
				backgroundColor: ['#ffffff8f', '#ffffff1f'],
				borderWidth: '1px',
				borderStyle: 'solid',
				borderColor: ['#3c3c4326', '#ffffff2e'],
				...glass('thin')
			}
		},

		// The semantic variants (`info` / `success` / `warning` / `error`) are
		// deliberately **not** re-pointed at the tinted hue tokens. Doing that made
		// each semantic badge identical to its categorical twin — `info` and
		// `blue`, `success` and `green`, `error` and `red`, `warning` and `yellow`
		// all resolved to the same background and text pair, so two different
		// states rendered as one. Core's solids stay, and the `--color-on-*` pairs
		// above make them legible in both modes. The tinted treatment remains
		// where it belongs: the categorical variants, whose hue *is* the label.
		badge: {
			base: {
				...squircle(FULL),
				fontWeight: 'var(--font-weight-medium)'
			}
		},

		'toggle-button': { base: squircle(FULL) },
		// An interactive Token is a chip: it paints its hover/pressed state from
		// the shared overlay, and core's own transition there only names
		// `background-image`. The shared state transition covers the colour and
		// shadow halves as well, so a chip's state change matches every other
		// control's.
		token: {
			base: {
				...squircle(FULL),
				...STATE_TRANSITION
			}
		},
		kbd: { base: squircle('var(--radius-inner)') },
		field: { base: squircle('var(--radius-element)') },
		// No `chat` entry, though the derived-var registry has one: nothing
		// renders `themeProps('chat')`, so `.astryx-chat` matches no element and
		// the rule would be dead. The composer reads
		// `var(--_chat-composer-radius, var(--radius-chat))`, and `--radius-chat`
		// is set above — so the shape lands through the token either way.

		// A segmented control is a capsule holding capsules, which is the one
		// concentric pair that needs no arithmetic — two capsules are concentric
		// at any size. The 2px inset is macOS's.
		//
		// The selected segment's fill is `--color-background-surface`, so the
		// theme's translucent window-chrome value made the "raised" pill
		// see-through over the track — in dark mode it read as the track showing
		// through a grey smudge rather than as an opaque selected face. The
		// control supplies the opaque control-background pair locally, the same
		// scoped-token trick core's own neutral theme uses for the switch track.
		'segmented-control': {
			base: {
				...glass('thin', FULL),
				padding: '2px',
				'--color-background-surface': ['#ffffff', '#636366']
			}
		},
		'segmented-control-item': { base: squircle(FULL) },

		// ================================================================
		// Floating surfaces — the regular material. These sit above content
		// and are what a person actually reads through.
		// ================================================================
		popover: { base: glass('regular', 'var(--radius-container)') },
		'hover-card': { base: glass('regular', 'var(--radius-container)') },
		// `dropdown-menu` is the one menu container with a padding seam in the
		// derived-var registry — i.e. the one upstream designed to take an inset
		// from a theme — so it is the only one given one. The others keep their
		// own padding; their rows still get the concentric radius below, which is
		// the right size for a 14px container regardless of who sets the inset.
		'dropdown-menu': {
			base: { ...glass('regular', 'var(--radius-container)'), padding: 'var(--glass-menu-inset)' }
		},
		'context-menu': { base: glass('regular', 'var(--radius-container)') },
		'trigger-menu': { base: glass('regular', 'var(--radius-container)') },
		'tab-menu-dropdown': { base: glass('regular', 'var(--radius-container)') },
		'typeahead-dropdown': { base: glass('regular', 'var(--radius-container)') },
		'nav-heading-menu': { base: glass('regular', 'var(--radius-container)') },
		toast: { base: glass('regular', 'var(--radius-container)') },

		// ================================================================
		// The rows inside those menus, each concentric with its container —
		// `inner = outer − inset`. macOS never runs a selection highlight to
		// the edge of the menu it sits in.
		// ================================================================
		'dropdown-menu-item': {
			base: {
				...concentric('var(--radius-container)', 'var(--glass-menu-inset)'),
				...STATE_TRANSITION
			}
		},
		'typeahead-item': {
			base: {
				...concentric('var(--radius-container)', 'var(--glass-menu-inset)'),
				...STATE_TRANSITION
			}
		},
		'command-palette-item': {
			base: {
				...concentric('var(--radius-container)', 'var(--glass-menu-inset)'),
				...STATE_TRANSITION
			}
		},
		'tab-menu-item': {
			base: {
				...concentric('var(--radius-container)', 'var(--glass-menu-inset)'),
				...STATE_TRANSITION
			}
		},
		'nav-heading-menu-item': {
			base: {
				...concentric('var(--radius-container)', 'var(--glass-menu-inset)'),
				...STATE_TRANSITION
			}
		},
		'selector-option': {
			base: {
				...concentric('var(--radius-container)', 'var(--glass-menu-inset)'),
				...STATE_TRANSITION
			}
		},

		// Sidebar rows are the other floating-highlight case, but they sit in a
		// panel rather than a small rounded menu, so there is no container radius
		// to be concentric with — macOS just gives them their own soft rounding.
		'side-nav-item': {
			base: {
				...squircle('var(--radius-element)'),
				...STATE_TRANSITION
			}
		},
		'tree-list-item': {
			base: {
				...squircle('var(--radius-element)'),
				...STATE_TRANSITION
			}
		},

		// ================================================================
		// Sheets, chrome and anything that covers the window — the thick
		// material, which is what macOS uses when the thing behind must read
		// as *behind* rather than as merely dimmed.
		// ================================================================
		// 20px is macOS's window margin, and sheets are windows.
		dialog: {
			base: { ...glass('thick', 'var(--radius-page)'), padding: 'var(--spacing-5)' }
		},
		'alert-dialog': { base: glass('thick', 'var(--radius-page)') },
		'top-nav-mega-menu': { base: glass('thick') },
		'mobile-nav': { base: glass('thick') },
		'app-shell-header': { base: glass('thick') },
		'app-shell-sidenav': { base: glass('thick') },
		'top-nav': { base: glass('thick') },
		'side-nav': { base: glass('thick') },
		'layout-header': { base: glass('thick') },
		'layout-footer': { base: glass('thick') },
		'layout-panel': { base: glass('regular') },
		toolbar: { base: glass('regular') },

		// The scrim behind a sheet blurs as well as dims, which is why a macOS
		// sheet reads as focus rather than as an overlay.
		'overlay-scrim': { base: glass('thin') },

		// ================================================================
		// Content.
		// ================================================================
		// 16px — one step under the window margin, which is the relationship
		// macOS keeps between a box inside a window and the window itself.
		//
		// The state transition is here for the two interactive card components:
		// `SelectableCard` transitions its selection ring from this same element
		// and `ClickableCard` animates its overlay, but neither carries a
		// reduced-motion branch, and a plain `Card` never transitioned its own
		// surface at all. This makes the disabled dim, the selection ring and a
		// mode flip all move together.
		card: {
			base: {
				...glass('thin', 'var(--radius-container)'),
				padding: 'var(--spacing-4)',
				...STATE_TRANSITION
			}
		},
		section: { base: { padding: 'var(--spacing-4)' } },
		banner: { base: squircle('var(--radius-container)') },

		// The off-state track. `--color-background-gray` is the categorical
		// gray fill, which at 15% is too faint to read as a channel at switch
		// size; systemFill is the value macOS actually uses here.
		switch: {
			base: { '--color-background-gray': ['#78788033', '#7878805c'] }
		},

		// The thumb is a control fill, not a window surface. It inherited
		// `--color-background-surface`, which this theme makes translucent — so
		// the knob took 28% of whatever it sat on, and on the accent-filled track
		// that meant a blue-tinted (light) or navy-grey (dark) knob instead of
		// white. macOS's switch knob is opaque white in both appearances.
		'switch-thumb': {
			base: { backgroundColor: '#ffffff' }
		},

		// The same problem in the number badge: a completed/in-progress Step
		// draws its digit in `--color-background-surface` over the accent fill,
		// which a translucent surface turns into a blue-tinted digit — and in dark
		// mode a dark one on systemBlue. The digit is white-on-accent, so the
		// badge itself supplies an opaque white locally. Targeted at the indicator
		// rather than the Step root so an input or nested surface inside a Step's
		// custom content keeps the theme's real surface token.
		'step-indicator': {
			base: { '--color-background-surface': '#ffffff' }
		},

		// A Tooltip inverts: its surface is `--color-text-primary` and its text is
		// `--color-background-surface`. With this theme's translucent surface the
		// label came out at ~72% alpha — grey text on a black tooltip — so the
		// inverted pair is stated explicitly instead of borrowed.
		tooltip: {
			base: { color: ['#ffffff', '#1d1d1f'] }
		},

		// ================================================================
		// SF's optical tracking.
		//
		// The system face is tracked *by size*, not uniformly: Apple's published
		// table runs from -1.05px at 34pt to +0.15px at 11pt, crossing zero at
		// about 15pt. Large text tightens, small text opens up. Ignoring it is
		// what makes a system-font page look like a system-font page rather than
		// like macOS — big headings in untracked SF read conspicuously loose.
		//
		// Converted to `em` so the ratio survives any rescaling, and thinned to
		// the sizes where it is actually visible. The table is flat at about
		// -0.03em from 20px up, so h1/h2 and all three display sizes share a
		// value; h3 and `large` sit at 18px, between Apple's -0.0253 (17pt) and
		// -0.030 (20pt); h4/body/label/code land on the ~15px zero crossing and
		// get no declaration at all. h5 and `supporting` are omitted for the same
		// reason — Apple's 13pt value is +0.002em, which is not a thing anyone
		// can see.
		//
		// These merge *into* the entries `expandTypeScale` generates rather than
		// replacing them: `deepMergeComponents` merges three levels deep, so the
		// generated `fontSize`/`lineHeight`/`fontWeight` survive alongside.
		// ================================================================
		heading: {
			'level:1': { letterSpacing: '-0.03em' },
			'level:2': { letterSpacing: '-0.03em' },
			'level:3': { letterSpacing: '-0.026em' },
			'level:6': { letterSpacing: '0.014em' }
		},
		text: {
			'type:display-1': { letterSpacing: '-0.03em' },
			'type:display-2': { letterSpacing: '-0.03em' },
			'type:display-3': { letterSpacing: '-0.03em' },
			'type:large': { letterSpacing: '-0.026em' }
		},

		// Solid system colours rather than the accessible text stops the
		// semantic tokens carry — a status dot is 8px of pure fill, and the
		// darkened text variants read as mud at that size.
		'status-dot': {
			'variant:accent': { backgroundColor: ['#007aff', '#0a84ff'] },
			'variant:success': { backgroundColor: ['#34c759', '#30d158'] },
			'variant:warning': { backgroundColor: ['#ff9500', '#ff9f0a'] },
			'variant:error': { backgroundColor: ['#ff3b30', '#ff453a'] }
		}
	}
});
