import * as stylex from '@stylexjs/stylex';
import { typeScaleVars, typographyVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `Layer/layerTextReset.stylex.ts`.
 *
 * Apply before component and consumer styles on the layer's content boundary.
 * Top-layer promotion does not stop DOM inheritance. Resets text formatting,
 * not writing context, theme variables, surface colors, geometry, or
 * interaction.
 */
export const layerTextReset = stylex.create({
	reset: {
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-body-size'],
		fontWeight: typeScaleVars['--text-body-weight'],
		lineHeight: typeScaleVars['--text-body-leading'],
		fontStyle: 'normal',
		textAlign: 'start',
		textAlignLast: 'auto',
		textIndent: 0,
		textTransform: 'none',
		letterSpacing: 'normal',
		wordSpacing: 'normal',
		textShadow: 'none',
		whiteSpace: 'normal',
		wordBreak: 'normal',
		overflowWrap: 'normal',
		hyphens: 'manual'
	}
});
