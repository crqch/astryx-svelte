import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars, durationVars, easeVars } from '../../styles/tokens.stylex.js';
import { tableRowMarker } from './table.markers.stylex.js';
import { glidingDividerStyles } from './gliding-divider.stylex.js';
import type { TableContextValue } from './table-context.svelte.js';

/**
 * Ported from the styles declared in Astryx's `Table/TableRow.tsx`.
 *
 * Group names are upstream's so the class oracle needs no renames.
 */

/**
 * Zebra striping counts body rows — and a row-expansion panel is not one.
 *
 * The panel is appended as a sibling `<tr>` (see BaseTable's `afterRow`), so a
 * plain `:nth-child(even)` counts it and every row below an open panel takes
 * the opposite stripe: expanding one row repaints half the table. Counting
 * `of :not([data-expansion-panel])` leaves the panel out of the sequence, so the
 * rows keep their parity whatever is open.
 */
const NOT_PANEL_ROW = ':nth-child(even of :not([data-expansion-panel]))';

const logicalStripedRowStyles = stylex.create({
	row: {
		backgroundColor: colorVars['--color-background-muted'],
		'--table-row-overlay': colorVars['--color-background-muted']
	},
	hover: {
		backgroundColor: {
			default: colorVars['--color-background-muted'],
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': colorVars['--color-overlay-hover']
			}
		},
		'--table-row-overlay': {
			default: colorVars['--color-background-muted'],
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': colorVars['--color-overlay-hover']
			}
		},
		transitionProperty: 'background-color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	}
});

const stripedRowStyles = stylex.create({
	row: {
		backgroundColor: {
			default: null,
			[NOT_PANEL_ROW]: colorVars['--color-background-muted']
		},
		// Publish the row's current overlay color as an inheritable variable so
		// pinned/sticky cells (which paint an opaque background over the otherwise
		// transparent row) can replay the exact same striping. Unset on odd rows.
		'--table-row-overlay': {
			default: null,
			[NOT_PANEL_ROW]: colorVars['--color-background-muted']
		}
	}
});

const hoverRowStyles = stylex.create({
	row: {
		backgroundColor: {
			default: null,
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': colorVars['--color-overlay-hover']
			}
		},
		'--table-row-overlay': {
			default: null,
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': colorVars['--color-overlay-hover']
			}
		},
		transitionProperty: 'background-color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	}
});

const stripedHoverRowStyles = stylex.create({
	row: {
		backgroundColor: {
			default: null,
			[NOT_PANEL_ROW]: colorVars['--color-background-muted'],
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': colorVars['--color-overlay-hover']
			}
		},
		'--table-row-overlay': {
			default: null,
			[NOT_PANEL_ROW]: colorVars['--color-background-muted'],
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': colorVars['--color-overlay-hover']
			}
		},
		transitionProperty: 'background-color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	}
});

/**
 * The `<tr>` itself. Always carries `tableRowMarker` — that is what scopes a
 * cell's `:last-child` ancestor check to its own row.
 *
 * Striping and hover are body-row styling: the header row must not pick either
 * up even when the table sets `isStriped`/`hasHover`. `ctx` is `null` for a row
 * rendered outside a `Table`, which renders plain plus the consumer's `xstyle`.
 */
export function tableRowAttrs(
	ctx: TableContextValue | null,
	isHeaderRow: boolean,
	xstyle: StyleArg[] | undefined,
	logicalIndex?: string | number | null
): SvelteStyleAttrs {
	if (!ctx) {
		return sx(tableRowMarker, xstyle);
	}

	const rowStyles: StyleArg[] = [];

	if (!isHeaderRow) {
		// Handle striped + hover combination to avoid backgroundColor conflicts.
		// A windowed table gives each row its logical index, which keeps the
		// stripe stable while rows mount and unmount; parity is the index's, not
		// the DOM position's.
		if (logicalIndex != null) {
			if (ctx.isStriped && Number(logicalIndex) % 2 === 1) {
				rowStyles.push(ctx.hasHover ? logicalStripedRowStyles.hover : logicalStripedRowStyles.row);
			} else if (ctx.hasHover) {
				rowStyles.push(hoverRowStyles.row);
			}
		} else if (ctx.isStriped && ctx.hasHover) {
			rowStyles.push(stripedHoverRowStyles.row);
		} else if (ctx.isStriped) {
			rowStyles.push(stripedRowStyles.row);
		} else if (ctx.hasHover) {
			rowStyles.push(hoverRowStyles.row);
		}
	}

	// Note: last-body-row border removal is handled by TableCell so it cannot
	// affect the header row in <thead>. Upstream keeps an empty `dividers`
	// branch here saying exactly that; there is nothing to run, so this port
	// records it as a comment rather than as dead code.
	if (ctx.dividers === 'rows' || ctx.dividers === 'grid') {
		// While a glide moves the row, its divider moves with it.
		rowStyles.push(glidingDividerStyles.row);
	}

	if (xstyle) {
		rowStyles.push(...xstyle);
	}

	return sx(tableRowMarker, ...rowStyles);
}
