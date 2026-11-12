// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file gliding-divider.stylex.ts
 * @input Table rows a row glide moves (Web Animations on the `<tr>`), their
 *   computed borders, StyleX
 * @output `glidingDividerStyles`: a row's stand-in divider while it glides
 * @position Table internals. With collapsed borders the table paints every
 *   border at its cell's static place, so a row that moves leaves its divider
 *   behind. For the glide only, the moving row's cells are marked: their
 *   borders go transparent (their width stays, so nothing reflows) and one of
 *   them draws the same divider across the whole row in its ::after, which
 *   moves with the row. A pinned cell draws its own over it
 *   (plugins/sticky-columns).
 *
 * Ported from Astryx's `Table/glidingDivider.ts`. The runtime that marks rows
 * (`markGlidingRows`, `rowEdge`, `dividerOffset`) waits on the table's glide
 * integration; the styles are what the static cell and row call sites need.
 */

import * as stylex from '@stylexjs/stylex';
import { colorVars } from '../../styles/tokens.stylex.js';

/**
 * On a row while a glide moves it.
 * Kept as the runtime's attribute name for the eventual mark.
 */
export const GLIDING_ATTRIBUTE = 'data-astryx-row-gliding';
const GLIDING = '[data-astryx-row-gliding]';
/**
 * On each cell of a moving row; `line` on the one that draws the row's
 * divider. On the cells themselves, so a table nested in a moving row keeps
 * its own dividers.
 */
const CELL_GLIDING = '[data-astryx-cell-gliding]';
const CELL_LINE = '[data-astryx-cell-gliding="line"]';

/**
 * On a pinned (sticky) cell, written by plugins/sticky-columns. Named here
 * because that plugin already imports this module; naming it there would make
 * the two import each other.
 */
export const PINNED_ATTRIBUTE = 'data-astryx-table-pinned';

/**
 * A row's divider, carried on the row for its glide. Names no cell sets, so
 * a pinned cell's own carry (plugins/sticky-columns) cannot shadow them.
 */
export const GLIDE_DIVIDER_WIDTH = '--_table-row-glide-width';
export const GLIDE_DIVIDER_STYLE = '--_table-row-glide-style';
export const GLIDE_DIVIDER_COLOR = '--_table-row-glide-color';

export const glidingDividerStyles = stylex.create({
	/**
	 * On every cell with a row divider: it goes transparent while the row
	 * moves, and the row's line cell draws the divider across the row's bottom
	 * edge, where the collapsed border sits. The line is positioned against the
	 * row (the cell is not positioned), so the cell's own overflow does not clip
	 * it, and it is a box inside a cell, not a box in the row, so the table's
	 * column widths do not change.
	 */
	cell: {
		borderBottomColor: {
			default: colorVars['--color-border'],
			[CELL_GLIDING]: 'transparent'
		},
		// Every declaration only on the line cell: a pinned cell's own ::after
		// (its scroll shadow) stays untouched.
		'::after': {
			content: { default: null, [CELL_LINE]: '""' },
			position: { default: null, [CELL_LINE]: 'absolute' },
			insetInline: { default: null, [CELL_LINE]: 0 },
			// Where the collapsed edge rests below the row's padding box (a wide
			// border, or the row's own): measured when the row is marked.
			bottom: {
				default: null,
				[CELL_LINE]: 'calc(-1 * var(--_table-row-glide-offset, 0px))'
			},
			height: { default: null, [CELL_LINE]: 0 },
			borderBottomWidth: {
				default: null,
				[CELL_LINE]: `var(${GLIDE_DIVIDER_WIDTH}, 0px)`
			},
			borderBottomStyle: {
				default: null,
				[CELL_LINE]: `var(${GLIDE_DIVIDER_STYLE}, solid)`
			},
			borderBottomColor: {
				default: null,
				[CELL_LINE]: `var(${GLIDE_DIVIDER_COLOR}, ${colorVars['--color-border']})`
			},
			pointerEvents: { default: null, [CELL_LINE]: 'none' }
		}
	},
	/**
	 * After `cell` on a detail panel's cell: its divider color is the one its
	 * row hands down (plugins/row-expansion).
	 */
	panelCell: {
		borderBottomColor: {
			default: `var(--_table-panel-divider-color, ${colorVars['--color-border']})`,
			[CELL_GLIDING]: 'transparent'
		}
	},
	/**
	 * On every row: while it moves it is the line's containing block. Its
	 * motion (a `translate`) makes it one; `position: relative` keeps it so
	 * for a panel playing in, which does not move.
	 */
	row: {
		position: {
			default: null,
			[GLIDING]: 'relative'
		}
	}
});
