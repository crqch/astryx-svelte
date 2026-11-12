import * as stylex from '@stylexjs/stylex';
import { colorVars, spacingVars } from '../../styles/tokens.stylex.js';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerShade = 'default' | 'subtle' | 'onMedia' | 'inherit';

/**
 * The fraction of the ring the arc covers. The canvas ring this replaces
 * swept 135deg, not the 270deg its constant's comment claimed.
 *
 * Themeable via `--spinner-arc-fraction`, declared alongside the other public
 * vars in `sizeStyles` below. Only the inline `strokeDasharray` attribute
 * (the pre-stylesheet render) still reads the constant directly; the CSS side
 * composes the dash from the live var.
 */
export const ARC_FRACTION = 0.375;

const PI = 3.141592653589793;

export const SIZES: Record<SpinnerSize, { diameter: number; border: number }> = {
	sm: { diameter: 10, border: 2 },
	md: { diameter: 14, border: 3 },
	lg: { diameter: 18, border: 3 },
	xl: { diameter: 28, border: 4 }
};

/**
 * Opacity the track is drawn at, per shade. `77 / 255` is the `4D` the onMedia
 * track used to append to the token's hex — the same composite, but applied as
 * `stroke-opacity` to a color off the cascade, so it no longer depends on the
 * token being hex notation and it applies to a themed color too.
 */
const TRACK_OPACITY: Record<SpinnerShade, number> = {
	default: 1,
	subtle: 1,
	onMedia: 77 / 255,
	inherit: 0.3
};

/**
 * Where the resolved geometry lands: the public var, resolved into a registered
 * `<length>` the `calc()`s below can do arithmetic on. The box and the ring
 * read these; the public vars are declared once, on the element carrying the
 * theme target, by `sizeStyles`.
 */
const RESOLVED_DIAMETER = '--_spinner-ring-diameter';
const RESOLVED_STROKE = '--_spinner-ring-stroke';
const RESOLVED_GEOMETRY_VARS = [RESOLVED_DIAMETER, RESOLVED_STROKE];

/**
 * The composed box size: diameter plus a stroke width on each side.
 *
 * It is deliberately NOT registered, unlike the pair above. The element reads
 * it through an inline `width`/`height` with the size's own default as the
 * `var()` fallback, so a render with no stylesheet — where nothing declares
 * it — still sizes the box the way it always did. A registered property always
 * has a value (its `initial-value`), which would swallow that fallback and
 * collapse the box to zero.
 */
export const BOX_SIZE = '--_spinner-box-size';

/**
 * Register the resolved geometry vars as `<length>`.
 *
 * Both are consumed inside `calc()` — the box adds two stroke widths to a
 * diameter, the circle halves one. Unregistered, a custom property substitutes
 * as text, so whatever a theme wrote lands in the expression verbatim and a
 * bare `0` (a valid length on its own, a `<number>` inside `calc()`) poisons
 * the sum: `calc(28px + 0 * 2)` is invalid at computed-value time and the box
 * loses its size. Registered, the value is already an absolute length by the
 * time the `calc()` sees it, so `0` means `0px` — a zero-width stroke that
 * paints nothing — rather than a bare `0` that invalidates the sum and leaves
 * the box with no size at all. One `stroke-width` drives both circles, so a
 * themed stroke width of `0` hides the arc along with the track; an arc with no
 * track behind it is `--spinner-track-color: transparent`.
 *
 * Only these private vars are registered. The four public ones deliberately are
 * not: a registered property has an `initial-value`, so every element in the
 * document would report a value for it, and a var-reachability audit that finds
 * a var's declaring element by exactly that test would be pointed at `<html>`.
 */
function registerSpinnerVars(): void {
	if (typeof CSS === 'undefined' || typeof CSS.registerProperty !== 'function') {
		return;
	}
	for (const name of RESOLVED_GEOMETRY_VARS) {
		try {
			CSS.registerProperty({
				name,
				syntax: '<length>',
				inherits: true,
				initialValue: '0px'
			});
		} catch {
			// Already registered — a second copy of the package on the page, or a
			// hot-reload re-evaluation. registerProperty throws rather than
			// replacing, and the existing registration is this same one.
		}
	}
}

// Registering an inherited property with an `initial-value` invalidates style
// for the whole document, so this runs when the module is evaluated rather than
// when a spinner mounts. A spinner is the loading indicator: it mounts onto a
// page that is already rendered, with someone already waiting, and the recalc it
// triggers there is paid on the full tree. At import the tree is whatever has
// rendered so far, which for a bundle loaded in the head is nothing.
//
// It is safe at module scope in both directions. The `typeof CSS` guard above
// keeps it out of the server render, and tree-shaking cannot strip it from a
// build that renders a spinner: a bundle that never imports `Spinner` drops this
// module whole — registration and all, which is the outcome you want — while one
// that does import it keeps the module, and a bare call is not something a
// bundler may elide.
registerSpinnerVars();

