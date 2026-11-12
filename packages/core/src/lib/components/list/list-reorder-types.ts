// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file list-reorder-types.ts
 * @input A List row's item key and alignment
 * @output The small type surface the reorder's modules share: `Key`,
 *   `ItemAlign` re-used from Item, and the handle's and row-name's props
 * @position Internal to List. It holds no runtime code, so a module that only
 *   needs the types (ListItem, the handle) loads nothing else.
 *
 * Ported from Astryx's `List/listReorderContext.ts` type section.
 */

import type { Snippet } from 'svelte';
import type { ItemAlign } from '../item/item.stylex.js';

/** A row's item key, as a data collection supplies it (Table's `idKey`). */
export type Key = string | number;

/** The handle a reorderable row ends with. */
export interface ListReorderHandleProps {
	/** The row's label: its text names the handle. */
	readonly label: string | Snippet;
	/** The row's item key (ListItem `itemKey`), which its moves report. */
	readonly itemKey: Key;
	/**
	 * The row's own accessible name, when its caller gave one (ListItem
	 * `aria-label`): the handle is "Reorder" followed by it.
	 */
	readonly rowLabel?: string;
	/**
	 * The elements that name the row, when its caller gave them (ListItem
	 * `aria-labelledby`): the handle is "Reorder" followed by them.
	 */
	readonly rowLabelledBy?: string;
	/**
	 * The row is disabled: the handle stays focusable with
	 * `aria-disabled="true"`, and no gesture or key moves the row.
	 */
	readonly isDisabled?: boolean;
	/**
	 * The row's alignment (ListItem `align`) when the handle is the row's own
	 * child, after its label. That is a row without end content, which has no
	 * end slot to align it. Absent inside the end slot.
	 */
	readonly rowAlign?: ItemAlign;
}

/**
 * A reorderable List's row without a handle: its label names it in the
 * announcements of the moves beside it.
 */
export interface ListReorderRowNameProps {
	/** The row's element. */
	readonly row: () => HTMLElement | null;
	/** The row's label. */
	readonly label: string | Snippet;
}
