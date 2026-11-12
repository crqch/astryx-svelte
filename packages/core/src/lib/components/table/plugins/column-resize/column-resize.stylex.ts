import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../../../internal/sx.js';
import { colorVars } from '../../../../styles/tokens.stylex.js';

/**
 * Ported from the styles declared in Astryx's
 * `Table/plugins/columnResize/useTableColumnResize.tsx`.
 *
 * Group names are upstream's (`handleStyles`, `headerRowStyles`,
 * `headerCellRelative`) so the class oracle needs no renames, and every
 * declaration is upstream's verbatim — including the `content: '""'` inside
 * `indicator`, which is the CSS property, not a render slot.
 *
 * `handleStyles` is applied at exactly one call site (`stylex.props(base,
 * indicator)` on the handle `<div>`), so it is exported through `sx()`;
 * `headerRowStyles.base` and `headerCellRelative.base` are pushed onto the
 * header row's and header cell's `xstyle` arrays and so are exported as raw
 * style objects, which the table's pipeline resolves itself.
 */

const handleStyles = stylex.create({
	base: {
		position: 'absolute',
		// Keep entirely inside the <th> — extending outside gets clipped by the
		// adjacent <th>'s overflow:hidden.
		insetInlineEnd: 0,
		top: 0,
		// Extend the handle the full height of the table, not just the header.
		// The <th> has overflow:visible (from headerCellRelative), so the handle
		// visually reaches through the body rows. Both variables are set by the
		// plugin's ResizeObserver — they fall back to header-height when it
		// hasn't fired yet.
		//
		// `top: 0` does not land on the table's top edge: the handle hangs from
		// its cell's content box, and the header's vertical centring shifts that
		// box down by an amount that depends on how tall its own content is.
		// Subtracting that drop keeps the handle from hanging past the last row
		// and forcing the scroll wrapper to scroll.
		height: 'calc(var(--table-resize-height, 100%) - var(--table-resize-offset, 0px))',
		// Wide transparent hit area; the visible indicator uses ::after to span
		// the full handle height independently of the border box.
		width: '8px',
		cursor: {
			default: 'ew-resize',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		zIndex: 1,
		touchAction: 'none',
		userSelect: 'none',
		// Drive the indicator color via a CSS variable that ::after reads.
		// The parent handle is the hover/focus target — pseudo-elements
		// can't receive :hover directly.
		//
		// The resting value is inherited rather than fixed: the header row sets
		// `--resize-hint` while it is hovered, which reveals every boundary at
		// once so the columns can advertise that they move. Reading it as the
		// default keeps this element's own :hover a same-element override — an
		// ancestor selector would outrank it and the handle under the pointer
		// would never reach accent.
		//
		// The pointer arm passes through the same `--resize-hint-gate` as the
		// row hint: horizontal scrolling drags columns under a still pointer, so
		// a boundary arriving beneath it mid-scroll is no more intentional than
		// the row-level reveal. Focus-visible is ungated — focus is always
		// deliberate.
		'--indicator-color': {
			default: 'var(--resize-hint, transparent)',
			':hover:where(:not(:disabled,[aria-disabled="true"]))': `var(--resize-hint-gate, ${colorVars['--color-accent']})`,
			':focus-visible': colorVars['--color-accent']
		},
		// Pointer capability gates the REVEAL, not the control. The handle stays
		// rendered and focusable wherever any input can drive it, so a coarse
		// device with a keyboard keeps its tab stop, its accessible name, and
		// arrow-key resize. `pointer-events: none` removes it from touch without
		// removing it from the accessibility tree the way `display: none` did.
		'@media (pointer: coarse)': {
			pointerEvents: 'none'
		}
	},
	/**
	 * The 1px indicator line as a pseudo-element on the trailing edge.
	 * Spans the full height of the handle (which extends the table height).
	 * Reads --indicator-color from the parent, which toggles on
	 * hover, focus-visible, and during drag.
	 */
	indicator: {
		'::after': {
			content: '""',
			position: 'absolute',
			// Position on the column boundary (right edge of the handle)
			// so the visual line aligns with the column divider. The 8px
			// hit area extends to the left of it.
			insetInlineEnd: 0,
			top: 0,
			bottom: 0,
			width: 'var(--indicator-width, 1px)',
			backgroundColor: 'var(--indicator-color, transparent)',
			transition: 'background-color 150ms ease, width 150ms ease'
		}
	}
});

/**
 * Publishes the hint colour the handles read at rest. Hover has to be caught
 * on the row so that entering the header anywhere reveals every boundary, not
 * only the cell under the pointer. Pointer-only — there is no hover to lead
 * with on touch, and the handles ignore touch there regardless.
 *
 * `--resize-hint-gate` is the scroll gate: the scroll listener sets it to
 * `transparent` on the scroll wrapper while the region is moving, which wins
 * here because a set custom property beats the fallback arm of `var()`. Hover
 * keeps resolving underneath — the gate just hides its result until the region
 * settles.
 *
 * Focus is deliberately absent: focusing a boundary emphasizes that one
 * boundary and never raises this row-level hint.
 */
const headerRowStyles = stylex.create({
	base: {
		'--resize-hint': {
			default: 'transparent',
			'@media (hover: hover)': {
				default: 'transparent',
				':hover:where(:not(:disabled,[aria-disabled="true"]))': `var(--resize-hint-gate, ${colorVars['--color-border']})`
			}
		}
	}
});

const headerCellRelative = stylex.create({
	base: {
		position: 'relative',
		overflow: 'visible'
	}
});

/** The draggable `role="separator"` sitting on a header cell's trailing edge. */
export function resizeHandleAttrs(): SvelteStyleAttrs {
	return sx(handleStyles.base, handleStyles.indicator);
}

/** Pushed onto the header row's `xstyle` so every boundary reveals on hover. */
export const headerRowStyle: StyleArg = headerRowStyles.base;

/** Pushed onto a resizable header cell's `xstyle` so the handle can position. */
export const headerCellRelativeStyle: StyleArg = headerCellRelative.base;
