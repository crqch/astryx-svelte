import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { spacingVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `DropdownMenu/menuBottomSheet.stylex.ts`.
 *
 * The content box shared by `DropdownMenu` and `ContextMenu` sheets. The sheet
 * itself gets no content padding, so this element carries the inset a wrapper
 * used to: 4px at the sides and none above or below, and the container
 * variables tell bleeding children the padding actually applied.
 */
export const menuBottomSheetStyles = stylex.create({
	content: {
		boxSizing: 'border-box',
		paddingBlockStart: 0,
		paddingBlockEnd: 0,
		paddingInline: spacingVars['--spacing-1'],
		'--container-padding-inline-start': spacingVars['--spacing-1'],
		'--container-padding-inline-end': spacingVars['--spacing-1'],
		'--container-padding-block-start': '0px',
		'--container-padding-block-end': '0px'
	},
	// The heading alone, without a back button beside it, keeps the row's gap
	// to the actions.
	headingAlone: {
		marginBottom: spacingVars['--spacing-2']
	}
});

/** The shared sheet content box, with the caller's `xstyle` last. */
export function menuBottomSheetContentAttrs(xstyle?: StyleArg): SvelteStyleAttrs {
	return sx(menuBottomSheetStyles.content, xstyle);
}

/** The root view heading's gap to the actions when it stands alone. */
export const menuBottomSheetHeadingAloneStyle: StyleArg = menuBottomSheetStyles.headingAlone;
