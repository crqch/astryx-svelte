import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { menuPressLitRowStyle } from '../../private-attributes/menu-press-lit.stylex.js';
import { layerViewportInset } from '../layer/layer-viewport-inset.stylex.js';
import {
	colorVars,
	durationVars,
	easeVars,
	focusVars,
	radiusVars,
	shadowVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';
import type { DropdownMenuSize } from './dropdown-menu-item.stylex.js';

/**
 * Ported from Astryx's `DropdownMenu/DropdownMenuSubMenu.tsx` styles.
 *
 * The trigger row's groups reach `Item`'s `xstyle` as an array beside a dynamic
 * `triggerSizeStyles[menuSize]` index, so they stay objects exactly as
 * `DropdownMenuItem`'s do. `caret` and `flyoutStyles.menu` each resolve at a
 * single call site.
 *
 * The trigger carries NO `:hover` background: like every other menu row, the
 * single highlight is focus-driven, and `focusMenuItemOnHover` moves focus onto
 * the trigger as the pointer enters it. A `:hover` rule here would paint a
 * second highlight beside the sibling item that still holds focus; the focus
 * paint itself reads `--_menu-row-focus-paint`, which the press model sets on
 * the row a held finger lights.
 *
 * `regionStyles` and `drillInStyles` are the sub-menu's two other surfaces: the
 * dialog frame that holds a header and footer, and the drilled-in view a phone
 * shows in place of the parent's rows. Both render against the root menu's
 * surface host and view stack.
 */

// The flyout's own lower cap on the placement axis; the viewport cap under
// it and the inline gutter beside it are the layer runtime's.
const MENU_BLOCK_CAP = '300px';
const MENU_MAX_BLOCK_SIZE = `min(${MENU_BLOCK_CAP}, ${layerViewportInset.maxBlockSize})`;
const MENU_MAX_BLOCK_SIZE_FALLBACK = `min(${MENU_BLOCK_CAP}, ${layerViewportInset.maxBlockSizeFallback})`;

const triggerStyles = stylex.create({
	root: {
		boxSizing: 'border-box',
		width: '100%',
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-2'],
		borderRadius: `max(0px, calc(var(--_dropdown-menu-radius, ${spacingVars['--spacing-2']}) - var(--_dropdown-menu-padding, ${spacingVars['--spacing-1']})))`,
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-label-size'],
		color: colorVars['--color-text-primary'],
		backgroundColor: {
			default: 'transparent',
			// menuPressLitRowStyle sets the variable on the row a held finger or pen
			// lights.
			':focus': `var(--_menu-row-focus-paint, ${colorVars['--color-overlay-hover']})`
		},
		borderWidth: 0,
		borderStyle: 'none',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		textAlign: 'start',
		// Rows show focus with a translucent overlay, which forced colors replace
		// with the page color. The standard focus ring (focusOutlineStyles), drawn
		// inside the row by its own width, marks the focused row in every mode.
		outlineOffset: `calc(-1 * ${focusVars['--focus-outline-width']})`
	},
	// While the flyout is open, keep the trigger visibly active so the open
	// branch reads as the current path even when focus has moved into the child.
	open: {
		backgroundColor: colorVars['--color-overlay-hover']
	},
	disabled: {
		opacity: 0.5,
		cursor: 'default'
	},
	caret: {
		display: 'flex',
		alignItems: 'center'
	}
});

const triggerSizeStyles = stylex.create({
	sm: {
		paddingBlock: spacingVars['--spacing-1'],
		paddingInline: spacingVars['--spacing-2']
	},
	md: {
		paddingBlock: spacingVars['--spacing-1-5']
	},
	lg: {}
});

const flyoutStyles = stylex.create({
	menu: {
		boxSizing: 'border-box',
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-0-5'],
		maxInlineSize: stylex.firstThatWorks(
			`calc(${layerViewportInset.maxInlineSize})`,
			`calc(${layerViewportInset.maxInlineSizeFallback})`
		),
		maxHeight: stylex.firstThatWorks(MENU_MAX_BLOCK_SIZE, MENU_MAX_BLOCK_SIZE_FALLBACK),
		'--_dropdown-menu-radius': radiusVars['--radius-container'],
		'--_dropdown-menu-padding': spacingVars['--spacing-1'],
		padding: spacingVars['--spacing-1'],
		borderRadius: 'var(--_dropdown-menu-radius)',
		backgroundColor: colorVars['--color-background-popover'],
		boxShadow: shadowVars['--shadow-low'],
		// Forced colors removes box-shadow, which is this surface's only edge.
		borderWidth: { default: null, '@media (forced-colors: active)': '1px' },
		borderStyle: { default: null, '@media (forced-colors: active)': 'solid' },
		borderColor: { default: null, '@media (forced-colors: active)': 'CanvasText' },
		opacity: 1,
		transitionProperty: 'opacity',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
		// A held finger drives the highlight; the browser's held-press callout
		// and text selection must not compete with it.
		WebkitTouchCallout: 'none',
		userSelect: 'none'
	},
	scrollable: {
		overflowY: 'auto',
		overflowX: 'hidden',
		overscrollBehavior: 'contain'
	},
	// Scroll ownership by the browser's own signal; see DropdownMenu.
	touchPinchZoom: {
		touchAction: 'pinch-zoom'
	},
	touchPanYPinchZoom: {
		touchAction: 'pan-y pinch-zoom',
		overscrollBehavior: 'contain'
	},
	popoverViewport: {
		boxSizing: 'border-box',
		// Keep the inline viewport cap on the menu surface above. Applying it to
		// the anchor-positioned popover itself prevents Chromium from selecting
		// `flip-inline` and instead shifts the flyout back across its parent.
		maxBlockSize: stylex.firstThatWorks(MENU_MAX_BLOCK_SIZE, MENU_MAX_BLOCK_SIZE_FALLBACK)
	},
	popover: {
		minWidth: stylex.firstThatWorks(
			`min(160px, ${layerViewportInset.maxInlineSize})`,
			`min(160px, ${layerViewportInset.maxInlineSizeFallback})`,
			'160px'
		)
	},
	popoverCustomWidth: (width: string) => ({
		minWidth: width
	}),
	popoverCustomIntrinsicWidth: (width: string) => ({
		inlineSize: width
	})
});

// The drilled-in list shows in place of the parent rows, inside the parent's
// own box: no surface, shadow or cap of its own.
const drillInStyles = stylex.create({
	list: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-0-5'],
		outline: 'none',
		WebkitTouchCallout: 'none',
		userSelect: 'none'
	},
	hidden: {
		display: 'none'
	}
});

