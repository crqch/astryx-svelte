import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { touchHitAreaStyles } from '../../internal/touch-hit-area.stylex.js';
import { spacingVars } from '../../styles/tokens.stylex.js';

const styles = stylex.create({
	group: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1']
	},
	vertical: {
		flexDirection: 'column',
		alignItems: 'stretch'
	},
	// While the group tracks presses, its hit layer is the root's `::before`,
	// below its toggles, so the root is the layer's containing block.
	tracking: {
		position: 'relative'
	}
});

/** The group container styles; `vertical` stacks the buttons. `xstyle` is last. */
export function toggleButtonGroupAttrs(
	orientation: 'horizontal' | 'vertical',
	tracksPress: boolean,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return sx(
		styles.group,
		tracksPress && styles.tracking,
		tracksPress && touchHitAreaStyles.layerBelowChildren,
		orientation === 'vertical' && styles.vertical,
		xstyle
	);
}
