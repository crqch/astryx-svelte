import * as stylex from '@stylexjs/stylex';

/**
 * Ported from Astryx's `DropdownMenu/menuTouchAction.stylex.ts`.
 *
 * Scroll ownership follows the browser's own signal. A menu whose rows fit
 * keeps every one-finger move, so a slide over its rows stays a slide. One
 * that scrolls lets the browser pan it vertically and cancel the press when
 * it does. Both leave a two-finger pinch to the browser, so the page stays
 * zoomable over an open menu; `pinch-zoom` admits no one-finger pan.
 */
export const menuTouchActionStyles = stylex.create({
	fits: {
		touchAction: 'pinch-zoom'
	},
	scrolls: {
		touchAction: 'pan-y pinch-zoom',
		overscrollBehavior: 'contain'
	}
});
