import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';
import { interactionOverlayStyles } from '../../utils/interaction-overlay.stylex.js';
import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	spacingVars
} from '../../styles/tokens.stylex.js';

// The touch press's paint, declared by the shared overlay styles on the
// element the controller writes to (`pressedAlpha`) at the press's strength,
// 1 while on and 1 → 0 over the release, and inherited resolved by the
// `::after` that paints it. See interactionOverlay.stylex.ts.
const pressedOverlayImage = 'var(--_press-paint-image)';
/** Written by the press controller while it paints a press. */
const PRESSED_ON = '[data-astryx-press="on"]';
/** Written by the press controller for the press's release. */
const PRESSED_FADING = '[data-astryx-press="fading"]';

const styles = stylex.create({
	root: {
		position: 'relative',
		display: 'inline-flex',
		flexDirection: 'column',
		width: 64,
		flexShrink: 0,
		isolation: 'isolate'
	},
	imageContainer: {
		position: 'relative',
		width: '100%',
		aspectRatio: '1',
		borderRadius: radiusVars['--radius-element'],
		overflow: 'hidden',
		backgroundColor: colorVars['--color-neutral']
	},
	image: {
		width: '100%',
		height: '100%',
		objectFit: 'cover',
		display: 'block'
	},
	// An inset ring rather than a border: the image fills the container, so a
	// real border would either sit outside the radius or eat into the picture.
	insetBorder: {
		position: 'absolute',
		inset: 0,
		borderRadius: 'inherit',
		boxShadow: `inset 0 0 0 1px ${colorVars['--color-border']}`,
		pointerEvents: 'none'
	},
	placeholder: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '100%',
		height: '100%',
		color: colorVars['--color-icon-secondary']
	},
	interactive: {
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	// Hover and pressed overlay — the exact same treatment as ClickableCard and
	// SelectableCard. A transparent `::after` tints on hover/press instead of
	// shifting shadow or opacity. Guarded by @media (hover: hover) so touch
	// devices don't show a stuck hover state; active/pressed works everywhere.
	overlay: {
		// The `::after` layer paints the hover and mouse states as its colour,
		// `--_press-overlay`, which their arms set on the element itself (same
		// enabled guard as the shared overlay utility). The press the controller
		// paints (a finger's, and on a touch-first device a mouse's or a key's)
		// is the same layer's image, keyed on the `data-astryx-press` attribute
		// the controller writes. Every arm of that press is a plain property of
		// the `::after`, which outranks the layer's own defaults in a layered
		// stylesheet and a flat one alike. A custom property's attribute arm
		// does not: a layered build emits the property's default outside the
		// priority layers its attribute arms land in, and the default wins.
		'--_press-overlay': {
			default: 'transparent',
			':where(:not(:disabled,[aria-disabled="true"]))': {
				default: null,
				':active': {
					default: colorVars['--color-overlay-pressed'],
					'@media (pointer: coarse)': 'transparent'
				},
				'@media (hover: hover)': {
					default: null,
					':hover:where(:not(:disabled,[aria-disabled="true"]))':
						colorVars['--color-overlay-hover'],
					':active': colorVars['--color-overlay-pressed']
				}
			}
		},
		'::after': {
			content: '""',
			position: 'absolute',
			inset: 0,
			borderRadius: 'inherit',
			pointerEvents: 'none',
			// A press the controller paints shows on its first frame and fades on
			// its strength's own animation, so the colour it replaces drops out at
			// once rather than crossfading: no transition while it paints. The
			// mouse states keep the fast fade.
			transitionProperty: {
				default: 'background-color',
				[PRESSED_ON]: 'none',
				[PRESSED_FADING]: 'none',
				// Under reduced motion a colour changes at once. Only opacity may
				// still fade on a touch screen.
				'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': 'opacity'
			},
			transitionDuration: {
				default: durationVars['--duration-fast'],
				// Under reduced motion a fine pointer gets no transition. A touch
				// screen's fade keeps the exit tokens, within 200 ms.
				'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': '0s',
				// The 200 ms bound copies reducedMotionFadeConsts.duration. That
				// module is internal, and a swizzled component imports only exported
				// paths. reducedMotionValues.test.ts keeps the copies equal.
				'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': `min(${durationVars['--duration-exit']}, 200ms)`
			},
			transitionTimingFunction: {
				default: easeVars['--ease-standard'],
				'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': easeVars['--ease-exit']
			},
			// While the controller paints, the colour yields to the image: a
			// touchscreen beside a fine pointer still matches `:active` under a
			// finger, and the press would otherwise paint twice.
			backgroundColor: {
				default: 'var(--_press-overlay)',
				[PRESSED_ON]: 'transparent',
				[PRESSED_FADING]: 'transparent'
			},
			// The press at its strength, which the container's `pressedAlpha` arms
			// own: 1 on the first frame of a believed press, then 1 → 0 over the
			// release. The `::after` inherits the resolved paint and repaints with
			// it on every frame of the fade. Read only inside this element's own
			// arms, so a pressed ancestor's strength never paints here.
			backgroundImage: {
				default: null,
				[PRESSED_ON]: pressedOverlayImage,
				[PRESSED_FADING]: pressedOverlayImage
			}
		}
	},
	interactiveButton: {
		all: 'unset',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		display: 'block',
		width: '100%',
		height: '100%',
		borderRadius: radiusVars['--radius-element'],
		overflow: 'hidden'
	},

	removeSlot: {
		position: 'absolute',
		top: spacingVars['--spacing-1'],
		insetInlineEnd: spacingVars['--spacing-1'],
		zIndex: 1,
		lineHeight: 0
	},
	removeButtonOverrides: {
		'--_button-radius': `calc(${radiusVars['--radius-element']} - ${spacingVars['--spacing-1']})`,
		position: 'relative',
		height: 20,
		minWidth: 20,
		// Fixed colors instead of luminance-adapting theme: a translucent scrim
		// (--color-overlay) plus an --color-on-dark icon reads on any image
		// without sampling pixel brightness.
		backgroundColor: colorVars['--color-overlay'],
		color: colorVars['--color-on-dark'],
		'--_thumbnail-hit-inset': {
			default: '0px',
			'@media (pointer: coarse)': '-2px'
		},
		'::after': {
			content: '""',
			position: 'absolute',
			inset: 'var(--_thumbnail-hit-inset)'
		}
	},
	disabled: {
		opacity: 0.5,
		pointerEvents: 'none' as const
	},
	uploadOverlay: {
		position: 'absolute',
		inset: 0,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colorVars['--color-overlay'],
		borderRadius: 'inherit',
		zIndex: 1,
		lineHeight: 0
	}
});

