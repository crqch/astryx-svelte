import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { touchHitAreaStyles } from '../../internal/touch-hit-area.stylex.js';
import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	spacingVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `InfoTip/InfoTip.tsx`.
 *
 * The trigger is the whole surface: a transparent, round button sized by the
 * icon it contains. Under a coarse pointer its `::after` is the shared touch
 * hit band, which `useTouchHitArea` grows toward a 44 px target as far as its
 * neighbours allow.
 */
const styles = stylex.create({
	trigger: {
		position: 'relative',
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		verticalAlign: 'middle',
		padding: spacingVars['--spacing-0-5'],
		margin: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		borderRadius: radiusVars['--radius-full'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		color: {
			default: colorVars['--color-icon-secondary'],
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				default: null,
				'@media (hover: hover)': colorVars['--color-icon-primary']
			}
		},
		transitionProperty: 'color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	}
});

export function infoTipTriggerAttrs(xstyle?: StyleArg): SvelteStyleAttrs {
	return sx(focusOutlineStyles.focusVisible, styles.trigger, touchHitAreaStyles.layer, xstyle);
}