const styles = stylex.create({
	wrapper: {
		display: 'inline-flex',
		flexDirection: 'column',
		alignItems: 'center',
		gap: spacingVars['--spacing-2']
	},
	spinner: {
		display: 'inline-grid',
		placeItems: 'center',
		verticalAlign: 'middle',
		// The public geometry vars, resolved into the registered `<length>` pair
		// the arithmetic below needs. Reading them here rather than in each
		// `calc()` keeps one place where a themed value enters the component, and
		// it is the span that reads them whether the theme target is the span or
		// the wrapper — a custom property inherits either way.
		[RESOLVED_DIAMETER]: 'var(--spinner-diameter)',
		[RESOLVED_STROKE]: 'var(--spinner-stroke-width)',
		// The size of the box, composed here and applied as an inline style at the
		// element, so that the box and the drawn ring come from the same two vars
		// and a themed size moves both together — without the sizing moving from
		// an inline style to a rule, which would hand a caller's `style="width:…"`
		// a precedence over the box that it has never had.
		[BOX_SIZE]: `calc(var(${RESOLVED_DIAMETER}) + var(${RESOLVED_STROKE}) * 2)`,

		// The box is the ring's size, and a host does not get to take that away.
		//
		// `overflow: hidden` used to sit here, carried over from the canvas ring
		// this component no longer draws. It clipped nothing — the painted circle
		// is inscribed in the box, so hiding and showing the overflow render
		// byte-identical pixels at every size, every shade, the labelled case and
		// every rotation angle. What it did do is remove the floor under this box:
		// a flex item whose overflow is not `visible` has an automatic minimum
		// size of zero, so a narrow flex host was free to compress the box while
		// the ring kept drawing at the size its own attributes ask for, and then
		// the clip cut the ring off at the box edge.
		//
		// `flex-shrink: 0` then states the invariant directly rather than leaving
		// it to the automatic minimum size, which a host takes away again the
		// moment it sets `min-width: 0` on its items.
		flexShrink: 0
	},
	ring: {
		backfaceVisibility: 'hidden',
		display: 'block',
		// The track and the rotor share the one grid cell, stacked and centred.
		gridArea: '1 / 1',
		// The frame is the box, read from the same composed var the span is sized
		// from — not from the size constant, which a theme cannot reach, and not
		// from a percentage, which needs the grid area to be a definite size in
		// both axes.
		width: `var(${BOX_SIZE})`,
		height: `var(${BOX_SIZE})`,
		overflow: 'visible'
	},
	// The rotor is the frame's size, so it turns about the ring's centre.
	rotor: {
		display: 'block',
		gridArea: '1 / 1',
		width: `var(${BOX_SIZE})`,
		height: `var(${BOX_SIZE})`
	},
	circle: {
		fill: 'none',
		// The ring is centred on the box (cx/cy 50%), so the arc's start offset
		// pivots there too — as a CSS transform, since the SVG `transform`
		// attribute would need that centre as a number in user units.
		transformBox: 'fill-box',
		transformOrigin: 'center',
		strokeLinecap: 'round',
		// The geometry the ring is actually drawn at. `r` and `stroke-width` are
		// CSS properties on an SVG shape, and a CSS declaration outranks the
		// presentation attribute of the same name — so the attributes in the
		// markup stay as the size's default (and as what a server render and a
		// no-CSS render draw), and these take over the moment the cascade has a
		// themed value.
		r: `calc(var(${RESOLVED_DIAMETER}) / 2)`,
		strokeWidth: `var(${RESOLVED_STROKE})`
	},
	// The two ring colors ride `stroke` directly, read off the public vars the
	// shade declares. The paint comes from the cascade, so every notation a theme
	// can write — `var()`, `color-mix()`, and the `currentColor` the inherit
	// shade is built on — resolves where it is used, and a color changed after
	// mount repaints instead of going stale.
	//
	// The dash pattern is composed from the resolved diameter the same way, so a
	// themed ring keeps the same fraction of arc rather than the same absolute
	// dash. `pathLength` would be the shorter route to that, but it rescales the
	// pattern against the path length the UA measures on its own approximation of
	// the circle — 87.398 against the 87.965 of pi x 28 — which shortens the
	// default arc by 0.64% and moves the cap by half a pixel. Composing the
	// lengths keeps the default byte-identical to what it drew before.
	//
	// The fraction itself also rides a public var (`--spinner-arc-fraction`),
	// unregistered like the other three color/geometry public vars — it is
	// read as a bare `<number>` multiplier here, never summed with a unitless
	// `0` the way the registered length pair guards against, so it needs no
	// registration.
	arc: {
		stroke: 'var(--spinner-color)',
		transform: 'rotate(-90deg)',
		strokeDasharray: `calc(var(${RESOLVED_DIAMETER}) * ${PI} * var(--spinner-arc-fraction)) calc(var(${RESOLVED_DIAMETER}) * ${PI} * (1 - var(--spinner-arc-fraction)))`
	},
	track: { stroke: 'var(--spinner-track-color)' }
});

