import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from the `styles` block in Astryx's `Chat/useTriggerMenu.tsx`.
 *
 * `item` clears its border with `borderWidth: 0` and `borderStyle: 'none'`.
 * StyleX drops the `border` shorthand, so the two longhands are what emit the
 * rules the compiled sheet carries.
 */
const styles = stylex.create({
	dropdown: {
		boxSizing: 'border-box',
		maxHeight: '240px',
		overflowY: 'auto',
		padding: spacingVars['--spacing-1'],
		minWidth: '180px'
	},
	popoverSurface: {
		minWidth: '180px'
	},
	item: {
		boxSizing: 'border-box',
		display: 'flex',
		alignItems: 'center',
		width: '100%',
		padding: spacingVars['--spacing-2'],
		borderRadius: radiusVars['--radius-element'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		outline: 'none',
		backgroundColor: 'transparent',
		borderWidth: 0,
		borderStyle: 'none',
		textAlign: 'start' as const,
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading'],
		color: colorVars['--color-text-primary']
	},
	itemHighlighted: {
		backgroundColor: colorVars['--color-overlay-hover']
	},
	itemLabel: {
		flex: 1,
		minWidth: 0,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	},
	emptyState: {
		padding: spacingVars['--spacing-3'],
		textAlign: 'center' as const,
		fontSize: typeScaleVars['--text-supporting-size'],
		color: colorVars['--color-text-secondary']
	},
	loadingState: {
		padding: spacingVars['--spacing-3'],
		textAlign: 'center' as const,
		fontSize: typeScaleVars['--text-supporting-size'],
		color: colorVars['--color-text-secondary']
	},
	groupHeading: {
		paddingInline: spacingVars['--spacing-2'],
		paddingBlockStart: spacingVars['--spacing-2'],
		paddingBlockEnd: spacingVars['--spacing-1'],
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading'],
		color: colorVars['--color-text-secondary'],
		userSelect: 'none'
	}
});

export function triggerMenuDropdownAttrs(): SvelteStyleAttrs {
	return sx(styles.dropdown);
}

export function triggerMenuItemAttrs(isHighlighted: boolean): SvelteStyleAttrs {
	return sx(styles.item, isHighlighted && styles.itemHighlighted);
}

export function triggerMenuItemLabelAttrs(): SvelteStyleAttrs {
	return sx(styles.itemLabel);
}

export function triggerMenuEmptyStateAttrs(): SvelteStyleAttrs {
	return sx(styles.emptyState);
}

export function triggerMenuLoadingStateAttrs(): SvelteStyleAttrs {
	return sx(styles.loadingState);
}

export function triggerMenuGroupHeadingAttrs(): SvelteStyleAttrs {
	return sx(styles.groupHeading);
}

/** The `xstyle` upstream hands to `popover.render` for the positioned surface. */
export const triggerMenuPopoverStyle: StyleArg = styles.popoverSurface;

/** The clearance upstream passes to `popover.render`'s `offset`. */
export const triggerMenuPopoverOffset = spacingVars['--spacing-1'];
