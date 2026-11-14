import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { layerViewportInset } from '../layer/layer-viewport-inset.stylex.js';
import { menuBottomSheetStyles } from '../dropdown-menu/menu-bottom-sheet.stylex.js';
import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	shadowVars,
	spacingVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `ContextMenu/ContextMenu.tsx` styles.
 *
 * `trigger`, `menu`, `sheetMenu` and `popover` survive as objects in upstream's
 * `dist/` (each merges with an `xstyle` spread or a width branch); `cursorAnchor`
 * is a single inline call site.
 *
 * The `sheet*` keys belong to the bottom-sheet presentation. Their declarations
 * are ported here with the rest of the module even though this component's
 * markup does not render that arm yet; the attrs are exported for it.
 */
const styles = stylex.create({
	// Trigger wrapper: suppress the iOS long-press callout/selection so the
	// long-press opens our context menu instead of the native text/callout UI.
	// `position: relative` establishes the containing block for the absolutely
	// positioned cursor anchor below, so the anchor point tracks the trigger
	// (and scrolls with it) instead of the page.
	trigger: {
		position: 'relative',
		WebkitTouchCallout: 'none',
		WebkitUserSelect: 'none',
		userSelect: 'none'
	},
	// 1px anchor placed at the cursor point within the trigger. The menu is
	// anchored to this element, so it sits under the cursor yet is positioned
	// relative to the trigger's context — it follows the content on scroll and
	// the browser can auto-flip it against the viewport edges. It owns a box
	// because WebKit counts an empty anchor box as clipped, and the default
	// `position-visibility: anchors-visible` then hides the menu.
	cursorAnchor: {
		position: 'absolute',
		width: '1px',
		height: '1px',
		pointerEvents: 'none'
	},
	menu: {
		boxSizing: 'border-box',
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-0-5'],
		// 300 px, and no taller than its layer's block-size cap, which folds in
		// the software keyboard's.
		maxHeight: stylex.firstThatWorks(
			`min(300px, ${layerViewportInset.maxBlockSize})`,
			`min(300px, ${layerViewportInset.maxBlockSizeFallback})`
		),
		overflowY: 'auto',
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
		userSelect: 'none',
		WebkitTouchCallout: 'none'
	},
	// Scroll ownership by the browser's own signal; see DropdownMenu.
	touchPinchZoom: {
		touchAction: 'pinch-zoom'
	},
	touchPanYPinchZoom: {
		touchAction: 'pan-y pinch-zoom',
		overscrollBehavior: 'contain'
	},
	popover: {
		minWidth: '160px'
	},
	popoverCustomWidth: (width: string | number) => ({
		minWidth: typeof width === 'number' ? `${width}px` : width
	}),
	sheetMenu: {
		boxSizing: 'border-box',
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-0-5'],
		width: '100%',
		'--_dropdown-menu-radius': radiusVars['--radius-container'],
		'--_dropdown-menu-padding': spacingVars['--spacing-1'],
		padding: spacingVars['--spacing-1'],
		borderRadius: 'var(--_dropdown-menu-radius)',
		backgroundColor: colorVars['--color-background-surface'],
		outline: 'none',
		userSelect: 'none'
	},
	// The menu's own inset inside the sheet content box (menuBottomSheetStyles
	// .content): the 4px at the sides the content box keeps plus the menu's
	// 4px padding; above the first row, the menu's 4px below the band the sheet
	// keeps under its grab bar.
	sheetMenuInset: {
		paddingBlockStart: spacingVars['--spacing-1'],
		paddingBlockEnd: spacingVars['--spacing-1'],
		paddingInline: `calc(${spacingVars['--spacing-1']} + ${spacingVars['--spacing-1']})`,
		// Bleeding rows read the padding this element applies.
		'--container-padding-block-start': spacingVars['--spacing-1'],
		'--container-padding-block-end': spacingVars['--spacing-1'],
		'--container-padding-inline-start': `calc(${spacingVars['--spacing-1']} + ${spacingVars['--spacing-1']})`,
		'--container-padding-inline-end': `calc(${spacingVars['--spacing-1']} + ${spacingVars['--spacing-1']})`
	},
	sheetHeader: {
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		marginBottom: spacingVars['--spacing-2']
	},
	sheetRootHeading: {
		marginInlineStart: spacingVars['--spacing-3']
	},
	sheetViewHeading: {
		outline: 'none'
	}
});

/** The right-click target wrapper. */
export function contextMenuTriggerAttrs(triggerXstyle: StyleArg): SvelteStyleAttrs {
	return sx(styles.trigger, ...(Array.isArray(triggerXstyle) ? triggerXstyle : [triggerXstyle]));
}

/** The 1px anchor placed at the cursor point. */
export function contextMenuCursorAnchorAttrs(): SvelteStyleAttrs {
	return sx(styles.cursorAnchor);
}

/**
 * The `role="menu"` surface. `isScrollable` picks the touch-action that leaves
 * vertical scrolling to the browser only when the open menu actually overflows.
 */
export function contextMenuAttrs(xstyle: StyleArg, isScrollable: boolean): SvelteStyleAttrs {
	return sx(styles.menu, isScrollable ? styles.touchPanYPinchZoom : styles.touchPinchZoom, xstyle);
}

/** The popover container's width — the default floor, or a caller's override. */
export function contextMenuPopoverXstyle(menuWidth: number | string | undefined): StyleArg {
	return menuWidth ? styles.popoverCustomWidth(menuWidth) : styles.popover;
}

/** The bottom-sheet menu surface. */
export function contextMenuSheetMenuAttrs(xstyle: StyleArg): SvelteStyleAttrs {
	return sx(styles.sheetMenu, menuBottomSheetStyles.content, styles.sheetMenuInset, xstyle);
}

/** The sub-menu header row inside the sheet: back button plus heading. */
export function contextMenuSheetHeaderAttrs(): SvelteStyleAttrs {
	return sx(styles.sheetHeader);
}

/** The root view's heading inset inside the sheet. */
export const contextMenuSheetRootHeadingStyle: StyleArg = styles.sheetRootHeading;

/** The sub-menu view heading inside the sheet. */
export const contextMenuSheetViewHeadingStyle: StyleArg = styles.sheetViewHeading;