// What each named `size` and `shade` resolve to. Both groups DECLARE the four
// public vars, on the element that carries the `spinner` theme target, and
// everything downstream reads them — so a theme's `@layer astryx-theme` rule
// against `.astryx-spinner.xl` overrides the default the same way it does for
// `--tree-list-indent` or `--button-focus-offset`, e.g.
// spinner: { 'size:xl': { '--spinner-diameter': '40px' } }.
//
// Declaring is only safe because the compiled StyleX CSS moved inside
// `@layer astryx-base`. Before that, StyleX emitted custom-property
// declarations at priority 0 and therefore OUTSIDE its layers, and an unlayered
// declaration beats every layer — so a StyleX-declared `--spinner-diameter: 10px`
// shadowed the theme's own rule no matter how specific the theme got. The
// earlier revision worked around it by never declaring the public var and
// reading it with the default as a `var()` fallback; that is no longer
// necessary, and the fallback shape has a cost of its own — with nothing
// declaring the var, a reachability audit cannot find an element to check, so a
// documented var reads as unreachable.
// Arc fraction is not itself size-dependent, but it declares alongside the
// two vars that are, on the same per-size condition (`!hasLabel` gate at the
// call site) — it needs a home on whichever element carries the theme target,
// and this is the object already wired to be there.
const sizeStyles = stylex.create({
	sm: {
		'--spinner-diameter': `${SIZES.sm.diameter}px`,
		'--spinner-stroke-width': `${SIZES.sm.border}px`,
		'--spinner-arc-fraction': `${ARC_FRACTION}`
	},
	md: {
		'--spinner-diameter': `${SIZES.md.diameter}px`,
		'--spinner-stroke-width': `${SIZES.md.border}px`,
		'--spinner-arc-fraction': `${ARC_FRACTION}`
	},
	lg: {
		'--spinner-diameter': `${SIZES.lg.diameter}px`,
		'--spinner-stroke-width': `${SIZES.lg.border}px`,
		'--spinner-arc-fraction': `${ARC_FRACTION}`
	},
	xl: {
		'--spinner-diameter': `${SIZES.xl.diameter}px`,
		'--spinner-stroke-width': `${SIZES.xl.border}px`,
		'--spinner-arc-fraction': `${ARC_FRACTION}`
	}
});

/**
 * The two ring colours, one key per shade.
 *
 * These used to be resolved in JS: the canvas ring this replaces read
 * `getComputedStyle` to turn a token into an `rgb()` string a `strokeStyle`
 * would accept, through a `color` / `text-decoration-color` carrier pair. An
 * SVG `stroke` takes the token reference directly, so the cascade resolves both
 * rings — `light-dark()`, `var()` chains and a theme's in-position override
 * included — and nothing has to read a computed style to paint.
 */
const shadeStyles = stylex.create({
	default: {
		'--spinner-color': colorVars['--color-accent'],
		'--spinner-track-color': colorVars['--color-track']
	},
	subtle: {
		'--spinner-color': colorVars['--color-text-secondary'],
		'--spinner-track-color': colorVars['--color-track']
	},
	onMedia: {
		'--spinner-color': colorVars['--color-on-dark'],
		'--spinner-track-color': colorVars['--color-on-dark']
	},
	inherit: {
		'--spinner-color': 'currentColor',
		'--spinner-track-color': 'currentColor'
	}
});

// The track's alpha is a property, not a color: it composites over whatever
// color the shade or the theme supplies. `77 / 255` is the `4D` the onMedia
// token's hex used to carry.
const trackOpacityStyles = stylex.create({
	default: { strokeOpacity: TRACK_OPACITY.default },
	subtle: { strokeOpacity: TRACK_OPACITY.subtle },
	onMedia: { strokeOpacity: TRACK_OPACITY.onMedia },
	inherit: { strokeOpacity: TRACK_OPACITY.inherit }
});

/**
 * The labelled wrapper. It carries the theme target when a label renders, so the
 * four public vars are declared here and the span below inherits them.
 */
export function spinnerWrapperAttrs(
	size: SpinnerSize,
	shade: SpinnerShade,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return sx(styles.wrapper, sizeStyles[size], shadeStyles[shade], xstyle);
}

/**
 * The status span.
 *
 * The defaults are declared on whichever element carries the theme target, and
 * only there: when a label moves the target to the wrapper, this span must
 * inherit the wrapper's value rather than declare its own, which would shadow a
 * theme's override with the default it is trying to replace.
 */
export function spinnerAttrs(
	size: SpinnerSize,
	shade: SpinnerShade,
	hasLabel: boolean,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return sx(
		styles.spinner,
		!hasLabel && sizeStyles[size],
		!hasLabel && shadeStyles[shade],
		!hasLabel && xstyle
	);
}

export function spinnerRingAttrs(): SvelteStyleAttrs {
	return sx(styles.ring);
}

/** The rotor's frame, composed with `spinnerRotorStyles.turn` at its call site. */
export const spinnerRotorFrameStyle: StyleArg = styles.rotor;

export function spinnerTrackAttrs(shade: SpinnerShade): SvelteStyleAttrs {
	return sx(styles.circle, styles.track, trackOpacityStyles[shade]);
}

export function spinnerArcAttrs(): SvelteStyleAttrs {
	return sx(styles.circle, styles.arc);
}
