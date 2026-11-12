import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';

/** Ported from Astryx's `CommandPalette/CommandPaletteEmpty.tsx` styles. */
const styles = stylex.create({
	empty: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		paddingBlock: spacingVars['--spacing-8'],
		paddingInline: spacingVars['--spacing-4'],
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading'],
		color: colorVars['--color-text-secondary'],
		textAlign: 'center' as const,
		// Lets an unbroken token (a path or URL echoed into the message) wrap
		// instead of setting the centered line's minimum width, which pushes text
		// past both inline edges where neither side can scroll to it.
		overflowWrap: 'anywhere',
		// Text inside keeps `anywhere` too (Text FR3).
		'--_astryx-text-overflow-wrap': 'anywhere'
	}
});

/** The centred empty-state message. */
export function commandPaletteEmptyAttrs(xstyle: StyleArg): SvelteStyleAttrs {
	return sx(styles.empty, xstyle);
}
