import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { layerViewportInset } from '../layer/layer-viewport-inset.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { menuTouchActionStyles } from './menu-touch-action.stylex.js';
import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	spacingVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `DropdownMenu/DropdownMenu.tsx` styles.
 *
 * `styles`, `dynamicStyles` and `bottomSheetStyles` keep upstream's group
 * names. The bottom-sheet presentation is not ported, so its declarations are
 * carried here with the rest of the module and exported as attrs — the same
 * arrangement `context-menu.stylex.ts` uses for its sheet arm.
 *
 * Every value that reads `layerViewportInset` compiles to a `var()` on our
 * side and a literal on upstream's, so the classes cannot agree by name; the
 * oracle needs this case declared `constHashed`, as the sub-menu's is.
 */

// The menu's own lower cap on the placement axis; the viewport cap underneath
// it is the layer runtime's (spec:AST-059 FR3).
const MENU_BLOCK_CAP = '300px';
const MENU_MAX_BLOCK_SIZE = `min(${MENU_BLOCK_CAP}, ${layerViewportInset.maxBlockSize})`;
const MENU_MAX_BLOCK_SIZE_FALLBACK = `min(${MENU_BLOCK_CAP}, ${layerViewportInset.maxBlockSizeFallback})`;
const MENU_TRIGGER_OPEN_BACKGROUND = `linear-gradient(${colorVars['--color-overlay-pressed']}, ${colorVars['--color-overlay-pressed']})`;

// A sub-menu's drilled-in view with a header or footer renders in the surface
// host that follows the menu (marked `data-astryx-submenu-host`), as the frame
// marked `data-astryx-submenu-regions="view"` (hidden while a deeper view
// shows). While one shows, the menu and its header and footer step aside. The
// rule reads that from the DOM, so no state mirrors which view shows.
const STEPS_ASIDE_FOR_VIEW =
	':has(~ [data-astryx-submenu-host] > [data-astryx-submenu-regions="view"]:not([hidden]))';

