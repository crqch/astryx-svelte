import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	durationVars,
	easeVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';

const indeterminateSlide = stylex.keyframes({
	'0%': {
		transform: 'translateX(-100%)'
	},
	'100%': {
		transform: 'translateX(250%)'
	}
});

// RTL: mirror the slide so the indeterminate bar travels along the reading
// flow (inline-start → inline-end, i.e. right → left) instead of always
// physically left → right. The magnitudes mirror the LTR keyframe.
const indeterminateSlideRtl = stylex.keyframes({
	'0%': {
		transform: 'translateX(100%)'
	},
	'100%': {
		transform: 'translateX(-250%)'
	}
});

// Under reduced motion the indeterminate fill stops travelling and pulses in
// place. It goes from full opacity down to the pulse's floor
// (`--_progress-bar-pulse-floor`, the progress table's) and back. The
// animation alternates direction each pass.
const indeterminatePulse = stylex.keyframes({
	from: {
		opacity: 1
	},
	to: {
		opacity: 'var(--_progress-bar-pulse-floor)'
	}
});

const styles = stylex.create({
	container: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-1'],
		width: '100%',
		minWidth: '48px'
	},
	header: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'baseline'
	},
	label: {
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		color: colorVars['--color-text-primary']
	},
	labelDisabled: {
		color: colorVars['--color-text-disabled']
	},
	valueLabel: {
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading'],
		fontWeight: fontWeightVars['--font-weight-normal'],
		color: colorVars['--color-text-secondary']
	},
	valueLabelDisabled: {
		color: colorVars['--color-text-disabled']
	},
	// The label keeps its place in the header row when hidden, rather than being
	// swapped for the VisuallyHidden component — otherwise the value label
	// beside it would lose its `space-between` partner and drift left.
	visuallyHidden: {
		position: 'absolute',
		width: '1px',
		height: '1px',
		padding: 0,
		margin: '-1px',
		overflow: 'hidden',
		clip: 'rect(0, 0, 0, 0)',
		whiteSpace: 'nowrap',
		borderWidth: 0
	},
	// The in-flow track determines this containing block's actual height.
	// Marks share its geometry without depending on the label row's height or
	// entering the progressbar's presentational subtree. Keep it unclipped so
	// themed tall marks can overhang the track symmetrically.
	trackContainer: {
		position: 'relative',
		width: '100%'
	},
	// The semantic rail holds only the fill and clips it to the rounded rail:
	// the determinate fill slides in from the inline-start side and the
	// indeterminate one overshoots both ends. Marks live outside the track (in
	// trackContainer), so the clip never cuts a themed tall mark.
	track: {
		width: '100%',
		height: '8px',
		backgroundColor: colorVars['--color-background-muted'],
		borderRadius: radiusVars['--radius-full'],
		overflow: 'hidden'
	},
	// The determinate fill spans the whole track and slides along it with a
	// transform, so a value change animates on the compositor and keeps moving
	// while a script runs; animating `width` would lay out and repaint on the
	// main thread every frame and stall with it. `--_progress-bar-fill` is the
	// filled share of the track (set inline); the fill's leading edge sits
	// exactly there, mirrored in RTL. The mirror follows the bar's own
	// direction (`:dir(rtl)`, the nearest `dir`), not any RTL ancestor, so a bar
	// in an LTR region of an RTL page fills from the left like its label and
	// marks. The layer is declared up front so Safari has the whole bar painted
	// before it first moves.
	//
	// Under forced colors the fill is sized to the value instead (its `width`,
	// no transform), as before: the track's clip would cut the CanvasText
	// outline's start cap off a slid fill, and that outline is what keeps the
	// fill's shape visible there (architecture:theme-tokens INV11).
	//
	// Under a finger (TOUCH_QUERY, on every touch device), the fill moves as
	// UIProgressView's setProgress(_:animated: true) does. It moves linearly
	// from wherever it is drawn. Its duration is the `progress.fillTrackMs` role
	// times the share of the track the value moved (`--_progress-bar-move`).
	// Its curve is the `progress.curves.fill` role (`--_progress-bar-curve`).
	// The touch layer (ProgressBarTouch) writes both, and this rule scales the
	// duration by the theme's tempo. Above zero, the fill never draws shorter
	// than the touch minimum (`--_progress-bar-min`, 16px on the 8px track). At
	// zero it paints nothing (`fillEmpty`). Under reduced motion it lands at
	// once, as everywhere (below). A mouse or trackpad keeps the theme's timing.
	fill: {
		width: {
			default: '100%',
			'@media (forced-colors: active)': {
				default: 'var(--_progress-bar-fill, 0%)',
				'@media (pointer: coarse)':
					'calc(max(var(--_progress-bar-fill, 0%), var(--_progress-bar-min, 0px)) + var(--_progress-bar-flip, 0) * 0.01px)'
			}
		},
		height: '100%',
		// Forced colors replace status fills with Canvas; this boundary keeps the
		// fill's shape visible (architecture:theme-tokens INV11).
		outlineWidth: { default: null, '@media (forced-colors: active)': '1px' },
		outlineStyle: { default: null, '@media (forced-colors: active)': 'solid' },
		outlineColor: {
			default: null,
			'@media (forced-colors: active)': 'CanvasText'
		},
		outlineOffset: { default: null, '@media (forced-colors: active)': '-1px' },
		borderRadius: radiusVars['--radius-full'],
		transform: {
			default: 'translateX(calc(var(--_progress-bar-fill, 0%) - 100%))',
			':dir(rtl)': {
				default: 'translateX(calc(100% - var(--_progress-bar-fill, 0%)))',
				'@media (forced-colors: active)': 'none'
			},
			'@media (pointer: coarse)': {
				// `--_progress-bar-flip` steps 0, 1, 2, 0… on every change. It moves
				// the fill by that many hundredths of a pixel. So a change back to the
				// value it just left is never the running transition's own start
				// value. CSS shortens a transition that reverses to its start, which
				// would halve a return mid-flight (10 → 90 → 10). It takes three
				// values because two would repeat on that return.
				default:
					'translateX(calc(max(var(--_progress-bar-fill, 0%), var(--_progress-bar-min, 0px)) - 100% + var(--_progress-bar-flip, 0) * 0.01px))',
				':dir(rtl)':
					'translateX(calc(min(calc(100% - var(--_progress-bar-fill, 0%)), calc(100% - var(--_progress-bar-min, 0px))) - var(--_progress-bar-flip, 0) * 0.01px))'
			},
			// After the touch key, so StyleX negates that key under forced colors.
			'@media (forced-colors: active)': 'none'
		},
		willChange: {
			default: 'transform',
			'@media (forced-colors: active)': 'auto'
		},
		transitionProperty: {
			default: 'transform',
			'@media (forced-colors: active)': 'width'
		},
		// Under reduced motion a new value lands at once, with a mouse as with a
		// finger: the fill never travels. The keys are the shared reduced-motion
		// queries, as the other transitions spell them. The coarse key comes after
		// the touch key, so it wins there.
		transitionDuration: {
			default: durationVars['--duration-medium'],
			// The touch layer's move (the `progress.fillTrackMs` role times the
			// share moved), scaled by the theme's tempo.
			'@media (pointer: coarse)': {
				default: 'calc(var(--_progress-bar-move, 0ms) * var(--_astryx-motion-tempo, 1))',
				// Under forced colors the fill is sized by `width` instead. Touch
				// motion never animates a layout property, so with a finger the new
				// size lands at once there.
				'@media (forced-colors: active)': '0s'
			},
			'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': '0s',
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': '0s'
		},
		transitionTimingFunction: {
			default: easeVars['--ease-standard'],
			'@media (pointer: coarse)': 'var(--_progress-bar-curve, linear)'
		}
	},
	fillEmpty: {
		opacity: {
			default: null,
			'@media (pointer: coarse)': 0
		}
	},
	indeterminateFill: {
		height: '100%',
		// Forced colors replace status fills with Canvas; this boundary keeps the
		// fill's shape visible (architecture:theme-tokens INV11).
		outlineWidth: { default: null, '@media (forced-colors: active)': '1px' },
		outlineStyle: { default: null, '@media (forced-colors: active)': 'solid' },
		outlineColor: {
			default: null,
			'@media (forced-colors: active)': 'CanvasText'
		},
		outlineOffset: { default: null, '@media (forced-colors: active)': '-1px' },
		// Under reduced motion, on every pointer, the fill spans the whole track
		// as one solid bar, and only its opacity pulses. Each way takes the
		// `progress.reducedMotionPulseMs` role on the `timing.curves.move` curve
		// (`--_progress-bar-pulse`, `--_progress-bar-pulse-curve`, set inline from
		// the progress table). A busy loop: tempo does not scale it.
		width: {
			default: '40%',
			'@media (prefers-reduced-motion: reduce)': '100%'
		},
		borderRadius: radiusVars['--radius-full'],
		animationName: {
			default: indeterminateSlide,
			':is([dir="rtl"] *)': {
				default: indeterminateSlideRtl,
				'@media (prefers-reduced-motion: reduce)': indeterminatePulse
			},
			'@media (prefers-reduced-motion: reduce)': indeterminatePulse
		},
		animationDuration: {
			default: '1.5s',
			'@media (prefers-reduced-motion: reduce)': 'var(--_progress-bar-pulse)'
		},
		animationTimingFunction: {
			default: 'ease-in-out',
			'@media (prefers-reduced-motion: reduce)': 'var(--_progress-bar-pulse-curve)'
		},
		animationDirection: {
			default: null,
			'@media (prefers-reduced-motion: reduce)': 'alternate'
		},
		animationIterationCount: 'infinite'
	},
	// A mark is a vertical tick centred on the track via their shared positioning
	// container. It stays outside `role="progressbar"` so it remains
	// independently focusable. The mark's height — 8px by default — may exceed
	// the bar and overhang; the centring translate keeps any overhang symmetric.
	// Positioned horizontally via `insetInlineStart`; the translate mirrors under
	// RTL.
	//
	// The dimensions read private vars rather than being plain declarations: a
	// theme writes `width`/`height` on the `progressbar-mark` target as usual and
	// the derived-var registry emits them as these vars instead of as competing
	// properties. Nothing else declares them, so the theme value lands whatever
	// the consumer's cascade looks like — a source-build app that compiles StyleX
	// without `useCSSLayers` leaves the atomics unlayered, where they outrank
	// every rule in `@layer astryx-theme` and made sizing the mark impossible
	// without `!important`.
	//
	// The tick's colour is not set here: it depends on what the mark sits on, so
	// it comes from `markOnFillStyles[variant]` (mark inside the filled area) or
	// `markOnTrackStyles.track` (mark out on the bare track).
	mark: {
		position: 'absolute',
		top: '50%',
		width: 'var(--_progressbar-mark-width, 2px)',
		height: 'var(--_progressbar-mark-height, 8px)',
		transform: {
			default: 'translate(-50%, -50%)',
			':is([dir="rtl"] *)': 'translate(50%, -50%)'
		}
	}
});

