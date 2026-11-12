import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../../../internal/sx.js';
import {
	borderVars,
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	spacingVars
} from '../../../../styles/tokens.stylex.js';
import { tableRowMarker } from '../../table.markers.stylex.js';
import { glidingDividerStyles } from '../../gliding-divider.stylex.js';
import type { TableContextValue } from '../../table-context.svelte.js';

/**
 * Ported from the styles declared in Astryx's
 * `Table/plugins/rowExpansion/useTableRowExpansion.tsx`.
 *
 * Group names are upstream's (`expansionStyles`, `dividerStyles`,
 * `panelIndentStyles`, `chevronHeaderCellStyles`, `chevronCellStyles`,
 * `chevronOffsetStyles`) so the class oracle needs no rename, and every
 * declaration is transcribed verbatim.
 *
 * **Rewritten wholesale at upstream 0.4.1 (PR #4609).** The plugin used to draw
 * hierarchy — indented child cells, a per-depth `indent(px)` function style, a
 * chevron-sized spacer, a clickable row — and now draws a full-width detail
 * panel and nothing else.
 *
 * **The chevron column's geometry is later work.** The column is a fixed 40px
 * but its cells' insets follow the spacing scale, so the header cell drops its
 * inline insets, the body cell drops its inline-start inset, and the button
 * cancels the trigger's padding (the same density step the panel indent uses)
 * and centres itself. `chevronOffsetStyles` is that cancellation, one per
 * density.
 */

/**
 * The chevron column's width, in pixels.
 *
 * A column width is a number the layout does arithmetic on, not a CSS value,
 * so this stays a fixed pixel width at every root font size. The panel's
 * indent, which has to line up with the first real column, spells the same
 * pixels rather than a spacing token: spacing is rem and grows with the root
 * font size, which would push the panel past the column it lines up with.
 */
export const EXPANSION_COLUMN_WIDTH_PX = 40;

/** The chevron button: the spacing step, never wider than its column. */
const CHEVRON_SIZE = `min(${spacingVars['--spacing-6']}, ${EXPANSION_COLUMN_WIDTH_PX}px)`;

const expansionStyles = stylex.create({
	chevronButton: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: CHEVRON_SIZE,
		height: CHEVRON_SIZE,
		backgroundColor: 'transparent',
		borderWidth: 0,
		borderStyle: 'none',
		borderRadius: radiusVars['--radius-inner'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		color: colorVars['--color-icon-secondary'],
		// Colour only. The rotation belongs to the glyph, not to the button: the
		// button is the hit target and carries the hover chip, and turning that
		// swings the rounded rectangle and its highlight around with the arrow.
		transitionProperty: 'color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
		padding: 0,
		// Match IconButton ghost hover: subtle overlay background.
		backgroundImage: {
			default: null,
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': `linear-gradient(${colorVars['--color-overlay-hover']}, ${colorVars['--color-overlay-hover']})`
			}
		},
		':hover:where(:not(:disabled,[aria-disabled="true"]))': {
			color: colorVars['--color-icon-primary']
		}
	},
	// The button takes its baseline from this fixed box. A theme's glyph size
	// or a hidden glyph then keeps the row height. The box is the toggle's
	// first child, which the glide gives its spring, so it carries the turn.
	glyphBox: {
		display: 'inline-block',
		position: 'relative',
		flexShrink: 0
	},
	glyphCenter: {
		position: 'absolute',
		inset: 0,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center'
	},
	chevron: {
		transitionProperty: 'transform',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	// The RTL mirror is folded into each state's transform rather than living on
	// a parent span, matching TreeListItem's chevron (both are `transform`, so on
	// one element the later value would win).
	chevronExpanded: {
		transform: {
			default: 'rotate(90deg)',
			':is([dir="rtl"] *)': 'scaleX(-1) rotate(90deg)'
		}
	},
	chevronCollapsed: {
		transform: {
			default: 'rotate(0deg)',
			':is([dir="rtl"] *)': 'scaleX(-1) rotate(0deg)'
		}
	},
	// The wash goes on the panel's cell, not on its row. A row that paints its
	// own box plays in under a clip that moves with its edge. On iOS that clip
	// can trail the rows that glide below it. The cell slides in with the
	// panel's content.
	mutedPanel: {
		backgroundColor: colorVars['--color-background-muted']
	},
	expandedCell: {
		paddingBlock: spacingVars['--spacing-4'],
		paddingInlineEnd: spacingVars['--spacing-5']
	},
	/** Whole-row-click expansion: signal the row is interactive. */
	clickableRow: {
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	}
});

