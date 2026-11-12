// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file list-reorder-handle.stylex.ts
 * @input StyleX, the theme tokens, the shared focus outline and the shared
 *   touch hit area
 * @output The reorder handle's styles (`handleAttrs`), the row's own-ring
 *   style (`reorderRowStyle`), and the list's insertion line
 *   (`reorderListStyle`). `INSERTION_LINE_THICKNESS` sizes the line the
 *   engine centres on a gap
 * @position Part of the reorder machinery. ListReorderHandle renders the
 *   handle, List composes the list line, and ListItem composes the row's own
 *   ring.
 *
 * UIKit's reorder control (iOS 26.2, measured) is three gray lines at the
 * trailing edge of a row in edit mode. The handle's 44 px finger target is an
 * invisible coarse-only hit layer, clamped so it never takes from a
 * neighbour (utils/hit-area.ts), not a bigger handle.
 *
 * Ported from Astryx's `List/ListReorderHandle.tsx` styles.
 */

import * as stylex from '@stylexjs/stylex';
import { type SvelteStyleAttrs } from '../../internal/sx.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';
import { touchHitAreaStyles } from '../../internal/touch-hit-area.stylex.js';
import { ownRingContainerStyles } from '../../private-attributes/own-ring.stylex.js';
import { reorderingHandleStyles } from '../../private-attributes/reordering.stylex.js';
import { reorderLineStyles } from '../../private-attributes/reorder-line.stylex.js';
import { colorVars, focusVars, spacingVars, typeScaleVars } from '../../styles/tokens.stylex.js';
import type { ItemAlign } from '../item/item.stylex.js';

/**
 * The handle's side, for every pointer: a small control's size. A finger's
 * 44 px target is an invisible coarse-only hit layer (utils/hit-area.ts), not
 * a bigger handle.
 */
const HANDLE_SIZE = 28;
/** The three lines' height: the handle's share of its row's height. */
const LINES_HEIGHT = 14;
/** The lines' length and thickness, and the distance between them. */
const LINE_WIDTH = 20;
const LINE_THICKNESS = 2;
const LINE_GAP = (LINES_HEIGHT - LINE_THICKNESS) / 2;

const styles = stylex.create({
	handle: {
		// Centred on its row, with the lines in its middle. It takes only the
		// lines' height in the row's layout (the negative block margins). So a
		// compact row stays compact. The handle and its focus ring reach past
		// that into the row's padding, never past it. They go no further than the
		// row's own inline inset, so a flush row's handle stays inside the clip.
		position: 'relative',
		alignSelf: 'center',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		width: HANDLE_SIZE,
		height: HANDLE_SIZE,
		marginBlock: (LINES_HEIGHT - HANDLE_SIZE) / 2,
		marginInlineEnd: 'calc(-1 * min(8px, var(--_item-inset-inline, 8px)))',
		padding: 0,
		borderWidth: 0,
		borderRadius: 4,
		// The ring sits inside the handle: the handle reaches the row's inline
		// end, and the list clips what passes it.
		outlineOffset: {
			default: '0',
			':focus-visible': `calc(-1 * ${focusVars['--focus-outline-width']})`
		},
		// Pressed while its row is in reorder mode, as a pressed toggle button
		// is; in forced colors, the system's highlight.
		backgroundColor: {
			default: 'transparent',
			':is([aria-pressed="true"])': {
				default: colorVars['--color-overlay-pressed'],
				'@media (forced-colors: active)': 'Highlight'
			}
		},
		forcedColorAdjust: {
			default: null,
			':is([aria-pressed="true"])': 'none'
		},
		color: {
			default: colorVars['--color-icon-secondary'],
			':is([aria-disabled="true"])': colorVars['--color-icon-disabled'],
			':is([aria-pressed="true"])': {
				default: colorVars['--color-icon-secondary'],
				'@media (forced-colors: active)': 'HighlightText'
			}
		},
		// Where the primary pointer is coarse, the page keeps its scrolling and
		// its pinch-zoom until the hold claims the drag. A flick on the handle
		// scrolls, as on iOS. That is `manipulation`, what a long press leaves the
		// browser. The hold's selection lock stops text selection while the
		// finger is down, so a mouse keeps the page's selection. Where the
		// pointer is fine, a finger gets the browser's defaults.
		touchAction: {
			default: null,
			'@media (pointer: coarse)': 'manipulation'
		},
		WebkitTapHighlightColor: {
			default: null,
			'@media (pointer: coarse)': 'transparent'
		},
		// The three lines: one bar and its two shadows, in the handle's color.
		// Forced colors keep them (shadows and backgrounds go there otherwise),
		// drawn in the system's button text.
		'::before': {
			content: '""',
			display: 'block',
			width: LINE_WIDTH,
			height: LINE_THICKNESS,
			borderRadius: LINE_THICKNESS / 2,
			backgroundColor: 'currentColor',
			boxShadow: `0 -${LINE_GAP}px currentColor, 0 ${LINE_GAP}px currentColor`,
			forcedColorAdjust: 'none',
			pointerEvents: 'none'
		}
	},
	// The row's own child, in a row without end content. It ends the row, as
	// the end slot would. It aligns as the row's `align` would align that slot.
	inRow: {
		marginInlineStart: 'auto'
	},
	// `start`: at the top of the row's content.
	inRowStart: {
		alignSelf: 'flex-start'
	},
	// `first-line`: centred on the label's first line, a line of body text at
	// the top of the row's content. Item's first-line slots centre on it too.
	// Its layout height stays the lines' height (the end margin).
	inRowFirstLine: {
		alignSelf: 'flex-start',
		marginBlockStart: `calc((${typeScaleVars['--text-body-leading']} - ${HANDLE_SIZE}px) / 2)`
	}
});

