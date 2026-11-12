import * as stylex from '@stylexjs/stylex';
import type { CardVariant } from '../card/card.stylex.js';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars, durationVars, easeVars } from '../../styles/tokens.stylex.js';
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
		// Declared here, on the element that carries the `astryx-selectable-card`
		// target, so a theme has something to override — the ring for a variant
		// only the theme knows about reads it (see `selectedUnknown`).
		'--selectable-card-ring-color': colorVars['--color-accent'],
		position: 'relative',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		transitionProperty: {
			default: 'box-shadow, border-color',
			// Under reduced motion a selection's ring and border change at once.
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
	},
	// Selection indicator — an inset ring drawn via the card's `--_card-ring`
	// shadow slot (zero layout jitter) plus a `borderColor` change on the card's
	// own border for a cohesive look. Routing the ring through `--_card-ring`
	// rather than `box-shadow` directly is what lets it **compose** with the
	// card's elevation instead of clobbering it — `Card.card` lists both vars in
	// one `box-shadow`, so a selected *and* raised card keeps both.
	selected: {
		borderColor: colorVars['--color-accent'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-accent']}`
	},
	selectedBlue: {
		borderColor: colorVars['--color-border-blue'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-border-blue']}`
	},
	selectedCyan: {
		borderColor: colorVars['--color-border-cyan'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-border-cyan']}`
	},
	selectedGray: {
		borderColor: colorVars['--color-border-gray'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-border-gray']}`
	},
	selectedGreen: {
		borderColor: colorVars['--color-border-green'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-border-green']}`
	},
	selectedOrange: {
		borderColor: colorVars['--color-border-orange'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-border-orange']}`
	},
	selectedPink: {
		borderColor: colorVars['--color-border-pink'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-border-pink']}`
	},
	selectedPurple: {
		borderColor: colorVars['--color-border-purple'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-border-purple']}`
	},
	selectedRed: {
		borderColor: colorVars['--color-border-red'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-border-red']}`
	},
	selectedTeal: {
		borderColor: colorVars['--color-border-teal'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-border-teal']}`
	},
	selectedYellow: {
		borderColor: colorVars['--color-border-yellow'],
		'--_card-ring': `inset 0 0 0 2px ${colorVars['--color-border-yellow']}`
	},
	// A theme may add a card variant this module has never heard of. It still has
	// to look selected, so its ring reads the published variable instead of a
	// colour this file would have to know.
	selectedUnknown: {
		'--_card-ring': 'inset 0 0 0 2px var(--selectable-card-ring-color)'
	}
});

function selectedStyleForVariant(variant: CardVariant) {
	switch (variant) {
		// The three variants with no colour of their own take the accent ring.
		case 'default':
		case 'transparent':
		case 'muted':
			return styles.selected;
		case 'blue':
			return styles.selectedBlue;
		case 'cyan':
			return styles.selectedCyan;
		case 'gray':
			return styles.selectedGray;
		case 'green':
			return styles.selectedGreen;
		case 'orange':
			return styles.selectedOrange;
		case 'pink':
			return styles.selectedPink;
		case 'purple':
			return styles.selectedPurple;
		case 'red':
			return styles.selectedRed;
		case 'teal':
			return styles.selectedTeal;
		case 'yellow':
			return styles.selectedYellow;
		// `CardVariant` is open — a theme can add a variant this switch has never
		// seen, and it still has to look selected.
		default:
			return styles.selectedUnknown;
	}
}

export interface SelectableCardXstyleOptions {
	variant: CardVariant;
	isSelected: boolean;
	isDisabled: boolean;
}

/**
 * The interaction/selection styles handed to `Card`'s `xstyle` prop (an array,
 * exactly as upstream). They stay live style objects here — `Card` resolves them
 * through its own `sx()`, which is what keeps them as object-mode dist entries.
 */
export function selectableCardXstyle(
	{ variant, isSelected, isDisabled }: SelectableCardXstyleOptions,
	xstyle?: StyleArg
): StyleArg {
	return [
		styles.interactive,
		focusOutlineStyles.focusWithin,
		isSelected && selectedStyleForVariant(variant),
		!isDisabled && styles.overlay,
		// The touch press's strength and release, on the element the controller
		// writes to; the `::after` above paints off it.
		!isDisabled && interactionOverlayStyles.pressedAlpha,
		isDisabled && styles.disabled,
		xstyle
	];
}

/** The visually-hidden checkbox that carries the accessible role/label/state. */
export function selectableCardInputAttrs(): SvelteStyleAttrs {
	return sx(styles.srOnly);
}
