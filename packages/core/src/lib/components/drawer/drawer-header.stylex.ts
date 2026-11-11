import * as stylex from '@stylexjs/stylex';
import { sizeVars, spacingVars, typeScaleVars } from '../../styles/tokens.stylex.js';

/** Ported from Astryx's `Drawer/DrawerHeader.tsx`. */
const styles = stylex.create({
	container: {
		display: 'flex',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: spacingVars['--spacing-3']
	},
	endBlockEdgeCompensation: {
		marginBlock: `calc(-1 * ${spacingVars['--spacing-2']})`
	},
	endInlineEdgeCompensation: {
		marginInlineEnd: `calc(-1 * ${spacingVars['--spacing-2']})`
	},
	titleWrapper: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-0'],
		flex: 1,
		minWidth: 0,
		marginBlock: `calc(${sizeVars['--size-element-md']} / 2 - ${spacingVars['--spacing-2']} - ${typeScaleVars['--text-heading-2-size']} * ${typeScaleVars['--text-heading-2-leading']} / 2)`
	},
	actions: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		flexShrink: 0
	}
});

export const drawerHeaderContainerStyle = styles.container;
export const drawerHeaderTitleWrapperStyle = styles.titleWrapper;
export const drawerHeaderActionsStyle = styles.actions;
export const drawerHeaderEndBlockCompensationStyle = styles.endBlockEdgeCompensation;
export const drawerHeaderEndInlineCompensationStyle = styles.endInlineEdgeCompensation;
