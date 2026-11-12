import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { spacingVars, sizeVars, typeScaleVars } from '../../styles/tokens.stylex.js';

const styles = stylex.create({
	container: {
		display: 'flex',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: spacingVars['--spacing-3']
	},
	// Compensate for the medium icon button's visual padding on the end slot.
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
		// Visual centering: align title center with close button center
		// buttonCenter = size-element-md/2 = 16px (close button midpoint relative to edge)
		// titleCenter = heading-2-size * heading-2-leading / 2 = 14px
		// adjustment = 8 - 14 = -6px
		marginBlock: `calc(${sizeVars['--size-element-md']} / 2 - ${spacingVars['--spacing-2']} - ${typeScaleVars['--text-heading-2-size']} * ${typeScaleVars['--text-heading-2-leading']} / 2)`
	},
	titleFocusable: {
		outline: 'none'
	},
	actions: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		flexShrink: 0
	}
});

export function dialogHeaderContainerAttrs(): SvelteStyleAttrs {
	return sx(styles.container);
}

export function dialogHeaderTitleWrapperAttrs(): SvelteStyleAttrs {
	return sx(styles.titleWrapper);
}

/**
 * The actions cluster. `compensateBlock` / `compensateInline` pull the icon
 * button's padding back on each axis independently, as upstream's
 * `endContentEdgeCompensation` prop does.
 */
export function dialogHeaderActionsAttrs(
	compensateBlock: boolean,
	compensateInline: boolean
): SvelteStyleAttrs {
	return sx(
		styles.actions,
		compensateBlock && styles.endBlockEdgeCompensation,
		compensateInline && styles.endInlineEdgeCompensation
	);
}

/** Passed to the title `Heading` as `xstyle` — removes its focus outline. */
export const titleFocusableStyle: StyleArg = styles.titleFocusable;
