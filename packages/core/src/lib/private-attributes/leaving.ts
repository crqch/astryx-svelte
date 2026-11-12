// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file leaving.ts
 * @input A List row put back for its exit, or an element a reorder's drag
 *   draws over the list
 * @output markLeaving, which marks such a row, and isLeaving, which reads the
 *   mark
 * @position Owner module of the private leaving attribute: the only file
 *   that writes its name. List's layout updates mark a row it puts back. The
 *   reorder (list/list-reorder-engine.ts) marks what a drag draws over the
 *   list. So no later commit counts them as rows. No package entry exports
 *   it.
 *
 * Ported from Astryx's `privateAttributes/leaving.stylex.ts`. It carries no
 * StyleX styles, so it is a plain module here.
 */

const LEAVING = 'data-astryx-leaving';

/** Marks `row` as put back for its exit: it is not a row any more. */
export function markLeaving(row: Element): void {
	row.setAttribute(LEAVING, '');
}

/** Whether `row` was put back for its exit. */
export function isLeaving(row: Element): boolean {
	return row.hasAttribute(LEAVING);
}