const variantStyles = stylex.create({
	accent: {
		backgroundColor: colorVars['--color-accent']
	},
	success: {
		backgroundColor: colorVars['--color-success']
	},
	warning: {
		backgroundColor: colorVars['--color-warning']
	},
	error: {
		backgroundColor: colorVars['--color-error']
	},
	neutral: {
		backgroundColor: colorVars['--color-text-disabled']
	},
	disabled: {
		backgroundColor: colorVars['--color-text-disabled']
	}
});

// A mark sitting inside the filled area is drawn *on* the bar, so it takes the
// on-colour that pairs with the fill's own variant colour — the same pairing
// Badge uses for solid semantic backgrounds.
//
// `neutral` and `disabled` both fill with the muted `--color-text-disabled`
// grey, which carries no semantic weight and has no dedicated on-token, so they
// fall back to a plain foreground. They pick different ones: a `neutral` bar is
// live, so its mark keeps the full-contrast `--color-text-primary` a mark uses
// out on the track; a `disabled` bar is deliberately low-emphasis — its own
// label and value text drop to muted colours — so its mark steps down to
// `--color-text-secondary` rather than becoming the loudest thing on a
// greyed-out component.
const markOnFillStyles = stylex.create({
	accent: {
		backgroundColor: colorVars['--color-on-accent']
	},
	success: {
		backgroundColor: colorVars['--color-on-success']
	},
	warning: {
		backgroundColor: colorVars['--color-on-warning']
	},
	error: {
		backgroundColor: colorVars['--color-on-error']
	},
	neutral: {
		backgroundColor: colorVars['--color-text-primary']
	},
	disabled: {
		backgroundColor: colorVars['--color-text-secondary']
	}
});