// A drilled-in view with a header or footer takes the root menu's place, so
// it caps where the root does when the root's `menuMaxHeight` lifts the 300px
// cap; the viewport still bounds it.
const dynamicRegionStyles = stylex.create({
	viewMaxHeight: (maxHeight: string) => ({
		maxHeight: `min(${maxHeight}, ${layerViewportInset.maxBlockSize})`
	})
});

// With a header or footer the sub-menu's surface is a frame holding the
// header, the sub-menu's own role="menu" element and the footer, in one column
// under the flyout's block cap: the regions keep their height and the rows
// shrink and scroll between them.
const regionStyles = stylex.create({
	frame: {
		boxSizing: 'border-box',
		display: 'flex',
		flexDirection: 'column',
		maxHeight: stylex.firstThatWorks(MENU_MAX_BLOCK_SIZE, MENU_MAX_BLOCK_SIZE_FALLBACK),
		'--_dropdown-menu-radius': radiusVars['--radius-container'],
		'--_dropdown-menu-padding': spacingVars['--spacing-1'],
		borderRadius: 'var(--_dropdown-menu-radius)'
	},
	// The flyout paints its own surface; a drilled-in view sits inside the
	// root's.
	flyoutSurface: {
		// Each constant inside calc(), as for the plain flyout: a bare pair would
		// ship as var(--<hash>, <fallback>) with the hash defined nowhere.
		maxInlineSize: stylex.firstThatWorks(
			`calc(${layerViewportInset.maxInlineSize})`,
			`calc(${layerViewportInset.maxInlineSizeFallback})`
		),
		backgroundColor: colorVars['--color-background-popover'],
		boxShadow: shadowVars['--shadow-low'],
		opacity: 1,
		transitionProperty: 'opacity',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	menu: {
		boxSizing: 'border-box',
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-0-5'],
		flexGrow: 1,
		flexShrink: 1,
		minBlockSize: 0,
		padding: spacingVars['--spacing-1'],
		outline: 'none',
		WebkitTouchCallout: 'none',
		userSelect: 'none'
	},
	region: {
		flexShrink: 0,
		padding: spacingVars['--spacing-1']
	},
	hidden: {
		display: 'none'
	}
});

/**
 * The clearance that used to be a hand-rolled `marginInline` pair on both
 * popover styles. It moves to `<PopoverLayer offset>` at 0.4.x (#4951), which
 * sets the gap on both edges of the placement axis — a single-edge margin is
 * stranded on the wrong side when `position-try-fallbacks` flips the flyout.
 */
export const dropdownMenuSubMenuOffset = spacingVars['--spacing-1'];

/** The `xstyle` array handed to the trigger `Item`. */
export function subMenuTriggerXstyle(
	menuSize: DropdownMenuSize,
	isOpen: boolean,
	isDisabled: boolean,
	xstyle?: StyleArg
): StyleArg {
	return [
		focusOutlineStyles.focusVisible,
		triggerStyles.root,
		menuPressLitRowStyle,
		triggerSizeStyles[menuSize],
		isOpen && triggerStyles.open,
		isDisabled && triggerStyles.disabled,
		xstyle
	];
}

/** The trailing caret (or spinner) wrapper on the trigger row. */
export function subMenuCaretAttrs(): SvelteStyleAttrs {
	return sx(triggerStyles.caret);
}

/**
 * The flyout's `role="menu"` surface. `isScrollable` adds the scroll container
 * and the touch-action that leaves vertical scrolling to the browser; a fitting
 * flyout keeps pinch-zoom only.
 */
export function subMenuFlyoutAttrs(isScrollable: boolean): SvelteStyleAttrs {
	return sx(
		flyoutStyles.menu,
		isScrollable && flyoutStyles.scrollable,
		isScrollable ? flyoutStyles.touchPanYPinchZoom : flyoutStyles.touchPinchZoom
	);
}

/** The layer's viewport cap, applied beside the entry animation. */
export const subMenuPopoverViewportStyle: StyleArg = flyoutStyles.popoverViewport;

// `menuWidth` intrinsics are applied as `inline-size`; lengths stay a
// clamped minimum so the flyout can still grow for its content.
const INTRINSIC_INLINE_SIZES = new Set([
	'auto',
	'contain',
	'fit-content',
	'inherit',
	'initial',
	'max-content',
	'min-content',
	'revert',
	'revert-layer',
	'stretch',
	'unset'
]);

function isIntrinsicInlineSize(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return INTRINSIC_INLINE_SIZES.has(normalized) || normalized.startsWith('fit-content(');
}

/**
 * The layer's positioned element. A `menuWidth` switches to a dynamic variant,
 * which compiles to a function on both sides — so, as with `DropdownMenu`'s
 * `popoverCustomWidth`, neither extractor sees it.
 */
export function subMenuPopoverXstyle(menuWidth?: number | string): StyleArg {
	if (menuWidth == null) {
		return flyoutStyles.popover;
	}
	if (typeof menuWidth === 'string' && isIntrinsicInlineSize(menuWidth)) {
		return flyoutStyles.popoverCustomIntrinsicWidth(menuWidth.trim());
	}
	const length = typeof menuWidth === 'number' ? `${menuWidth}px` : menuWidth.trim();
	return flyoutStyles.popoverCustomWidth(
		`min(${length}, ${layerViewportInset.maxInlineSizeFallback})`
	);
}

/** A flyout frame: the surface itself, painted beside the root's menu. */
export function subMenuRegionFrameAttrs(): SvelteStyleAttrs {
	return sx(regionStyles.frame, regionStyles.flyoutSurface);
}

/** A drilled-in view's frame: inside the root's surface, capped like it. */
export function subMenuRegionViewFrameAttrs(
	isHidden: boolean,
	menuMaxHeight?: string
): SvelteStyleAttrs {
	return sx(
		regionStyles.frame,
		menuMaxHeight != null && dynamicRegionStyles.viewMaxHeight(menuMaxHeight),
		isHidden && regionStyles.hidden
	);
}

export function subMenuRegionMenuAttrs(
	isScrollable: boolean,
	isKeyboardFocused = false
): SvelteStyleAttrs {
	return sx(
		regionStyles.menu,
		isScrollable && flyoutStyles.scrollable,
		isScrollable ? flyoutStyles.touchPanYPinchZoom : flyoutStyles.touchPinchZoom,
		isKeyboardFocused && focusOutlineStyles.focusVisible
	);
}

export function subMenuRegionAttrs(): SvelteStyleAttrs {
	return sx(regionStyles.region);
}

export function subMenuRegionHiddenAttrs(): SvelteStyleAttrs {
	return sx(regionStyles.hidden);
}

export function subMenuDrillInListAttrs(isTopView: boolean): SvelteStyleAttrs {
	return sx(drillInStyles.list, !isTopView && drillInStyles.hidden);
}
