import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	spacingVars,
	radiusVars,
	durationVars,
	easeVars,
	typographyVars,
	typeScaleVars,
	focusVars,
	shadowVars
} from '../../styles/tokens.stylex.js';
import type { SizeValue } from '../../internal/types.js';
import { interactionOverlayStyles, pressVars } from '../../utils/interaction-overlay.stylex.js';
import { reducedMotionFadeConsts } from '../../motion/reduced-motion.stylex.js';

/** Switch's size tiers, new in 0.2.0. */
export type SwitchSize = 'sm' | 'md';
import { switchFocusInput, switchScope } from './switch.markers.stylex.js';

/**
 * A finger: utils/touch-queries.ts's TOUCH_QUERY. The touch presentation is
 * one model on every touch device.
 * SYNC: utils/touch-queries.ts TOUCH_QUERY.
 */
const TOUCH = '@media (pointer: coarse)';

/** The press controller's two states on the row it writes to. */
const PRESS_ON = '[data-astryx-press="on"]';
const PRESS_FADING = '[data-astryx-press="fading"]';

/**
 * The shared press release, for the press layers the switch fades on the
 * compositor: the theme's exit motion tokens, no longer than the Reduce
 * Motion fade under Reduce Motion.
 * SYNC: utils/interaction-overlay.stylex.ts PRESS_RELEASE_DURATION,
 * PRESS_RELEASE_DURATION_REDUCED and RELEASE_EASE.
 */
const PRESS_RELEASE_DURATION = durationVars['--duration-exit'];
const PRESS_RELEASE_DURATION_REDUCED = `min(${durationVars['--duration-exit']}, ${reducedMotionFadeConsts.duration})`;
const PRESS_RELEASE_EASE = easeVars['--ease-exit'];

// The pressed overlay, painted as a gradient layer OVER the track's and
// thumb's own fills so it composes with the on/off colors and the hover tint
// instead of replacing them. Same token Button's overlay paints with. The
// switch is a two-part control whose focusable input sits beside the track,
// so the press is read off the shared scope marker (the row), the way the
// hover tint already is: pressing the input, the track or the label all
// activate the row.
const pressedImage = `linear-gradient(${colorVars['--color-overlay-pressed']}, ${colorVars['--color-overlay-pressed']})`;

/** The touch press's release on the press layer: opacity 1 → 0. */
const pressLayerRelease = stylex.keyframes({
	from: { opacity: 1 },
	to: { opacity: 0 }
});

const PRESS_ALPHA = pressVars['--astryx-press-alpha'];

/**
 * The shared strength's release, restated so a fine pointer keeps it: the
 * same keyframes, so the same animation.
 */
const pressStrengthRelease = stylex.keyframes({
	from: { [PRESS_ALPHA]: 1 },
	to: { [PRESS_ALPHA]: 0 }
});

const pressOwnerStyles = stylex.create({
	/**
	 * Composed after `interactionOverlayStyles.pressedAlpha` on the row. Under
	 * a coarse primary pointer the track's and thumb's layers fade the press.
	 * So the strength holds through the release, not animated on the main
	 * thread. With any other pointer the row keeps `pressedAlpha`'s release.
	 */
	pressedAlphaLayered: {
		animationName: {
			default: null,
			[PRESS_FADING]: {
				default: pressStrengthRelease,
				'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': 'none',
				'@media (pointer: coarse)': 'none'
			}
		}
	}
});

/**
 * `Switch`'s styles, ported from Astryx's `Switch/Switch.tsx`.
 *
 * The track's focus outline and the off/on hover tints are entirely CSS via
 * `when.ancestor(..., switchScope)` — see `switch.markers.stylex.ts` for the
 * marker they resolve against. The dimensions are fixed pixels, transcribed
 * from upstream's constants below.
 */

/**
 * Switch's size tiers, new in 0.2.0. `md` reproduces the previous fixed
 * geometry exactly (40×24, 16px thumb off, 20px on, travel 14px), so the
 * default is unchanged; `sm` is the new 32×20 tier.
 *
 * Six separate groups rather than one, because each lands on a different
 * element (wrapper, hidden input, track, thumb-off, thumb-on, label wrapper)
 * and StyleX requires a static structure per call site — the same reason
 * upstream splits them.
 */
