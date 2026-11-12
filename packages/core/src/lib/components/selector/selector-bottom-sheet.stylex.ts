/**
 * Ported from Astryx's `Selector/SelectorBottomSheet.tsx`, where the two styles
 * are declared inline; they live here because Svelte components cannot import
 * StyleX.
 */

import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';
import { spacingVars } from '../../styles/tokens.stylex.js';

export const selectorBottomSheetStyles = stylex.create({
	content: {
		width: '100%'
	},
	heading: {
		marginBlockEnd: spacingVars['--spacing-2'],
		marginInline: spacingVars['--spacing-3']
	}
});

export function selectorBottomSheetContentAttrs(): SvelteStyleAttrs {
	return sx(selectorBottomSheetStyles.content);
}

/** The heading's own margin pair: `Heading` takes a `StyleArg` as `xstyle`. */
export const selectorBottomSheetHeadingStyle = selectorBottomSheetStyles.heading;