// A mark out on the bare track is a foreground tick over the muted track
// background, so it takes `--color-text-primary`.
//
// The obvious candidate was `--color-border-emphasized` — the emphasized
// divider colour `Divider`'s `strong` variant and `Slider`'s marks use — but
// divider tokens sit a step or two from the track on the same neutral ramp, so
// a mark drawn in one is at or near invisible: measured against each shipped
// theme's track it lands between 1.00:1 (theme-neutral, both modes, where the
// track is aliased to that very token) and 2.9:1, under the 3:1 WCAG 1.4.11
// non-text floor in 7 of 8 themes. `--color-text-secondary` still misses in
// two. `--color-text-primary` is the one foreground guaranteed to read against
// every surface a theme defines: 5.8:1 to 15.7:1 on the track across all themes
// and both modes.
const markOnTrackStyles = stylex.create({
	track: {
		backgroundColor: colorVars['--color-text-primary']
	},
	// A disabled bar dims everything it draws, so its track marks step down to
	// the secondary foreground for the same reason the disabled on-fill mark
	// does — matching the muted label and value text.
	trackDisabled: {
		backgroundColor: colorVars['--color-text-secondary']
	}
});

/**
 * Extensible variant map for ProgressBar.
 *
 * Theme packages add their own variants by augmenting this interface:
 *
 * @example
 * declare module '@astryx-svelte/core' {
 *   interface ProgressBarVariantMap {
 *     brand: true;
 *   }
 * }
 */
