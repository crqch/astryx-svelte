/**
 * Ported from Astryx's `Selector/selectorPresentation.stylex.ts`.
 *
 * Shared focus-return styles for Selector and MultiSelector.
 */

import * as stylex from '@stylexjs/stylex';
import { colorVars } from '../../styles/tokens.stylex.js';

export const selectorPresentationStyles = stylex.create({
	pointerRestoredFocus: {
		borderColor: colorVars['--color-border-emphasized'],
		boxShadow: 'none',
		outlineWidth: '0',
		outlineStyle: 'none'
	}
});
