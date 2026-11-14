import * as stylex from '@stylexjs/stylex';
import { container, type SpacingToken } from '../../internal/container.stylex.js';
import { layerStructureReset } from '../layer/layer-structure-reset.stylex.js';
import { layerTextReset } from '../layer/layer-text-reset.stylex.js';
import {
	containerPaddingBlockEndVarStyles,
	containerPaddingInlineVarStyles,
	paddingStyles
} from '../../internal/padding.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { overlayPaddingReset } from '../../internal/padding.stylex.js';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import type { SpacingStep } from '../../internal/types.js';
import {
	borderVars,
	colorVars,
	durationVars,
	easeVars,
	focusVars,
	radiusVars,
	shadowVars,
	sizeVars,
	spacingVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `BottomSheet/BottomSheetPanel.tsx` styles.
 *
 * Everything intrinsic to a sheet *surface*: height budgets, the handle and
 * scrolling body, and the motion styles. The dialog, focus, inert state and
 * switcher registration belong to the hosting controller and are not here.
 */

const HEIGHT_BUDGETS = {
	hug: '92dvh',
	capped: '62dvh',
	tall: '92dvh'
} as const;

export type BottomSheetHeight = keyof typeof HEIGHT_BUDGETS;

/** SYNC: must match `OVERSCROLL_MAX` in `use-sheet-gestures.svelte.ts`. */
const OVERSCROLL_PADDING = 48;
const MOBILE_KEYBOARD_BOTTOM_CLEARANCE = 48;
// The floating handle bar's height. The bar is out of flow, so this is not
// layout space the content pays for — the content box keeps a band this tall
// under it (`clearsGrabBar`), so the pill never sits on the first row and
// scrolled content rides up beneath the bar.
const HANDLE_BAR_HEIGHT = spacingVars['--spacing-6'];

// An explicit padding publishes only the part past the grab bar's band, so a
// lone `Section` that escapes the published padding still starts below the bar.
// `clearsGrabBar` applies the band on top.
const pastGrabBarStyles = stylex.create({
	0: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-0']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	},
	0.5: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-0-5']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	},
	1: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-1']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	},
	1.5: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-1-5']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	},
	2: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-2']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	},
	3: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-3']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	},
	4: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-4']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	},
	5: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-5']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	},
	6: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-6']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	},
	8: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-8']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	},
	10: {
		'--container-padding-block-start': `max(calc(${spacingVars['--spacing-10']} - ${HANDLE_BAR_HEIGHT}), 0px)`
	}
});

/**
 * The reduced-motion queries. With a coarse primary pointer the sheet
 * cross-fades, else it changes at once. The cross-fade lasts at most 200 ms.
 */
const REDUCED_MOTION_COARSE = '@media (prefers-reduced-motion: reduce) and (pointer: coarse)';
export const REDUCED_MOTION_COARSE_QUERY = '(prefers-reduced-motion: reduce) and (pointer: coarse)';
const CROSS_FADE_MS = 200;

const styles = stylex.create({
	sheet: {
		pointerEvents: 'auto',
		boxSizing: 'border-box',
		// Containing block for the floating handle bar, which is lifted out of
		// flow so the scrolling body reaches the sheet's top edge.
		position: 'relative',
		display: 'flex',
		flexDirection: 'column',
		minHeight: 0,
		width: '100%',
		maxWidth: 640,
		backgroundColor: colorVars['--color-background-surface'],
		// Hairline on the three edges that face the scrim. The surface fill alone
		// separates sheet from scrim in light mode, but not in dark: there the two
		// sit within a few RGB steps of each other and the drop shadow is black on
		// near-black, so the sheet's left and right edges disappear. Same treatment
		// `MobileNav` gives its scrim-facing edge. The block-end edge is
		// deliberately left bare; it sits below the viewport, under the overscroll
		// padding.
		borderBlockStartWidth: borderVars['--border-width'],
		borderBlockStartStyle: 'solid',
		borderBlockStartColor: colorVars['--color-border'],
		borderInlineStartWidth: borderVars['--border-width'],
		borderInlineStartStyle: 'solid',
		borderInlineStartColor: colorVars['--color-border'],
		borderInlineEndWidth: borderVars['--border-width'],
		borderInlineEndStyle: 'solid',
		borderInlineEndColor: colorVars['--color-border'],
		borderStartStartRadius: radiusVars['--radius-container'],
		borderStartEndRadius: radiusVars['--radius-container'],
		boxShadow: shadowVars['--shadow-high'],
		outline: 'none',
		overflow: 'hidden',
		paddingBlockEnd: `calc(env(safe-area-inset-bottom, 0px) + var(--_sheet-reserve, ${OVERSCROLL_PADDING}px))`,
		marginBlockEnd: `calc(-1 * var(--_sheet-reserve, ${OVERSCROLL_PADDING}px))`,
		transform: {
			default: 'translateY(0)',
			'@starting-style': {
				default: 'translateY(100%)',
				'@media (prefers-reduced-motion: reduce)': 'translateY(0)'
			}
		},
		opacity: {
			default: 1,
			'@starting-style': {
				default: 1,
				[REDUCED_MOTION_COARSE]: 0
			}
		},
		transitionProperty: 'transform, opacity',
		// Under reduced motion no transform runs. On a coarse primary pointer the
		// entrance is an opacity cross-fade of at most 200 ms. A fine pointer gets
		// the change at once (the 0.01s collapse).
		transitionDuration: {
			default: durationVars['--duration-medium'],
			'@media (prefers-reduced-motion: reduce)': {
				default: '0.01s',
				'@media (pointer: coarse)': `0.01s, ${CROSS_FADE_MS}ms`
			}
		},
		transitionTimingFunction: easeVars['--ease-standard'],
		willChange: 'transform, opacity',
		// The dialog writes its scrim's opacity on itself for each move of a
		// drag, and only its backdrop reads it. A custom property inherits, so
		// each write would restyle every element in the sheet. The panel ends
		// the inheritance, so the restyle stops here.
		'--_sheet-scrim-opacity': 'initial',
		'--_sheet-scrim-duration': 'initial',
		'--_sheet-scrim-easing': 'initial'
	},
	// A sheet present on page load opens where it rests (spec:AST-013 FR13):
	// the collapse reduced motion uses, so the transition still ends.
	sheetSettled: {
		transitionDuration: '0.01s'
	},
	/**
	 * The exit is its own motion, not the entrance played backwards.
	 *
	 * `--ease-standard` is `cubic-bezier(0.24, 1, 0.4, 1)`, a decelerate curve: it
	 * spends its speed immediately and coasts. That is right for an entrance,
	 * where the sheet arrives fast and settles, and wrong for an exit. Measured on
	 * device, it put the sheet half off-screen in 59ms of a 410ms close and 90%
	 * off in 163ms — the travel is over before the eye has followed it, and the
	 * rest of the duration moves pixels already below the fold.
	 *
	 * An exit accelerates instead: away from rest, gathering speed, quickest as it
	 * leaves the screen. The curve is deliberately gentle rather than a hard
	 * `ease-in` — it is moving within ~50ms, so the close reads as one departure
	 * rather than a hesitation and a snap. The duration is the entrance's own
	 * band, so only the curve differs between the two directions; a shorter band
	 * leaves too little visible travel once a theme scales the motion scale down
	 * (neutral's medium is 300ms against 410ms).
	 */
	sheetClosing: {
		// Under reduced motion the exit does not travel. On a coarse pointer it
		// fades out where it is, and on a fine one it ends at once.
		transform: {
			default: 'translateY(100%)',
			'@media (prefers-reduced-motion: reduce)': 'translateY(0)'
		},
		opacity: {
			default: null,
			[REDUCED_MOTION_COARSE]: 0
		},
		// A pointer presentation closes on the theme's exit curve. A touch
		// presentation keeps its own curve, which the exit tokens do not change.
		transitionTimingFunction: {
			default: easeVars['--ease-exit'],
			'@media (pointer: coarse)': 'cubic-bezier(0.3, 0, 0.6, 0.6)'
		}
	},
	/**
	 * An exit that cross-fades on a pointer the media query does not cover: a
	 * touch swipe dismissal under reduced motion fades out in place on every
	 * pointer. It uses the opacity and ceiling of the coarse-pointer rule.
	 */
	sheetClosingCrossFade: {
		transform: 'translateY(0)',
		opacity: 0,
		transitionDuration: `0.01s, ${CROSS_FADE_MS}ms`
	},
	sheetFading: {
		opacity: 0
	},
	sheetInactive: {
		pointerEvents: 'none'
	},
	handleBar: {
		// Floats over the body rather than taking a row in the flex column. The
		// content starts at the sheet's top edge and rides up under the pill — both
		// moving it closer to the top and letting scrolled content pass beneath
		// instead of stopping at a hard edge.
		position: 'absolute',
		insetBlockStart: 0,
		insetInlineStart: 0,
		insetInlineEnd: 0,
		zIndex: 1,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: HANDLE_BAR_HEIGHT,
		// Keeps the pill legible over whatever sits or scrolls under it: opaque
		// surface behind the pill itself, fading out across the lower half so the
		// content emerging below has no visible cut line.
		backgroundImage: `linear-gradient(to bottom, ${colorVars['--color-background-surface']} 60%, transparent)`,
		// WebKit can draw this bar under the scrolling body's own layer while the
		// sheet's transform animates, so the pill vanishes until the sheet rests.
		// A layer of its own keeps it above the body.
		willChange: 'transform',
		// Drags are the handle's; a pinch still zooms the page (WCAG 1.4.4).
		touchAction: 'pinch-zoom',
		cursor: {
			default: 'grab',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		// The pill is drawn on the grab bar itself, as decoration with no role.
		'::before': {
			content: '""',
			width: sizeVars['--size-element-lg'],
			height: spacingVars['--spacing-1'],
			borderRadius: radiusVars['--radius-full'],
			backgroundColor: colorVars['--color-border']
		}
	},
	body: {
		flexGrow: 1,
		minHeight: 0,
		boxSizing: 'border-box',
		touchAction: 'pan-y pinch-zoom',
		outlineOffset: {
			default: 0,
			':focus-visible': `calc(-1 * ${focusVars['--focus-outline-width']})`
		},
		// The scrolling area paints the surface itself, covering the sheet's whole
		// inner box. Without it the sheet's edge is not uniform: a theme that packs
		// an inset ring into `--shadow-high` (the bundled themes all add one in dark
		// mode) draws that ring just inside the sheet, where an opaque content
		// wrapper such as `Section` paints over it — so the ring shows only in the
		// gap below where the content ends, and the sheet's side edges appear to
		// change width partway down. Painting the surface here hides the ring
		// evenly, leaving the border below as the sheet's one edge.
		backgroundColor: colorVars['--color-background-surface'],
		// No reserve for the handle bar here: it floats over the scrolling area,
		// so scrolled content rides up under the pill. The content box keeps the
		// resting content clear of the bar instead (`clearsGrabBar`).
		paddingBlockEnd: 0
	},
	clearsGrabBar: {
		paddingBlockStart: `calc(var(--container-padding-block-start, 0px) + ${HANDLE_BAR_HEIGHT})`
	},
	content: {
		// Preserve the body's block formatting (including margin/float isolation)
		// and its definite percentage-height basis. fit-content lets this real
		// observed box grow with async content beyond a fixed-height viewport.
		// This box is also the sheet's container: it carries the padding and
		// publishes it, so a lone Section child escapes it exactly as in Dialog.
		// At the block start it publishes only the padding past the grab bar's
		// band, so a child escapes the padding but never the band.
		display: 'flow-root',
		boxSizing: 'border-box',
		height: '100%',
		// fit-content, not min-content: they are one size in the block axis, but
		// WebKit ignores min-content on a block's min-height. There the box keeps
		// its body's height on a budget-height sheet. Content placed directly in
		// it then overflows the box, and its block-end padding leaves the scroll
		// range.
		minHeight: 'fit-content'
	},
	tallKeyboardBody: {
		scrollPaddingBlockEnd: MOBILE_KEYBOARD_BOTTOM_CLEARANCE
	},
	// The inset the keyboard takes at the end of a Tall sheet's content, so its
	// last control can scroll above the keyboard. It is the content box's last
	// in-flow box, after the content's own children, not a box after the content.
	// Firefox resolves the content's `min-height: min-content` as `auto` in the
	// block axis. The content box then keeps the body's height while its children
	// overflow it; an inset after that box sat inside the overflow and added no
	// scroll range.
	tallKeyboardContent: {
		'::after': {
			content: '""',
			display: 'block',
			blockSize: 0,
			pointerEvents: 'none'
		}
	},
	keyboardInset: (inset: number | string) => ({
		'::after': {
			blockSize: inset
		}
	}),
	budget: {
		height: `calc(var(--_sheet-budget) + var(--_sheet-reserve, ${OVERSCROLL_PADDING}px))`
	},
	hugHeight: {
		height: 'fit-content',
		maxHeight: `calc(${HEIGHT_BUDGETS.hug} + var(--_sheet-reserve, ${OVERSCROLL_PADDING}px))`
	}
});

export { OVERSCROLL_PADDING, MOBILE_KEYBOARD_BOTTOM_CLEARANCE, HEIGHT_BUDGETS };

/** The sliding surface. */
export function bottomSheetPanelAttrs(
	isClosing: boolean,
	isCrossFade: boolean,
	isFading: boolean,
	isInactive: boolean,
	isEntrySettled: boolean,
	isHug: boolean,
	hasBudget: boolean,
	xstyle: StyleArg
): SvelteStyleAttrs {
	return sx(
		layerTextReset.reset,
		layerStructureReset.reset,
		styles.sheet,
		overlayPaddingReset.reset,
		isHug && styles.hugHeight,
		hasBudget && styles.budget,
		isClosing && styles.sheetClosing,
		isClosing && isCrossFade && styles.sheetClosingCrossFade,
		isFading && styles.sheetFading,
		isInactive && styles.sheetInactive,
		isEntrySettled && styles.sheetSettled,
		xstyle
	);
}

/** The grab-handle row. Its pill is the bar's own `::before` decoration. */
export function bottomSheetHandleBarAttrs(): SvelteStyleAttrs {
	return sx(styles.handleBar);
}

/** The scrolling body. `isTallKeyboard` adds the keyboard scroll padding. */
export function bottomSheetBodyAttrs(isTallKeyboard: boolean): SvelteStyleAttrs {
	return sx(
		focusOutlineStyles.focusVisible,
		styles.body,
		isTallKeyboard && styles.tallKeyboardBody
	);
}

/**
 * The content box inside the scrolling body. It carries the resolved padding
 * and publishes it, then clears the floating grab bar's band.
 */
export function bottomSheetContentAttrs(
	isTallKeyboard: boolean,
	usesThemePadding: boolean,
	effectivePadding: SpacingStep,
	paddingToken: SpacingToken
): SvelteStyleAttrs {
	const explicit = !usesThemePadding && effectivePadding !== 4;
	return sx(
		styles.content,
		isTallKeyboard && styles.tallKeyboardContent,
		// The keyboard's inset rides a CSS variable the keyboard hook writes on the
		// body; the dynamic style turns it into the content box's end spacer.
		isTallKeyboard && styles.keyboardInset('var(--_sheet-keyboard-inset, 0px)'),
		...container(
			usesThemePadding
				? { useThemeDefault: 'bottom-sheet' }
				: {
						paddingInnerX: paddingToken,
						paddingInnerY: paddingToken,
						paddingOuterX: paddingToken,
						paddingOuterY: paddingToken
					}
		),
		explicit && paddingStyles[effectivePadding],
		explicit && containerPaddingInlineVarStyles[effectivePadding],
		// An explicit padding publishes what reaches past the grab bar's band, like
		// the theme default (Layout/container.stylex.ts).
		explicit && pastGrabBarStyles[effectivePadding],
		explicit && containerPaddingBlockEndVarStyles[effectivePadding],
		// The band under the grab bar, on top of the published padding past it:
		// max(padding, the bar) in all.
		styles.clearsGrabBar
	);
}
