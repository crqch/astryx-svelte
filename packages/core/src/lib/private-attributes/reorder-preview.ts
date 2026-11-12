// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file reorder-preview.ts
 * @input The copy of a dragged row that follows the pointer
 * @output markReorderPreview, which marks that copy
 * @position Owner module of the private reorder-preview attribute: the only
 *   file that writes its name. The reorder machinery
 *   (list/list-reorder-engine.ts) marks the preview it draws. No package
 *   entry exports it.
 *
 * Ported from Astryx's `privateAttributes/reorderPreview.stylex.ts`. It
 * carries no StyleX styles, so it is a plain module here.
 */

const REORDER_PREVIEW = 'data-astryx-reorder-preview';

/** Marks `element` as the preview of the dragged row. */
export function markReorderPreview(element: Element): void {
	element.setAttribute(REORDER_PREVIEW, '');
}
