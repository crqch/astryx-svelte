import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars, radiusVars } from '../../styles/tokens.stylex.js';
import { indicatorScope } from '../indicator/indicator.markers.stylex.js';
import { rowPressLayerStyles } from '../../private-attributes/press.stylex.js';
import type { RadioListSize } from './radio-list-context.svelte.js';

// The touch press's paint, declared by the shared overlay styles on the
// element the controller writes to (`pressedAlpha`) at the press's strength,
// 1 while on and 1 → 0 over the release, and inherited resolved by the layer
// that paints it. See interaction-overlay.stylex.ts.
const pressedOverlayImage = 'var(--_press-paint-image)';

// The mouse press's paint, declared on the row and inherited by the layer
// over the circle. Internal: not a theme hook.
const ROW_PRESS = '--_radio-row-press';

/**
 * Ported from Astryx's `RadioList/RadioListItem.tsx` styles.
 *
 * **This component no longer draws a radio.** Upstream 0.4.0 moved the circle,
 * its inner dot and their two size ramps into `RadioIndicator`, so what is left
 * is the wrapper square, the transparent `<input type="radio">` and the
 * `display: contents` indicator slot. The hover tints still resolve through an
 * ancestor marker so a parent container's hover never bleeds in — the shared
 * `indicatorScope` rather than a `radioScope` of its own, since the tinted
 * element belongs to the theme's indicator.
 *
 * Upstream 0.5.0 made the whole row a click target: the row's own flex
 * container is gone and `Item` **is** the row, so the marker and the
 * appearance reset ride `Item`'s `xstyle` rather than a wrapper of their own.
 */
