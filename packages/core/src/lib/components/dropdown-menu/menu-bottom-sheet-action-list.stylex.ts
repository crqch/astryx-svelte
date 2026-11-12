import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars, spacingVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `DropdownMenu/MenuBottomSheetActionList.tsx` styles.
 *
 * The action rows: `ListItem` renders its action as a button (or a link). The
 * row under a held finger is the highlight, so the browser's held-press callout
 * and text selection must not compete with it.
 */
export const menuBottomSheetActionListStyles = stylex.create({
	list: {
		WebkitTouchCallout: 'none',
		userSelect: 'none'
	},
	destructiveAction: {
		'--_item-label-color': colorVars['--color-text-error'],
		'--_item-description-color': colorVars['--color-text-error'],
		color: colorVars['--color-text-error']
	},
	structuralItem: {
		listStyleType: 'none'
	},
	divider: {
		marginBlock: spacingVars['--spacing-1']
	},
	section: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-1']
	},
	sectionHeading: {
		paddingInline: spacingVars['--spacing-3']
	}
});

/** The action list's `<ul>`: no callout or selection while a finger picks. */
export function menuBottomSheetActionListAttrs(): SvelteStyleAttrs {
	return sx(menuBottomSheetActionListStyles.list);
}

/** A destructive row's label, description and icon. */
export const menuBottomSheetDestructiveActionStyle: StyleArg =
	menuBottomSheetActionListStyles.destructiveAction;

/** A divider or section `<li>` inside the action list. */
export function menuBottomSheetStructuralItemAttrs(): SvelteStyleAttrs {
	return sx(menuBottomSheetActionListStyles.structuralItem);
}

/** The rule a divider row draws. */
export const menuBottomSheetDividerStyle: StyleArg = menuBottomSheetActionListStyles.divider;

/** A titled section's group box. */
export function menuBottomSheetSectionAttrs(): SvelteStyleAttrs {
	return sx(menuBottomSheetActionListStyles.section);
}

/** A section heading, inset to the row's content edge. */
export const menuBottomSheetSectionHeadingStyle: StyleArg =
	menuBottomSheetActionListStyles.sectionHeading;