const wrapperSizeStyles = stylex.create({
	sm: { width: 32, height: 20 },
	md: { width: 40, height: 24 }
});

const trackSizeStyles = stylex.create({
	sm: { width: 32, height: 20, padding: 2 },
	md: { width: 40, height: 24, padding: 4 }
});

// The thumb is one circle under any pointer, at each state's size. Under a
// finger it rests by insets instead of a transform, centered in the track's
// height at each end. So the compositor moves and lifts it with translate and
// scale alone.
const thumbOffSizeStyles = stylex.create({
	sm: {
		width: 14,
		height: 14,
		insetInlineStart: { default: null, [TOUCH]: 3 },
		transform: {
			default: 'translateX(0)',
			[TOUCH]: 'none'
		}
	},
	md: {
		width: 16,
		height: 16,
		insetInlineStart: { default: null, [TOUCH]: 4 },
		transform: {
			default: 'translateX(0)',
			[TOUCH]: 'none'
		}
	}
});

/**
 * The thumb's travel when on — and the one place in this module that needs an
 * explicit RTL branch, since `transform` has no logical form. The thumb rests at
 * the inline-start edge (flex-start, which flexbox already mirrors under RTL);
 * the on-state travel toward the inline-end edge is a physical `translateX`, so
 * it must flip sign under RTL — right in LTR, left in RTL — so the switch
 * mirrors per convention (Material, iOS): off-thumb on the reading-start side,
 * on-thumb on the reading-end.
 *
 * **This divergence has now closed.** At 0.2.0 the pair was followed from the
 * published `dist/` rather than the tagged source: `v0.2.0`'s source had the
 * bare `translateX(12px)` while the 0.2.0 tarball already emitted the
 * `:is([dir="rtl"] *)` branch. That was the *reverse* of the standing "dist lags
 * source" case (Icon's px→rem), and following the source would have shipped a
 * visibly broken RTL switch to satisfy a stale artifact. `v0.3.0`'s source
 * carries the mirrored pair itself (RTL Phase 4c), so source and dist agree and
 * the note is history rather than a live deferral.
 */
const thumbOnSizeStyles = stylex.create({
	sm: {
		width: 16,
		height: 16,
		insetInlineStart: { default: null, [TOUCH]: 'auto' },
		insetInlineEnd: { default: null, [TOUCH]: 2 },
		transform: {
			default: 'translateX(12px)',
			':is([dir="rtl"] *)': {
				default: 'translateX(-12px)',
				[TOUCH]: 'none'
			},
			[TOUCH]: 'none'
		}
	},
	md: {
		width: 20,
		height: 20,
		insetInlineStart: { default: null, [TOUCH]: 'auto' },
		insetInlineEnd: { default: null, [TOUCH]: 2 },
		transform: {
			default: 'translateX(14px)',
			':is([dir="rtl"] *)': {
				default: 'translateX(-14px)',
				[TOUCH]: 'none'
			},
			[TOUCH]: 'none'
		}
	}
});

const labelWrapperSizeStyles = stylex.create({
	sm: { minHeight: 20 },
	md: { minHeight: 24 }
});

// The invisible input is centred on the track by its inline start and a
// translate (the translate lives in `inputCoarse`, whose value differs under a
// coarse pointer). Upstream's `rtlStyles.centerInline('-50%')`; logical, so it
// mirrors without a branch.
const centerInlineStyles = stylex.create({
	centerInline: {
		insetInlineStart: '50%'
	}
});

