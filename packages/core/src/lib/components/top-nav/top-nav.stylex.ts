import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { spacingVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `TopNav/TopNav.tsx` styles.
 *
 * The bar is a wrapping flex row (`base` + `baseFlex`). With `centerContent`
 * the start and end regions share the free width equally (`base` +
 * `baseThreeRegion`), which keeps the centre at the bar's middle while the
 * three regions fit one row; the bar wraps when they do not.
 *
 * `drawerExtraContent` is an **empty** style object on both sides. StyleX
 * compiles it to nothing, so the wrapper renders with no class attribute at
 * all; it exists as a named seam for themes rather than as styling. See the
 * component for how the empty class is kept off the DOM.
 */
const styles = stylex.create({
	base: {
		alignItems: 'center',
		width: '100%',
		padding: spacingVars['--spacing-2'],
		boxSizing: 'border-box'
	},
	// The bar wraps when its regions do not fit one row. The end region then
	// moves to a second line.
	baseFlex: {
		display: 'flex',
		flexWrap: 'wrap'
	},
	// While the regions fit one row, the start and end regions share the free
	// width equally. This keeps the center at the bar's middle.
	baseThreeRegion: {
		display: 'flex',
		flexWrap: 'wrap'
	},
	// A region keeps its items on one line, so the bar wraps first. Only a
	// region wider than the bar wraps its own items. `fit-content` is the
	// region's full row, capped at the bar's width.
	leftSection: {
		display: 'flex',
		flexWrap: 'wrap',
		alignItems: 'center',
		gap: spacingVars['--spacing-4'],
		flex: '1 1 0%',
		minWidth: stylex.firstThatWorks('fit-content', '-webkit-fit-content')
	},
	// The heading shrinks only to its own narrowest width. TopNavHeading keeps
	// its logo there.
	heading: {
		display: 'flex',
		alignItems: 'center',
		flexShrink: 1
	},
	startContent: {
		display: 'flex',
		flexWrap: 'wrap',
		alignItems: 'center',
		gap: spacingVars['--spacing-1']
	},
	// The center claims its content's minimum width when the bar decides where
	// to wrap, then grows first, up to its content width. Only a center wider
	// than the whole bar, alone on its line, narrows below that minimum.
	centerContent: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacingVars['--spacing-1'],
		flexGrow: 1000,
		flexShrink: 1,
		flexBasis: 'min-content',
		minWidth: 0,
		maxWidth: 'max-content'
	},
	rightSection: {
		display: 'flex',
		flexWrap: 'wrap',
		alignItems: 'center',
		justifyContent: 'flex-end',
		gap: spacingVars['--spacing-1'],
		flex: '1 1 0%',
		minWidth: stylex.firstThatWorks('fit-content', '-webkit-fit-content')
	},
	endContent: {
		display: 'flex',
		flexWrap: 'wrap',
		alignItems: 'center',
		justifyContent: 'flex-end',
		gap: spacingVars['--spacing-1'],
		flexShrink: 0,
		marginInlineStart: 'auto',
		minWidth: stylex.firstThatWorks('fit-content', '-webkit-fit-content'),
		maxWidth: '100%'
	},
	// Mobile bar mode — simplified top bar with heading + toggle + endContent
	mobileBar: {
		display: 'flex',
		alignItems: 'center',
		width: '100%',
		padding: spacingVars['--spacing-2'],
		boxSizing: 'border-box'
	},
	// The heading gives up space first so the end content and toggle stay in view
	mobileBarHeading: {
		display: 'flex',
		alignItems: 'center',
		flex: '0 1 auto',
		minWidth: 0
	},
	mobileBarEnd: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		flexShrink: 0,
		marginInlineStart: 'auto'
	},
	// Drawer mode — vertical list of nav items
	drawerItems: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-0-5']
	},
	drawerDivider: {
		marginBlock: spacingVars['--spacing-2']
	},
	drawerExtraContent: {}
});

/** The `<nav>` root in default mode — flex or three-region depending on `centerContent`. */
export function topNavRootAttrs(hasCenterContent: boolean, xstyle: StyleArg): SvelteStyleAttrs {
	return sx(styles.base, hasCenterContent ? styles.baseThreeRegion : styles.baseFlex, xstyle);
}

/** The `<nav>` root in mobile-bar mode. */
export function topNavMobileBarAttrs(xstyle: StyleArg): SvelteStyleAttrs {
	return sx(styles.mobileBar, xstyle);
}

/** The heading wrapper in mobile-bar mode — first to give up space. */
export function topNavMobileBarHeadingAttrs(): SvelteStyleAttrs {
	return sx(styles.mobileBarHeading);
}

/** The heading + start-content column. */
export function topNavLeftSectionAttrs(): SvelteStyleAttrs {
	return sx(styles.leftSection);
}

/** The heading slot wrapper. */
export function topNavHeadingSlotAttrs(): SvelteStyleAttrs {
	return sx(styles.heading);
}

/** The start-content slot wrapper. */
export function topNavStartContentAttrs(): SvelteStyleAttrs {
	return sx(styles.startContent);
}

/** The centre column of the grid layout. */
export function topNavCenterContentAttrs(): SvelteStyleAttrs {
	return sx(styles.centerContent);
}

/** The end column of the grid layout. */
export function topNavRightSectionAttrs(): SvelteStyleAttrs {
	return sx(styles.rightSection);
}

/** The end-content wrapper of the flex layout, pushed over by an auto margin. */
export function topNavEndContentAttrs(): SvelteStyleAttrs {
	return sx(styles.endContent);
}

/** The trailing group in mobile-bar mode — end content plus the toggle. */
export function topNavMobileBarEndAttrs(): SvelteStyleAttrs {
	return sx(styles.mobileBarEnd);
}

/** The vertical stack of nav items inside the drawer. */
export function topNavDrawerItemsAttrs(): SvelteStyleAttrs {
	return sx(styles.drawerItems);
}

/**
 * The spacing around the divider between the TopNav items and SideNav content,
 * passed to `<Divider xstyle>` rather than to a wrapper `<div>` (#4775) — the
 * margin belongs to the rule itself, so the box that used to carry it is gone.
 */
export const topNavDrawerDividerStyle: StyleArg = styles.drawerDivider;

/** The wrapper around drawer content supplied by `AppShell`. Emits no class. */
export function topNavDrawerExtraContentAttrs(): SvelteStyleAttrs {
	return sx(styles.drawerExtraContent);
}
