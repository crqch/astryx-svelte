// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file reorder-line.stylex.ts
 * @input A reorderable List's root while its insertion line shows
 * @output showReorderLine and hideReorderLine, which mark the list, and
 *   reorderLineStyles, which shows the list's line while it is marked
 * @position Owner module of the private reorder-line attribute: the only
 *   file that writes its name. The reorder machinery
 *   (list/list-reorder-engine.ts) marks the list, and the list's own
 *   pseudo-element (list/list-reorder-handle.stylex.ts) is the line. No
 *   package entry exports it.
 *
 * Ported from Astryx's `privateAttributes/reorderLine.stylex.ts`.
 */

import * as stylex from '@stylexjs/stylex';

const REORDER_LINE = 'data-astryx-reorder-line';

/** Shows `list`'s insertion line. */
export function showReorderLine(list: Element): void {
	list.setAttribute(REORDER_LINE, '');
}

/** Hides `list`'s insertion line. */
export function hideReorderLine(list: Element): void {
	list.removeAttribute(REORDER_LINE);
}

export const reorderLineStyles = stylex.create({
	// The line is the list's `::after`, drawn only while the list is marked.
	list: {
		'::after': {
			display: {
				default: 'none',
				'[data-astryx-reorder-line]': 'block'
			}
		}
	}
});