const styles = stylex.create({
	container: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2']
	},
	// A hidden label is sr-only, so its wrapper is a zero-width flex item — the
	// row gap would still be painted beside the track, making the field box wider
	// than the control it contains. Matches `CheckboxInput`.
	containerLabelHidden: {
		gap: 0
	},
	containerSpread: {
		justifyContent: 'space-between',
		width: '100%'
	},
	statusGap: {
		marginTop: spacingVars['--spacing-2']
	},
	switchWrapper: {
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
		flexShrink: 0,
		isolation: 'isolate'
	},
	// Horizontal touch moves are the switch's drag and vertical ones the page's
	// scroll, under any primary pointer. A touchscreen laptop's finger counts
	// too. It is set in CSS so it holds before hydration. A disabled or loading
	// switch takes no drag, so it leaves every move to the page.
	switchWrapperInteractive: {
		touchAction: 'pan-y pinch-zoom'
	},
	input: {
		position: 'absolute',
		top: '50%',
		margin: 0,
		padding: 0,
		opacity: 0,
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		zIndex: 1
	},
	// The invisible input covers the track. Under a coarse pointer it is the
	// hit area a finger needs. The measured hit insets are 0 until measured.
	inputCoarse: {
		width: {
			default: '100%',
			'@media (pointer: coarse)':
				'calc(100% + var(--astryx-hit-inset-left, 0px) + var(--astryx-hit-inset-right, 0px))'
		},
		height: {
			default: '100%',
			'@media (pointer: coarse)':
				'calc(100% + var(--astryx-hit-inset-top, 0px) + var(--astryx-hit-inset-bottom, 0px))'
		},
		transform: {
			default: 'translate(-50%, -50%)',
			'@media (pointer: coarse)':
				'translate(calc(-50% + (var(--astryx-hit-inset-right, 0px) - var(--astryx-hit-inset-left, 0px)) / 2), calc(-50% + (var(--astryx-hit-inset-bottom, 0px) - var(--astryx-hit-inset-top, 0px)) / 2))'
		}
	},
	inputDisabled: {
		cursor: 'default'
	},
	inputBusy: {
		pointerEvents: 'none'
	},
	track: {
		display: 'flex',
		alignItems: 'center',
		// Under a finger the press layer (::before), the colour fade (::after)
		// and the thumb sit in the track, in a stacking context of its own.
		position: { default: null, [TOUCH]: 'relative' },
		isolation: { default: null, [TOUCH]: 'isolate' },
		borderRadius: radiusVars['--radius-full'],
		transitionProperty: 'background-color',
		// Under a finger the track's fill changes at once and the fade layer
		// crossfades it on the compositor. Reduced motion comes last so it holds
		// everywhere: under a finger the fade layer carries the colour, and with
		// a mouse the change is immediate.
		transitionDuration: {
			default: durationVars['--duration-fast'],
			[TOUCH]: '0s',
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': '0s',
			'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': '0s'
		},
		transitionTimingFunction: easeVars['--ease-standard'],
		boxSizing: 'border-box',
		// Forced colors (Windows High Contrast) strips painted backgrounds, which
		// would leave the track invisible. A system-color border keeps the
		// control's bounds perceivable (WCAG 1.4.11).
		borderWidth: {
			default: 0,
			'@media (forced-colors: active)': '1px'
		},
		borderStyle: {
			default: 'none',
			'@media (forced-colors: active)': 'solid'
		},
		borderColor: {
			default: null,
			'@media (forced-colors: active)': 'CanvasText'
		},
		// Pressed: the overlay rides on top of the on/off fill. Gated like the
		// hover tint so forced colors keeps its system-color track.
		backgroundImage: {
			default: null,
			[stylex.when.ancestor(':active', switchScope)]: {
				default: null,
				'@media (forced-colors: none)': {
					default: pressedImage,
					// Under a coarse pointer the touch press controller writes
					// `data-astryx-press` on the row instead, and the press layer
					// (::before) paints it.
					'@media (pointer: coarse)': 'none'
				}
			}
		},
		// The press, under a finger: a layer over the track's fill and colour
		// fade and under the thumb. It exists only while the row is pressed or
		// releasing. Its opacity is the press: on at once, then the shared
		// release's clock and curve. The release runs on the compositor, so the
		// press never sticks while the main thread is busy.
		'::before': {
			content: {
				default: null,
				[stylex.when.ancestor(PRESS_ON, switchScope)]: {
					default: null,
					[TOUCH]: '""'
				},
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: '""'
				}
			},
			position: 'absolute',
			inset: 0,
			zIndex: 1,
			borderRadius: 'inherit',
			pointerEvents: 'none',
			backgroundColor: {
				default: null,
				'@media (forced-colors: none)': colorVars['--color-overlay-pressed']
			},
			opacity: {
				default: null,
				[stylex.when.ancestor(PRESS_ON, switchScope)]: {
					default: null,
					[TOUCH]: 1
				},
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: 0
				}
			},
			animationName: {
				default: null,
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: pressLayerRelease
				}
			},
			animationDuration: {
				default: null,
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: {
						default: PRESS_RELEASE_DURATION,
						'@media (prefers-reduced-motion: reduce) and (pointer: coarse)':
							PRESS_RELEASE_DURATION_REDUCED
					}
				}
			},
			animationTimingFunction: {
				default: null,
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: PRESS_RELEASE_EASE
				}
			},
			animationFillMode: {
				default: null,
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: 'both'
				}
			}
		},
		// The colour fade, under a finger: a layer over the track's own fill. It
		// shows the fill the track is leaving, or mid-drag the one it heads to,
		// and fades it on the compositor. Its colour is the theme's, read from
		// the track (switch-touch.ts's animator). The animator owns its opacity,
		// and at rest it is clear.
		'::after': {
			content: '""',
			display: { default: 'none', [TOUCH]: 'block' },
			position: 'absolute',
			inset: 0,
			zIndex: 0,
			borderRadius: 'inherit',
			pointerEvents: 'none',
			opacity: 0,
			backgroundColor: 'var(--_switch-fade-fill, transparent)',
			// A compositing layer only while a fade runs. The animator sets the
			// property in the task that starts the fade: iOS Safari needs that to
			// run the fade off the main thread. It clears it after the fade rests.
			willChange: {
				default: null,
				[TOUCH]: 'var(--astryx-motion-will-change-after, auto)'
			}
		}
	},
	// The one ring in the system not drawn by the shared focus-outline styles. The focusable
	// input is the track's preceding sibling, so the condition reads that input
	// through its own marker: a sibling relation, never a `:has()` scan of the
	// row, which would restyle everything under it on any change. A marker
	// cannot be shared across components without leaking focus state from an
	// outer one, so it cannot live in the utility. StyleX also cannot inline a
	// constant imported from another module, so the values are read from the
	// tokens the utility reads.
	trackFocus: {
		outline: {
			default: 'none',
			[stylex.when.siblingBefore(':focus-visible', switchFocusInput)]:
				`${focusVars['--focus-outline-width']} ${focusVars['--focus-outline-style']} ${focusVars['--focus-outline-color']}`
		},
		outlineOffset: {
			default: null,
			[stylex.when.siblingBefore(':focus-visible', switchFocusInput)]:
				focusVars['--focus-outline-offset']
		}
	},
	// State-dependent colors with ancestor hover behavior
	trackOff: {
		backgroundColor: {
			default: colorVars['--color-background-gray'],
			// Off = empty (Canvas) track; on = Highlight track, so the two states
			// stay distinguishable under forced colors.
			'@media (forced-colors: active)': 'Canvas',
			// The ancestor-hover tint is a non-system color-mix, and its rule
			// outranks the plain forced-colors rule above. Left ungated it would
			// reassert on hover under forced colors, where the UA flattens the
			// color-mix back to Canvas — so the HighlightText thumb would sit on a
			// white track (white-on-white). Gating on `forced-colors: none` keeps
			// the tint out of forced colors and lets the system-color track stand.
			[stylex.when.ancestor(':hover', switchScope)]: {
				'@media (hover: hover) and (forced-colors: none)': `color-mix(in srgb, ${colorVars['--color-background-gray']}, ${colorVars['--color-tint-hover']} 5%)`
			}
		}
	},
	trackOn: {
		backgroundColor: {
			default: colorVars['--color-accent'],
			'@media (forced-colors: active)': 'Highlight',
			// See trackOff: gate the hover tint out of forced colors so it cannot
			// flatten the Highlight track to white under the HighlightText thumb.
			[stylex.when.ancestor(':hover', switchScope)]: {
				'@media (hover: hover) and (forced-colors: none)': `color-mix(in srgb, ${colorVars['--color-accent']}, ${colorVars['--color-tint-hover']} 15%)`
			}
		}
	},
	trackDisabled: {
		opacity: 0.5,
		// Opacity dimming does not survive forced colors; GrayText is the
		// platform's disabled affordance there.
		borderColor: {
			default: null,
			'@media (forced-colors: active)': 'GrayText'
		}
	},
	trackDisabledOff: {
		backgroundColor: colorVars['--color-background-gray']
	},
	thumb: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: radiusVars['--radius-full'],
		// Under a finger it sits in the track, centered in its height, above the
		// colour fade (::after) and the press layer (::before). The touch model
		// moves and lifts it on the compositor: nothing of its own transitions.
		position: { default: null, [TOUCH]: 'absolute' },
		insetBlock: { default: null, [TOUCH]: 0 },
		marginBlock: { default: null, [TOUCH]: 'auto' },
		zIndex: { default: null, [TOUCH]: 2 },
		pointerEvents: { default: null, [TOUCH]: 'none' },
		transitionProperty: {
			default: 'transform, width, height',
			[TOUCH]: 'none'
		},
		// Under reduced motion nothing slides: under a finger the thumb
		// cross-fades through the animator, and with a mouse it moves at once.
		transitionDuration: {
			default: durationVars['--duration-fast'],
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': '0s',
			'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': '0s'
		},
		transitionTimingFunction: easeVars['--ease-standard'],
		// The lifted shadow, under a finger: the theme's elevation on a layer the
		// thumb's size. It fades in with the lift on the compositor, and at rest
		// it is clear. The press on the thumb too, under a finger: the same layer
		// as the track's, over the thumb's fill.
		'::before': {
			content: {
				default: null,
				[stylex.when.ancestor(PRESS_ON, switchScope)]: {
					default: null,
					[TOUCH]: '""'
				},
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: '""'
				}
			},
			position: 'absolute',
			inset: 0,
			borderRadius: 'inherit',
			pointerEvents: 'none',
			backgroundColor: {
				default: null,
				'@media (forced-colors: none)': colorVars['--color-overlay-pressed']
			},
			opacity: {
				default: null,
				[stylex.when.ancestor(PRESS_ON, switchScope)]: {
					default: null,
					[TOUCH]: 1
				},
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: 0
				}
			},
			animationName: {
				default: null,
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: pressLayerRelease
				}
			},
			animationDuration: {
				default: null,
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: {
						default: PRESS_RELEASE_DURATION,
						'@media (prefers-reduced-motion: reduce) and (pointer: coarse)':
							PRESS_RELEASE_DURATION_REDUCED
					}
				}
			},
			animationTimingFunction: {
				default: null,
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: PRESS_RELEASE_EASE
				}
			},
			animationFillMode: {
				default: null,
				[stylex.when.ancestor(PRESS_FADING, switchScope)]: {
					default: null,
					[TOUCH]: 'both'
				}
			}
		},
		'::after': {
			content: '""',
			display: { default: 'none', [TOUCH]: 'block' },
			position: 'absolute',
			inset: 0,
			borderRadius: 'inherit',
			pointerEvents: 'none',
			opacity: 0,
			boxShadow: shadowVars['--shadow-low'],
			// A compositing layer only while the lift fades the shadow, as for
			// the track's colour fade.
			willChange: {
				default: null,
				[TOUCH]: 'var(--astryx-motion-will-change-after, auto)'
			}
		},
		// Pressed with a mouse: the same overlay as the track, so the whole
		// control darkens rather than the thumb standing out against a darker
		// track. Under a finger the track's press layer paints under the thumb,
		// which lifts.
		backgroundImage: {
			default: null,
			[stylex.when.ancestor(':active', switchScope)]: {
				default: null,
				'@media (forced-colors: none)': {
					default: pressedImage,
					'@media (pointer: coarse)': 'none'
				}
			}
		}
	},
	// The thumb fill lives on the on/off styles (not the shared thumb style)
	// because forced colors needs a per-state system color: CanvasText on the
	// empty off track, HighlightText on the Highlight on track. Sizing stays in
	// thumbOffSizeStyles/thumbOnSizeStyles; only the fill is state-dependent.
	thumbOff: {
		backgroundColor: {
			default: colorVars['--color-background-surface'],
			'@media (forced-colors: active)': 'CanvasText'
		}
	},
	thumbOn: {
		backgroundColor: {
			default: colorVars['--color-background-surface'],
			'@media (forced-colors: active)': 'HighlightText'
		}
	},

	labelWrapper: {
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'center'
	},
	// Defined by upstream but never applied — the description is rendered by
	// `FieldLabel`, not here. Kept so the compiled atomic classes match dist.
	description: {
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-supporting-size'],
		color: colorVars['--color-text-secondary']
	}
});

