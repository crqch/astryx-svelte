import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../../../internal/sx.js';
import { colorVars, radiusVars, spacingVars } from '../../../../styles/tokens.stylex.js';
import { focusOutlineProps } from '../../../../utils/focus-outline.stylex.js';

/**
 * Ported from the styles declared in Astryx's
 * `Table/plugins/sortable/useTableSortable.tsx`.
 *
 * Group name is upstream's (`sortStyles`) so the class oracle needs no rename.
 */

const sortStyles = stylex.create({
	button: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		backgroundColor: 'transparent',
		borderWidth: 0,
		borderStyle: 'none',
		padding: 0,
		margin: 0,
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		font: 'inherit',
		color: 'inherit',
		width: '100%',
		height: '100%',
		textAlign: 'inherit',
		borderRadius: radiusVars['--radius-inner']
	},
	// The button is a full-width flex container, so the `textAlign` a column's
	// `align` puts on the `<th>` cannot position its contents. Mirror the column
	// alignment onto the main axis, or an `align: 'end'` numeric column ends up
	// with a left-hugging header over right-aligned figures.
	buttonAlignCenter: {
		justifyContent: 'center'
	},
	buttonAlignEnd: {
		justifyContent: 'flex-end'
	},
	// The wrapper takes no block size, so a theme's larger glyph overflows it
	// instead of growing the Sort control or the header row. When the slot hides
	// the glyph, the empty wrapper collapses, so the button's gap does not offset
	// an end-aligned label.
	iconWrapper: {
		display: { default: 'inline-flex', ':empty': 'none' },
		alignItems: 'center',
		blockSize: 0
	},
	iconWrapperUnsorted: {
		opacity: {
			default: 0.35,
			':is(th:hover *)': 1,
			':focus-visible': 1
		}
	},
	rank: {
		fontSize: 10,
		// no token for lineHeight:1 (tight badge) — upstream disables its own
		// `no-hardcoded-styles` rule on this line for the same reason
		lineHeight: '1',
		color: colorVars['--color-text-accent']
	}
});

/** The full-bleed button that makes a sortable header clickable. */
export function sortButtonAttrs(align: 'start' | 'center' | 'end' | undefined): SvelteStyleAttrs {
	return focusOutlineProps.focusVisible(
		sortStyles.button,
		align === 'end'
			? sortStyles.buttonAlignEnd
			: align === 'center'
				? sortStyles.buttonAlignCenter
				: undefined
	);
}

/** The icon wrapper — dimmed until hover/focus while the column is unsorted. */
export function sortIconWrapperAttrs(isActive: boolean): SvelteStyleAttrs {
	return sx(sortStyles.iconWrapper, !isActive && sortStyles.iconWrapperUnsorted);
}

/** The small ordinal badge shown on secondary sorts in multi-sort mode. */
export function sortRankAttrs(): SvelteStyleAttrs {
	return sx(sortStyles.rank);
}
