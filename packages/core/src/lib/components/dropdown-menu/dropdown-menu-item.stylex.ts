import * as stylex from '@stylexjs/stylex';
import type { StyleArg } from '../../internal/sx.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { menuPressLitRowStyle } from '../../private-attributes/menu-press-lit.stylex.js';
import {
	colorVars,
	focusVars,
	spacingVars,
	typographyVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';

/** The menu size, driven by the trigger button's size. */
export type DropdownMenuSize = 'sm' | 'md' | 'lg';

const menuItemStyles = stylex.create({
	root: {
		boxSizing: 'border-box',
		width: '100%',
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-2'],
		borderRadius: `max(0px, calc(var(--_dropdown-menu-radius, ${spacingVars['--spacing-2']}) - var(--_dropdown-menu-padding, ${spacingVars['--spacing-1']})))`,
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-label-size'],
		color: colorVars['--color-text-primary'],
		// Focus is the *sole* highlight source: `focusMenuItemOnHover` moves focus
		// to the pointed-at row, so a `:hover` background here would leave the
		// keyboard-focused row highlighted at the same time as the hovered one.
		// A held finger or pen sets the focus-paint variable on the lit row.
		backgroundColor: {
			default: 'transparent',
			':focus': `var(--_menu-row-focus-paint, ${colorVars['--color-overlay-hover']})`,
			// The pressed look only where hover exists. Under a finger the row a
			// press BEGAN on would otherwise stay painted while the highlight
			// (focus) moves to the row under the finger — two rows lit.
			'@media (hover: hover)': {
				default: null,
				':active:where(:not(:disabled,[aria-disabled="true"]))': `var(--_menu-row-active-paint, ${colorVars['--color-overlay-pressed']})`
			}
		},
		borderWidth: 0,
		borderStyle: 'none',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		textAlign: 'start',
		// Rows show focus with a translucent overlay, which forced colors replace
		// with the page color. The standard focus ring (`focusOutlineStyles`),
		// drawn inside the row by its own width, marks the focused row in every
		// mode.
		outlineOffset: `calc(-1 * ${focusVars['--focus-outline-width']})`
	},
	disabled: {
		opacity: 0.5,
		cursor: 'default'
	},
	destructive: {
		// Only recolor the text/icon; the hover / focus background stays the shared
		// neutral overlay from `root` so the hover state matches every other menu
		// item. The semantic status foreground covers the label, description, icon,
		// and any bare text on a plain surface.
		color: colorVars['--color-text-error'],
		'--_item-label-color': colorVars['--color-text-error'],
		'--_item-description-color': colorVars['--color-text-error']
	}
});

const itemSizeStyles = stylex.create({
	sm: {
		paddingBlock: spacingVars['--spacing-1'],
		paddingInline: spacingVars['--spacing-2']
	},
	md: {
		paddingBlock: spacingVars['--spacing-1-5']
	},
	lg: {}
});

/**
 * The `xstyle` array passed to `Item` — upstream's
 * `[menuItemStyles.root, itemSizeStyles[size], isDestructive && menuItemStyles.destructive,
 * isDisabled && menuItemStyles.disabled, xstyle]`.
 */
export function dropdownMenuItemXstyle(
	size: DropdownMenuSize,
	isDisabled: boolean,
	isDestructive: boolean,
	xstyle?: StyleArg
): StyleArg {
	return [
		focusOutlineStyles.focusVisible,
		menuItemStyles.root,
		menuPressLitRowStyle,
		itemSizeStyles[size],
		isDestructive && menuItemStyles.destructive,
		isDisabled && menuItemStyles.disabled,
		xstyle
	];
}
