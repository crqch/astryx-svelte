import * as stylex from '@stylexjs/stylex';
import type { CardVariant } from '../card/card.stylex.js';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { borderVars, colorVars, durationVars, easeVars } from '../../styles/tokens.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { interactionOverlayStyles } from '../../utils/interaction-overlay.stylex.js';

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
	interactive: {
		position: 'relative',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		textDecoration: 'none',
		color: 'inherit'
	},
	// Hover and pressed overlay. Hover is guarded by @media (hover: hover) so
	// touch devices don't show a stuck hover state; the press has two arms,
	// `:active` for a mouse and `data-astryx-press` for the press controller.
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
				// paths. reduced-motion-values.test.ts keeps the copies equal.
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
			// The press at its strength, which the card's `pressedAlpha` arms own:
			// 1 on the first frame of a believed press, then 1 → 0 over the
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
	// Non-`default` variants drop Card's transparent 1px border so the overlay
	// reaches the box edge instead of leaving an untinted ring.
	borderless: {
		borderWidth: 0
	},
	// `default` draws the 1px border *within* the padding (width subtracted per
	// side) so total inset matches the borderless variants; it emphasizes on hover.
	bordered: {
		borderColor: colorVars['--color-border'],
		paddingInlineStart: `calc(var(--container-padding-inline-start) - ${borderVars['--border-width']})`,
		paddingInlineEnd: `calc(var(--container-padding-inline-end) - ${borderVars['--border-width']})`,
		paddingBlockStart: `calc(var(--container-padding-block-start) - ${borderVars['--border-width']})`,
		paddingBlockEnd: `calc(var(--container-padding-block-end) - ${borderVars['--border-width']})`,
		transitionProperty: {
			default: 'border-color',
			// Under reduced motion the border's colour changes at once.
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': 'opacity'
		},
		transitionDuration: {
			default: durationVars['--duration-fast'],
			// Under reduced motion a fine pointer gets no transition. A touch
			// screen's opacity fade, such as a disabled card's dimming, takes
			// 200 ms at most.
			'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': '0s',
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': `min(${durationVars['--duration-exit']}, 200ms)`
		},
		transitionTimingFunction: {
			default: easeVars['--ease-standard'],
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': easeVars['--ease-exit']
		}
	},
	borderedHoverOnPointer: {
		'@media (hover: hover)': {
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				borderColor: colorVars['--color-border-emphasized']
			}
		}
	},
	disabled: {
		cursor: 'default',
		opacity: 0.5
	},
	srOnly: {
		position: 'absolute',
		width: '1px',
		height: '1px',
		padding: 0,
		margin: '-1px',
		overflow: 'hidden',
		clip: 'rect(0, 0, 0, 0)',
		whiteSpace: 'nowrap',
		borderWidth: 0
	}
});

export interface ClickableCardXstyleOptions {
	variant: CardVariant;
	isDisabled: boolean;
}

/**
 * The interactive layer handed to `Card`'s `xstyle` prop (an array, exactly as
 * upstream). They stay live style objects — `Card` resolves them through its own
 * `sx()`, which keeps them as object-mode dist entries.
 */
export function clickableCardXstyle(
	{ variant, isDisabled }: ClickableCardXstyleOptions,
	xstyle?: StyleArg
): StyleArg {
	const hasBorder = variant === 'default';
	return [
		styles.interactive,
		focusOutlineStyles.focusWithin,
		hasBorder ? styles.bordered : styles.borderless,
		!isDisabled && styles.overlay,
		// The touch press's strength and release, on the element the controller
		// writes to; the `::after` above paints off it.
		!isDisabled && interactionOverlayStyles.pressedAlpha,
		!isDisabled && hasBorder && styles.borderedHoverOnPointer,
		isDisabled && styles.disabled,
		xstyle
	];
}

/** The visually-hidden `<button>`/`<a>` that carries the accessible role/label. */
export function clickableCardControlAttrs(): SvelteStyleAttrs {
	return sx(styles.srOnly);
}