export function thumbnailRootAttrs(isDisabled: boolean, xstyle?: StyleArg): SvelteStyleAttrs {
	return sx(styles.root, isDisabled && styles.disabled, xstyle);
}

/**
 * The square picture box.
 *
 * It used to carry a `thumbnailScope` marker for the remove button's hover
 * reveal. Upstream 0.3.0 moved that whole mechanism into `useContainerReveal`
 * and deleted `thumbnail.markers.stylex.ts`, so the marker now comes from the
 * hook's pool and is merged onto the element beside these classes rather than
 * into them — which is also why the compiler can fold this call site again.
 */
export function thumbnailImageContainerAttrs(isInteractive: boolean): SvelteStyleAttrs {
	return focusOutlineProps.focusWithin(
		styles.imageContainer,
		isInteractive && styles.interactive,
		isInteractive && styles.overlay,
		// The touch press's strength and release, on the element the controller
		// writes to; the `::after` above paints off it.
		isInteractive && interactionOverlayStyles.pressedAlpha
	);
}

export function thumbnailImageAttrs(): SvelteStyleAttrs {
	return sx(styles.image);
}

export function thumbnailInsetBorderAttrs(): SvelteStyleAttrs {
	return sx(styles.insetBorder);
}

export function thumbnailPlaceholderAttrs(): SvelteStyleAttrs {
	return sx(styles.placeholder);
}

export function thumbnailInteractiveButtonAttrs(): SvelteStyleAttrs {
	return sx(styles.interactiveButton);
}

/**
 * The positioned corner the remove button sits in. The reveal transition is no
 * longer here — `useContainerReveal` supplies it, and the component merges the
 * two class lists as upstream's `mergeProps` does.
 */
export function thumbnailRemoveSlotAttrs(): SvelteStyleAttrs {
	return sx(styles.removeSlot);
}

/**
 * Sizing and colour overrides handed to the remove `<Button>` as its `xstyle`,
 * as upstream passes them.
 */
export const thumbnailRemoveButtonXstyle: StyleArg = styles.removeButtonOverrides;

export function thumbnailUploadOverlayAttrs(): SvelteStyleAttrs {
	return sx(styles.uploadOverlay);
}