const styles = stylex.create({
	triggerOpen: {
		backgroundImage: MENU_TRIGGER_OPEN_BACKGROUND
	},
	// A finger held on the trigger opens the menu; the browser's own held-press
	// affordances — the link preview callout, text selection — must not compete
	// with it.
	triggerPressable: {
		WebkitTouchCallout: 'none',
		userSelect: 'none'
	},
	dropdown: {
		boxSizing: 'border-box',
		display: {
			default: 'flex',
			// A sub-menu's drilled-in view with a header or footer shows in its
			// place (see `STEPS_ASIDE_FOR_VIEW`).
			[STEPS_ASIDE_FOR_VIEW]: 'none'
		},
		flexDirection: 'column',
		gap: spacingVars['--spacing-0-5'],
		// Pointer opens focus this container so subsequent arrow keys and Escape
		// stay owned by the menu. It is an internal focus target, not a control,
		// so suppress the browser ring; keyboard focus moves to an item instead.
		outline: 'none',
		// Menu rows never offer the browser's held-press link preview or text
		// selection: a held finger is driving the highlight.
		WebkitTouchCallout: 'none',
		userSelect: 'none',
		maxInlineSize: stylex.firstThatWorks(
			`calc(${layerViewportInset.maxInlineSize})`,
			`calc(${layerViewportInset.maxInlineSizeFallback})`
		),
		maxHeight: stylex.firstThatWorks(MENU_MAX_BLOCK_SIZE, MENU_MAX_BLOCK_SIZE_FALLBACK),
		'--_dropdown-menu-radius': radiusVars['--radius-container'],
		'--_dropdown-menu-padding': spacingVars['--spacing-1'],
		padding: spacingVars['--spacing-1'],
		borderRadius: 'var(--_dropdown-menu-radius)',
		opacity: 1,
		transitionProperty: 'opacity',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	scrollable: {
		overflowY: 'auto',
		overflowX: 'hidden',
		overscrollBehavior: 'contain'
	},
	// With a header or footer, the regions and the menu share one column under
	// the menu's block cap: the regions keep their height and the menu shrinks
	// and scrolls between them.
	regionsFrame: {
		boxSizing: 'border-box',
		display: 'flex',
		flexDirection: 'column',
		maxHeight: stylex.firstThatWorks(MENU_MAX_BLOCK_SIZE, MENU_MAX_BLOCK_SIZE_FALLBACK)
	},
	menuInFrame: {
		flexGrow: 1,
		flexShrink: 1,
		minBlockSize: 0
	},
	// Where a sub-menu with a header or footer renders its surface: beside the
	// menu, never inside it. It owns no box, so the popover's layout is
	// unchanged.
	surfaceHost: {
		display: 'contents'
	},
	// While a sub-menu's drilled-in view with its own header or footer shows
	// in the surface host, the header and footer step aside for it, as the menu
	// does (see `dropdown`). Derived from the DOM by the rule itself: the view
	// is the frame in the host that is not hidden.
	stepsAsideForView: {
		display: {
			default: null,
			[STEPS_ASIDE_FOR_VIEW]: 'none'
		}
	},
	region: {
		flexShrink: 0,
		padding: spacingVars['--spacing-1']
	},
	// The menu's lower block cap rides on the layer box too, so the layer's
	// flip decision sees the same height the menu paints.
	popoverViewport: {
		boxSizing: 'border-box',
		maxBlockSize: stylex.firstThatWorks(MENU_MAX_BLOCK_SIZE, MENU_MAX_BLOCK_SIZE_FALLBACK)
	},
	// Without a width the menu prefers the trigger's minimum width, clamped by
	// the runtime's cap because a CSS minimum beats a maximum (spec:AST-059 FR7).
	popoverMatchTrigger: {
		minWidth: stylex.firstThatWorks(
			`min(anchor-size(width), ${layerViewportInset.maxInlineSize})`,
			`min(anchor-size(width), ${layerViewportInset.maxInlineSizeFallback})`,
			'anchor-size(width)'
		)
	},
	popoverCustomWidth: (width: string) => ({
		minWidth: width
	}),
	popoverCustomIntrinsicWidth: (width: string) => ({
		inlineSize: width
	})
});

// `menuMaxHeight` lifts the 300px cap for a menu that must fit its rows; the
// viewport still bounds it.
const dynamicStyles = stylex.create({
	menuMaxHeight: (maxHeight: string) => ({
		maxHeight: `min(${maxHeight}, ${layerViewportInset.maxBlockSize})`
	}),
	popoverViewportMaxBlockSize: (maxHeight: string) => ({
		maxBlockSize: `min(${maxHeight}, ${layerViewportInset.maxBlockSize})`
	})
});

const bottomSheetStyles = stylex.create({
	content: {
		width: '100%'
	},
	header: {
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		marginBottom: spacingVars['--spacing-2']
	},
	rootHeading: {
		// Match the content edge of a spacious ListItem. Icon-bearing rows place
		// their icon here; rows without an icon place their label here.
		marginInlineStart: spacingVars['--spacing-3']
	},
	viewHeading: {
		outline: 'none'
	},
	// Caller content above or below the action list, inset to the list's
	// content edge.
	region: {
		paddingInline: spacingVars['--spacing-3'],
		paddingBlock: spacingVars['--spacing-2']
	}
});

/**
 * The `role="menu"` popup container. `isScrollable` adds the scroll container
 * only when the open menu overflows; `hasRegions` makes it the flexible row
 * between a header and footer. `isMenuKeyboardFocused` draws the shared ring
 * when the menu itself is a Tab stop in that dialog. `xstyle` is threaded
 * last so it overrides.
 */
export function dropdownMenuAttrs(options: {
	isScrollable: boolean;
	hasRegions: boolean;
	isMenuKeyboardFocused: boolean;
	menuMaxHeight?: string;
	xstyle?: StyleArg;
}): SvelteStyleAttrs {
	const { isScrollable, hasRegions, isMenuKeyboardFocused, menuMaxHeight, xstyle } = options;
	return sx(
		styles.dropdown,
		menuMaxHeight != null && dynamicStyles.menuMaxHeight(menuMaxHeight),
		isScrollable ? menuTouchActionStyles.scrolls : menuTouchActionStyles.fits,
		isScrollable && styles.scrollable,
		hasRegions && styles.menuInFrame,
		hasRegions && isMenuKeyboardFocused && focusOutlineStyles.focusVisible,
		xstyle
	);
}

/** The trigger `Button`'s pressable/open painting, before the caller's own. */
export function dropdownTriggerXstyle(isOpen: boolean, xstyle?: StyleArg): StyleArg {
	return [styles.triggerPressable, isOpen && styles.triggerOpen, xstyle];
}

/** The frame holding the header, the menu and the footer under one cap. */
export function dropdownRegionsFrameAttrs(menuMaxHeight?: string): SvelteStyleAttrs {
	return sx(
		styles.regionsFrame,
		menuMaxHeight != null && dynamicStyles.menuMaxHeight(menuMaxHeight)
	);
}

/** A header or footer wrapper, hidden while a sub-menu's view shows. */
export function dropdownRegionAttrs(): SvelteStyleAttrs {
	return sx(styles.region, styles.stepsAsideForView);
}

/** The host a sub-menu with regions renders its surface into. */
export function dropdownSurfaceHostAttrs(): SvelteStyleAttrs {
	return sx(styles.surfaceHost);
}

/** The layer's block cap, widened by `menuMaxHeight` when given. */
export function dropdownPopoverViewportStyle(menuMaxHeight?: string): StyleArg {
	return [
		styles.popoverViewport,
		menuMaxHeight != null && dynamicStyles.popoverViewportMaxBlockSize(menuMaxHeight)
	];
}

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

/** Whether a width is an intrinsic or CSS-wide keyword, which `min()` rejects. */
export function isIntrinsicMenuWidth(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return INTRINSIC_INLINE_SIZES.has(normalized) || normalized.startsWith('fit-content(');
}

/**
 * The layer's positioned element. Without a width the menu matches the
 * trigger's minimum width; a length is clamped to the viewport cap and an
 * intrinsic keyword is applied as written.
 */
export function dropdownPopoverWidthStyle(menuWidth?: number | string): StyleArg {
	if (menuWidth == null) {
		return styles.popoverMatchTrigger;
	}
	if (typeof menuWidth === 'string' && isIntrinsicMenuWidth(menuWidth)) {
		return styles.popoverCustomIntrinsicWidth(menuWidth.trim());
	}
	const length = typeof menuWidth === 'number' ? `${menuWidth}px` : menuWidth.trim();
	return styles.popoverCustomWidth(`min(${length}, ${layerViewportInset.maxInlineSizeFallback})`);
}

/**
 * The clearance from the trigger, handed to `<PopoverLayer offset>`. It sits on
 * the layer rather than either popover style, so a `position-try` flip keeps
 * it on the correct edge.
 */
export const dropdownMenuOffset = spacingVars['--spacing-1'];

// The bottom-sheet presentation is a whole unported subsystem (it needs
// BottomSheet's action list and view stack). Its declarations stay compiled so
// the module matches upstream in full; no markup calls these attrs yet.
export function dropdownBottomSheetContentAttrs(): SvelteStyleAttrs {
	return sx(bottomSheetStyles.content);
}

export function dropdownBottomSheetHeaderAttrs(): SvelteStyleAttrs {
	return sx(bottomSheetStyles.header);
}

export function dropdownBottomSheetRootHeadingAttrs(): SvelteStyleAttrs {
	return sx(bottomSheetStyles.rootHeading);
}

export function dropdownBottomSheetViewHeadingAttrs(): SvelteStyleAttrs {
	return sx(bottomSheetStyles.viewHeading);
}

export function dropdownBottomSheetRegionAttrs(): SvelteStyleAttrs {
	return sx(bottomSheetStyles.region);
}