/**
 * An expanded row and its panel are one unit, so the row divider belongs after
 * the pair rather than between them — left alone, the row's own bottom border
 * draws a line cutting it off from the detail it just opened, and the panel
 * then runs flush into the next row, which is the wrong way round.
 *
 * So the row gives up its border and the panel takes one. On a table with no
 * row dividers the suppression is a no-op (there was no border to remove) and
 * the panel's is never applied, so neither needs to consult the divider mode.
 */
const dividerStyles = stylex.create({
	expandedRowCell: {
		'--_table-row-divider-width': '0px',
		borderBottomWidth: 0
	},
	// The row's divider, carried down: its row's themed or app-set border
	// reaches the panel through `--_table-panel-divider-*` on the panel's cell
	// (set after each commit, see ExpansionPanelCell), the tokens otherwise.
	panelCell: {
		// The width this divider draws, for its stand-in during a glide.
		'--_table-row-divider-width': {
			default: `var(--_table-panel-divider-width, ${borderVars['--border-width']})`,
			[stylex.when.ancestor(':last-child', tableRowMarker)]: '0px'
		},
		borderBottomWidth: {
			default: `var(--_table-panel-divider-width, ${borderVars['--border-width']})`,
			// Same rule TableCell uses: no trailing line under the last row of the
			// table. Scoped to the marker so <tbody>, also a :last-child, does not
			// match and suppress every panel's border.
			[stylex.when.ancestor(':last-child', tableRowMarker)]: '0'
		},
		borderBottomStyle: 'var(--_table-panel-divider-style, solid)',
		borderBottomColor: `var(--_table-panel-divider-color, ${colorVars['--color-border']})`
	}
});

/**
 * Start inset for the detail panel, one per density.
 *
 * The panel is one cell spanning the whole row, so left to itself its content
 * starts at the row's edge — under the chevron, a column to the left of every
 * label it describes. These line it up with the first real column instead: the
 * chevron column's fixed width, plus the inline padding a cell of that density
 * gives its own content.
 *
 * Written as a logical property so RTL mirrors it, and kept in `calc` so the
 * padding half still tracks the spacing scale, as the cell's own padding does.
 */
const panelIndentStyles = stylex.create({
	compact: {
		paddingInlineStart: `calc(${EXPANSION_COLUMN_WIDTH_PX}px + ${spacingVars['--spacing-2']})`
	},
	balanced: {
		paddingInlineStart: `calc(${EXPANSION_COLUMN_WIDTH_PX}px + ${spacingVars['--spacing-3']})`
	},
	spacious: {
		paddingInlineStart: `calc(${EXPANSION_COLUMN_WIDTH_PX}px + ${spacingVars['--spacing-4']})`
	}
});

/**
 * The chevron sits centered in its column, as the selection checkbox does.
 *
 * The column is a fixed pixel width, but its cells' insets follow the spacing
 * scale: the first column's edge inset, plus the density padding a body cell
 * moves onto its right-click trigger. Laid out after both, the button ran past
 * the column's edge, which clips its hover chip and, under a larger spacing
 * scale or root font size, pushes the glyph out of view; and the header cell's
 * insets alone outgrow 40px at a large root, widening the column. So the
 * header cell, which holds only a visually hidden label, drops its inline
 * insets, the body cell drops its inline-start inset, and the button cancels
 * the trigger's padding (the same density step the panel indent uses) and
 * centers itself.
 */