/** The style of a row that ends with a handle, which ListItem applies. */
export const reorderRowStyle = ownRingContainerStyles.focusWithin;

/** The insertion line's thickness, px (the engine centres it on a gap). */
export const INSERTION_LINE_THICKNESS = 2;

const listStyles = stylex.create({
	// The insertion line is the list's own pseudo-element. It is decoration
	// with no semantic role, so no element joins the list. The engine shows it
	// with `showReorderLine` and places it with the list's custom properties.
	// They set its top (`--astryx-reorder-line-y`, a compositor translate) and
	// its inline start and size, which are the dragged row's.
	list: {
		'::after': {
			content: '""',
			position: 'absolute',
			top: 0,
			insetInlineStart: 'var(--astryx-reorder-line-start, 0px)',
			inlineSize: 'var(--astryx-reorder-line-size, 0px)',
			blockSize: INSERTION_LINE_THICKNESS,
			borderRadius: INSERTION_LINE_THICKNESS / 2,
			backgroundColor: {
				default: colorVars['--color-accent'],
				'@media (forced-colors: active)': 'Highlight'
			},
			forcedColorAdjust: 'none',
			translate: '0 var(--astryx-reorder-line-y, 0px)',
			pointerEvents: 'none',
			zIndex: 2
		}
	}
});

/** The style of a reorderable list (List applies it): its insertion line. */
export const reorderListStyle = [listStyles.list, reorderLineStyles.list];

export interface ReorderHandleAttrsOptions {
	/** Where the handle sits, when it is the row's own child. */
	rowAlign?: ItemAlign;
}

/**
 * The handle's own attributes. It rings itself (`focusOutlineProps`), takes
 * its own press, and grows an invisible coarse-only hit layer.
 */
export function reorderHandleAttrs(options: ReorderHandleAttrsOptions = {}): SvelteStyleAttrs {
	const { rowAlign } = options;
	return focusOutlineProps.focusVisible(
		styles.handle,
		reorderingHandleStyles.cursor,
		touchHitAreaStyles.layer,
		rowAlign != null && styles.inRow,
		rowAlign === 'start' && styles.inRowStart,
		rowAlign === 'first-line' && styles.inRowFirstLine
	);
}

/** The hint's small button boxes and Done's padding. */
export const hintStyles = stylex.create({
	// A glyph or Done: the hint's text, with nothing of a button's own, the
	// same size under every pointer. A finger's 44 px target is the shared
	// touch hit layer, which stops short of a neighbouring target.
	button: {
		position: 'relative',
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		margin: 0,
		padding: 0,
		borderWidth: 0,
		borderRadius: 4,
		backgroundColor: 'transparent',
		color: 'inherit',
		fontFamily: 'inherit',
		fontSize: 'inherit',
		lineHeight: 'inherit',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	done: {
		paddingInline: spacingVars['--spacing-1']
	}
});

/** A hint button's attributes: the shared focus ring and the hit layer. */
export function hintButtonAttrs(isText = false): SvelteStyleAttrs {
	return focusOutlineProps.focusVisible(
		hintStyles.button,
		isText && hintStyles.done,
		touchHitAreaStyles.layer
	);
}