// Dynamic field width (number -> px, string used as-is).
const dynamicWidthStyles = stylex.create({
	width: (width: SizeValue | null) => ({ width })
});

/** The outer field box — dynamic width plus the caller's `xstyle`. */
export function switchFieldAttrs(width: SizeValue | undefined, xstyle: StyleArg): SvelteStyleAttrs {
	return sx(width != null && dynamicWidthStyles.width(width), xstyle);
}

/**
 * The switch *row*. Carries the `switchScope` marker (dropped while disabled)
 * that the track's hover/focus rules resolve against.
 */
export function switchContainerAttrs(
	isSpread: boolean,
	isDisabled: boolean,
	isLabelHidden: boolean
): SvelteStyleAttrs {
	return sx(
		styles.container,
		isLabelHidden && styles.containerLabelHidden,
		isSpread && styles.containerSpread,
		!isDisabled && switchScope,
		// The touch press's strength and release live on the row the controller
		// writes to; the track and thumb inherit and paint it.
		!isDisabled && interactionOverlayStyles.pressedAlpha,
		!isDisabled && pressOwnerStyles.pressedAlphaLayered
	);
}

/** The positioned wrapper around the native input, track and thumb. */
export function switchWrapperAttrs(size: SwitchSize, isInteractive: boolean): SvelteStyleAttrs {
	return sx(
		styles.switchWrapper,
		wrapperSizeStyles[size],
		isInteractive && styles.switchWrapperInteractive
	);
}