const chevronHeaderCellStyles = stylex.create({
	cell: {
		paddingInlineStart: 0,
		paddingInlineEnd: 0
	}
});

const chevronCellStyles = stylex.create({
	cell: {
		paddingInlineStart: 0
	}
});

const chevronOffsetStyles = stylex.create({
	compact: {
		marginInlineStart: `calc((${EXPANSION_COLUMN_WIDTH_PX}px - ${CHEVRON_SIZE}) / 2 - ${spacingVars['--spacing-2']})`
	},
	balanced: {
		marginInlineStart: `calc((${EXPANSION_COLUMN_WIDTH_PX}px - ${CHEVRON_SIZE}) / 2 - ${spacingVars['--spacing-3']})`
	},
	spacious: {
		marginInlineStart: `calc((${EXPANSION_COLUMN_WIDTH_PX}px - ${CHEVRON_SIZE}) / 2 - ${spacingVars['--spacing-4']})`
	}
});

/**
 * The glyph box's size half, upstream's internal `iconBoxSizeStyles.xsm`
 * (`Icon/IconSize.stylex.ts`). `fontSize` keeps 1em-based icons in step with the
 * box. Kept beside the declarations that consume it rather than ported as a
 * new public Icon module — only this plugin reads it here.
 */
const glyphBoxSizeStyles = stylex.create({
	xsm: {
		width: '0.75rem',
		height: '0.75rem',
		fontSize: '0.75rem'
	}
});

/** The transparent, borderless chevron button, offset to sit centred. */
export function expansionChevronButtonAttrs(
	isExpanded: boolean,
	density: TableContextValue['density'] = 'balanced'
): SvelteStyleAttrs {
	return sx(expansionStyles.chevronButton, chevronOffsetStyles[density]);
}

/** The fixed box the glyph sits in; it carries the expanded rotation. */
export function expansionGlyphBoxAttrs(isExpanded: boolean): SvelteStyleAttrs {
	return sx(
		expansionStyles.glyphBox,
		glyphBoxSizeStyles.xsm,
		expansionStyles.chevron,
		isExpanded ? expansionStyles.chevronExpanded : expansionStyles.chevronCollapsed
	);
}

/** The centred layer inside the glyph box. */
export function expansionGlyphCenterAttrs(): SvelteStyleAttrs {
	return sx(expansionStyles.glyphCenter);
}

/** The detail panel's `<tr>`; it carries the row marker the cell's divider reads. */
export function expansionExpandedRowAttrs(): SvelteStyleAttrs {
	return sx(tableRowMarker);
}

/**
 * The detail panel's full-width `<td>` — density indent, optional muted wash,
 * and the row divider the row above gave up.
 */
export function expansionExpandedCellAttrs(
	isMuted: boolean,
	density: TableContextValue['density'] = 'balanced',
	hasRowDividers = false
): SvelteStyleAttrs {
	return sx(
		expansionStyles.expandedCell,
		isMuted && expansionStyles.mutedPanel,
		panelIndentStyles[density],
		hasRowDividers && dividerStyles.panelCell,
		glidingDividerStyles.cell,
		hasRowDividers && glidingDividerStyles.panelCell
	);
}

/** Pushed onto an expanded body row's cell `xstyle` so the divider closes the pair. */
export const expansionExpandedRowCellStyle: StyleArg = dividerStyles.expandedRowCell;

/** Pushed onto the expansion column's header cell `xstyle`. */
export const expansionChevronHeaderCellStyle: StyleArg = chevronHeaderCellStyles.cell;

/** Pushed onto the expansion column's body cell `xstyle`. */
export const expansionChevronCellStyle: StyleArg = chevronCellStyles.cell;

/** Pushed onto a row's `xstyle` when whole-row-click expansion is enabled. */
export const expansionClickableRowStyle: StyleArg = expansionStyles.clickableRow;