const styles = stylex.create({
	radioWrapper: {
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		isolation: 'isolate'
	},
	// The row remains the large press target, but nested links and buttons keep
	// their independent action and do not make the radio appear pressed: the
	// row declares the mouse press's paint (`rowStyles.press`) and this layer
	// reads it. This owner-drawn layer also survives a theme replacing the
	// indicator component.
	// Two pointers, two press models (see interaction-overlay.stylex.ts): a
	// mouse keeps `:active`; under a coarse pointer that arm is dropped and the
	// touch press controller writes `data-astryx-press` on the row, which this
	// layer reads off the same scope marker as the hover tint. The controller
	// paints the innermost pressable, so a nested link or button takes the
	// press itself and the row never carries the attribute for it.
	indicatorPressOverlay: {
		'::after': {
			content: '""',
			position: 'absolute',
			inset: 0,
			borderRadius: radiusVars['--radius-full'],
			pointerEvents: 'none',
			backgroundColor: `var(${ROW_PRESS}, transparent)`,
			// The touch press, as an image layer over the colour: an image change
			// is discrete, so no transition can delay the onset, and the strength
			// the row's `pressedAlpha` arms own (1 while on, 1 → 0 over the
			// release) is what moves. Coarse pointers only, like the drop above.
			backgroundImage: {
				default: null,
				[stylex.when.ancestor('[data-astryx-press="on"]', indicatorScope)]: {
					default: null,
					'@media (pointer: coarse)': pressedOverlayImage
				},
				[stylex.when.ancestor('[data-astryx-press="fading"]', indicatorScope)]: {
					default: null,
					'@media (pointer: coarse)': pressedOverlayImage
				}
			}
		}
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
	inputCoarse: {
		'@media (pointer: coarse)': {
			minInlineSize: 24,
			minBlockSize: 24
		}
	},
	inputDisabled: {
		cursor: 'default'
	},
	// Holds only the indicator, so the focus ring has one unambiguous target.
	// `display: contents` adds no box of its own — the indicator keeps whatever
	// layout relationship it already had with the wrapper.
	indicatorSlot: {
		display: 'contents'
	}
});

const wrapperSizeStyles = stylex.create({
	sm: { width: 20, height: 20 },
	md: { width: 24, height: 24 }
});

// The `radioSizeStyles` / `dotSizeStyles` ramps that stood here moved to
// `RadioIndicator` at upstream 0.4.0, along with the seven style keys that drew
// the circle and its inner dot. This component no longer draws a radio — it
// renders whichever indicator the theme resolves for the `radio` name.

const rowStyles = stylex.create({
	// The row's default appearance is a bare surface: no density padding, no
	// radius, and no full-row background — only the indicator tints on hover
	// (via `indicatorScope`). Item paints padding/radius/hover as an interactive
	// row, so this neutralizes them at the component level. A theme's
	// `radio-list-item` overrides still win: they land in `@layer astryx-theme`,
	// above the component's base StyleX layer, so themes opt back into row
	// padding/radius/hover/selected styling. `minWidth: 0` preserves label
	// truncation now that the Item is the row's flex child.
	root: {
		paddingBlock: 0,
		paddingInline: 0,
		borderRadius: 0,
		minWidth: 0,
		// Suppress Item's interactive hover/press background so the resting and
		// hovered row look identical by default (a theme can restyle either).
		backgroundColor: 'transparent'
	},
	// The mouse press (a finger's lives on `data-astryx-press`): the row is
	// pressed, but not through a nested link or button, which keep their own
	// action. The `:has()` is on the row itself and reaches no descendant
	// selector, so a change inside the row re-checks the row alone; the circle's
	// layer reads the paint through inheritance rather than a relation that
	// would restyle everything under the row.
	press: {
		[ROW_PRESS]: {
			default: null,
			':active:not(:has(a:active,button:active,[role="button"]:active,[role="link"]:active))': {
				default: colorVars['--color-overlay-pressed'],
				'@media (pointer: coarse)': 'transparent'
			}
		}
	}
});

/**
 * The `xstyle` array the row hands to `Item`.
 *
 * Hover reaches the radio visual through the ancestor marker rather than props,
 * so hovering the row tints the control. The marker rides the painting row
 * element (Item), the same element that carries the theme target, so a theme's
 * hover styling stays in step with the tint. `rowStyles.root` restores the bare
 * default look, applied after Item's own base styles so it wins within the base
 * layer.
 */
export function radioListItemRowXstyle(isDisabled: boolean, xstyle: StyleArg): StyleArg {
	return [
		!isDisabled && indicatorScope,
		// The row keeps no press paint of its own: the circle paints, and reads
		// the strength whose release the row keeps.
		rowPressLayerStyles.cellWithoutLayer,
		rowStyles.root,
		!isDisabled && rowStyles.press,
		xstyle
	];
}

/**
 * The square that centres the input and the indicator.
 *
 * No longer carries a focus ring, which is why the `isDisabled` parameter is
 * gone: the ring is painted imperatively on the indicator's own element by
 * `useIndicatorFocusRing`, so it takes that element's shape instead of the
 * wrapper hardcoding a `border-radius: 50%` guess about a circle it does not
 * own — and the disabled guard moved to the hook with it.
 */
export function radioWrapperAttrs(size: RadioListSize, isDisabled: boolean): SvelteStyleAttrs {
	return sx(
		styles.radioWrapper,
		wrapperSizeStyles[size],
		!isDisabled && styles.indicatorPressOverlay
	);
}

/** The transparent `<input type="radio">` overlaid on the circle. */
export function radioInputAttrs(size: RadioListSize, isDisabled: boolean): SvelteStyleAttrs {
	return sx(
		styles.input,
		styles.inputCoarse,
		wrapperSizeStyles[size],
		isDisabled && styles.inputDisabled
	);
}

/**
 * A container holding ONLY the indicator, so the focus ring has an unambiguous
 * target whatever a theme renders. `display: contents` keeps it out of layout
 * entirely.
 *
 * This replaced `radioCircleAttrs`/`radioDotAttrs` at upstream 0.4.0 — the
 * circle and its dot are `RadioIndicator`'s now, and it takes the size itself.
 */
export function radioIndicatorSlotAttrs(): SvelteStyleAttrs {
	return sx(styles.indicatorSlot);
}
