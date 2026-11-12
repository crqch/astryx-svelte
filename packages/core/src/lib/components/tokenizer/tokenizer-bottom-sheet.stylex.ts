import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars, radiusVars, sizeVars, spacingVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `Tokenizer/TokenizerBottomSheet.tsx`, where these
 * styles are inline in the component file. The group names and declarations
 * are upstream's, so the class oracle can compare them key for key.
 */

const styles = stylex.create({
	body: {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		minHeight: 0,
		paddingInline: spacingVars['--spacing-3'],
		// With the sheet's band under its grab bar (--spacing-6), this keeps the
		// first row --spacing-8 below the sheet's top edge.
		paddingBlockStart: spacingVars['--spacing-2'],
		paddingBlockEnd: spacingVars['--spacing-3']
	},
	// The sheet has no dedicated close button; it keeps BottomSheet's gesture,
	// scrim, and Escape dismissal paths, and the footer's Done.
	searchRow: {
		paddingBlockEnd: spacingVars['--spacing-2']
	},
	// A dropdown panel is already a bordered box, so its search field has no
	// border. The sheet is not, so its field takes the shared input box at the
	// `lg` height.
	searchField: {
		minHeight: sizeVars['--size-element-lg'],
		paddingBlock: spacingVars['--spacing-1']
	},
	list: {
		display: 'flex',
		flexDirection: 'column',
		flexGrow: 1,
		overflowY: 'auto',
		minHeight: 0
	},
	rows: {
		display: 'flex',
		flexDirection: 'column'
	},
	rowItem: {
		display: 'contents'
	},
	row: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacingVars['--spacing-2'],
		width: '100%',
		minHeight: 44,
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-1'],
		borderWidth: 0,
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: 'transparent',
		color: colorVars['--color-text-primary'],
		fontFamily: 'inherit',
		textAlign: 'start',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	// An aria-disabled row gets no system disabled paint in forced colors;
	// GrayText is the platform's disabled affordance there. The default repeats
	// the base value, since StyleX merges per property.
	rowDisabled: {
		color: {
			default: colorVars['--color-text-primary'],
			'@media (forced-colors: active)': 'GrayText'
		}
	},
	rowLabel: {
		flexGrow: 1,
		minWidth: 0
	},
	// Same for the indicator's border: GrayText in forced colors, and the
	// default repeats the indicator's disabled border.
	indicatorDisabled: {
		borderColor: {
			default: colorVars['--color-border'],
			'@media (forced-colors: active)': 'GrayText'
		}
	},
	createRow: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		width: '100%',
		minHeight: 44,
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-1']
	},
	createLabel: {
		flexGrow: 1,
		minWidth: 0
	},
	footer: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		paddingBlockStart: spacingVars['--spacing-3'],
		marginTop: 'auto'
	},
	footerAction: {
		flexGrow: 1,
		flexBasis: 0
	},
	emptyHost: {
		display: 'contents'
	},
	empty: {
		flexGrow: 1
	},
	pending: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 44,
		paddingBlock: spacingVars['--spacing-2']
	}
});

/** The sheet content column. */
export function sheetBodyAttrs(): SvelteStyleAttrs {
	return sx(styles.body);
}

/** The search field's row. */
export function sheetSearchRowAttrs(): SvelteStyleAttrs {
	return sx(styles.searchRow);
}

/** `fieldXstyle` for the sheet's search field. */
export const sheetSearchFieldStyle: StyleArg = styles.searchField;

/** The scrollable results column. */
export function sheetListAttrs(): SvelteStyleAttrs {
	return sx(styles.list);
}

/** The `role="list"` row container. */
export function sheetRowsAttrs(): SvelteStyleAttrs {
	return sx(styles.rows);
}

/** A listitem wrapper. */
export function sheetRowItemAttrs(): SvelteStyleAttrs {
	return sx(styles.rowItem);
}

/** A checkbox row, greyed in forced colors when aria-disabled. */
export function sheetRowAttrs(rowDisabled: boolean): SvelteStyleAttrs {
	return sx(styles.row, rowDisabled && styles.rowDisabled);
}

/** The row's label, growing beside the indicator. */
export const sheetRowLabelStyle: StyleArg = styles.rowLabel;

/** The indicator's forced-colors border when the row is disabled. */
export const sheetIndicatorDisabledStyle: StyleArg = styles.indicatorDisabled;

/** The create row above the results. */
export function sheetCreateRowAttrs(): SvelteStyleAttrs {
	return sx(styles.createRow);
}

/** `xstyle` for the create row's label. */
export const sheetCreateLabelStyle: StyleArg = styles.createLabel;

/** The pinned footer. */
export function sheetFooterAttrs(): SvelteStyleAttrs {
	return sx(styles.footer);
}

/** `xstyle` for each equal-width footer action. */
export const sheetFooterActionStyle: StyleArg = styles.footerAction;

/** A custom empty state's host. */
export function sheetEmptyHostAttrs(): SvelteStyleAttrs {
	return sx(styles.emptyHost);
}

/** `xstyle` for the empty state itself. */
export const sheetEmptyStyle: StyleArg = styles.empty;

/** The pending row holding the busy Spinner. */
export function sheetPendingAttrs(): SvelteStyleAttrs {
	return sx(styles.pending);
}
