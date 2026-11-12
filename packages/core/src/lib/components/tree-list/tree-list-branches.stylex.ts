import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars, spacingVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `TreeList/TreeListBranches.tsx` styles.
 *
 * Upstream's `dist/` carries no style object for this module at all: both call
 * sites are static, so the compiler folded each into a literal class string.
 * Pure inline mode for the oracle.
 */
const LINE_WIDTH = 1;

/**
 * Branch margin from the left edge. No exact spacing token for 10px,
 * so we use calc(--spacing-2 + --spacing-0-5) = 8 + 2 = 10.
 */
export const BRANCH_MARGIN = `calc(${spacingVars['--spacing-2']} + ${spacingVars['--spacing-0-5']})`;

/** Per-level indent width, matching --spacing-4 (16px). */
export const LEVEL_INDENT: string = spacingVars['--spacing-4'];

const styles = stylex.create({
	// Rows span the full width of the list and carry their indent inside, so
	// the guide columns sit inside the row boxes of deeper rows. Lift the guides
	// above the rows so a hovered or selected row's fill never breaks the line,
	// and let pointer input fall through to the row underneath.
	container: {
		height: '100%',
		// From the row wrapper's top edge, so a line spans the gap padding above
		// the row too.
		insetBlockStart: 0,
		position: 'absolute',
		width: spacingVars['--spacing-5'],
		zIndex: 1,
		pointerEvents: 'none'
	},
	verticalLine: {
		borderRadius: 1,
		insetInlineStart: 0,
		margin: 'auto',
		position: 'absolute',
		insetInlineEnd: 0,
		width: LINE_WIDTH,
		backgroundColor: colorVars['--color-border-emphasized']
	},
	// Guide segment spanning the full `<li>`. The row box's inter-row gap now lives
	// INSIDE the `<li>` (as `padding-block` on the row wrapper), so `height: 100%`
	// already covers it — the segment only needs the original `1px` to bridge the
	// hairline into the next contiguous sibling so the connector reads as one
	// continuous line. Independent of `--tree-list-row-gap`: the gap is absorbed by
	// the `<li>` height, not added on top here.
	verticalFull: {
		height: 'calc(100% + 1px)'
	},
	// Last-in-group connector: nothing sits below, so the segment must not run
	// through the row wrapper's bottom `padding-block` (`--tree-list-row-gap` / 2)
	// into empty space. Clamp it back by that half-gap so it ends exactly at the
	// row box's bottom edge. At the default `--spacing-0-5` gap this trims the 1px
	// of bottom padding; at `0px` it is exactly `100%` — no overhang at any gap.
	verticalLast: {
		height: 'calc(100% - var(--tree-list-row-gap, 0px) / 2)'
	}
});

/**
 * One full-height connector column. Its `left` offset is a per-instance calc,
 * so it stays an inline `style` exactly as upstream's `mergeProps({style})` does.
 */
export function treeBranchContainerAttrs(): SvelteStyleAttrs {
	return sx(styles.container);
}

/**
 * The 1px rule inside a connector column.
 *
 * `isLast` is the current item's own terminus: with no sibling below it, the
 * segment is clamped to the row box's bottom edge instead of bridging into the
 * inter-row gap. Every other segment — including all the ancestor continuation
 * columns, which by construction have a row below them — bridges the gap so the
 * line stays continuous.
 */
export function treeBranchLineAttrs(isLast: boolean): SvelteStyleAttrs {
	return sx(styles.verticalLine, isLast ? styles.verticalLast : styles.verticalFull);
}