/** The visually-transparent native checkbox that owns the interaction. */
export function switchInputAttrs(
	size: SwitchSize,
	isDisabled: boolean,
	isBusy: boolean
): SvelteStyleAttrs {
	return sx(
		styles.input,
		centerInlineStyles.centerInline,
		styles.inputCoarse,
		isDisabled && styles.inputDisabled,
		isBusy && styles.inputBusy,
		switchFocusInput
	);
}

/** The pill track, coloured by on/off and dimmed while disabled. */
export function switchTrackAttrs(
	size: SwitchSize,
	isOn: boolean,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		styles.track,
		trackSizeStyles[size],
		isOn ? styles.trackOn : styles.trackOff,
		styles.trackFocus,
		isDisabled && styles.trackDisabled,
		isDisabled && !isOn && styles.trackDisabledOff
	);
}

/** The sliding thumb, which grows and travels when on. */
export function switchThumbAttrs(size: SwitchSize, isOn: boolean): SvelteStyleAttrs {
	return sx(
		styles.thumb,
		isOn ? thumbOnSizeStyles[size] : thumbOffSizeStyles[size],
		isOn ? styles.thumbOn : styles.thumbOff
	);
}

/** The column holding the label and description. */
export function switchLabelWrapperAttrs(size: SwitchSize): SvelteStyleAttrs {
	return sx(styles.labelWrapper, labelWrapperSizeStyles[size]);
}

/**
 * The gap above a detached status message, passed to `FieldStatus`'s `xstyle`.
 *
 * It used to wrap the message in a spacer `<div>`; 0.4.x hands the margin to the
 * message box itself instead, which is one element fewer and — because the value
 * crosses a component boundary — the reason upstream's `dist/` keeps
 * `styles.statusGap` as an object rather than a folded class string.
 */
export const switchStatusGapStyle = styles.statusGap;