export interface ProgressBarVariantMap {
	accent: true;
	success: true;
	warning: true;
	neutral: true;
	error: true;
}

/** ProgressBar variant, mapped to a semantic colour token. */
export type ProgressBarVariant = keyof ProgressBarVariantMap;

/** The variant actually painted on the fill — `disabled` overrides the rest. */
export type ProgressBarFillVariant = ProgressBarVariant | 'disabled';

export function progressBarContainerAttrs(xstyle?: StyleArg): SvelteStyleAttrs {
	return sx(styles.container, xstyle);
}

export function progressBarHeaderAttrs(): SvelteStyleAttrs {
	return sx(styles.header);
}

export function progressBarLabelAttrs(
	isLabelHidden: boolean,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		styles.label,
		isLabelHidden && styles.visuallyHidden,
		isDisabled && styles.labelDisabled
	);
}

export function progressBarValueLabelAttrs(isDisabled: boolean): SvelteStyleAttrs {
	return sx(styles.valueLabel, isDisabled && styles.valueLabelDisabled);
}

export function progressBarTrackContainerAttrs(): SvelteStyleAttrs {
	return sx(styles.trackContainer);
}

export function progressBarTrackAttrs(): SvelteStyleAttrs {
	return sx(styles.track);
}

/**
 * A mark's colour follows what it sits on: inside the fill it takes the fill
 * variant's on-colour, out on the bare track the plain foreground — stepped
 * down to the secondary one when the bar is disabled.
 */
export function progressBarMarkAttrs(
	variant: ProgressBarFillVariant,
	isOnFill: boolean,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		focusOutlineStyles.focusVisible,
		styles.mark,
		isOnFill
			? markOnFillStyles[variant as keyof typeof markOnFillStyles]
			: isDisabled
				? markOnTrackStyles.trackDisabled
				: markOnTrackStyles.track
	);
}

export function progressBarFillAttrs(
	variant: ProgressBarFillVariant,
	isIndeterminate: boolean,
	isEmpty: boolean
): SvelteStyleAttrs {
	return sx(
		isIndeterminate ? styles.indeterminateFill : styles.fill,
		isEmpty && styles.fillEmpty,
		variantStyles[variant as keyof typeof variantStyles]
	);
}
