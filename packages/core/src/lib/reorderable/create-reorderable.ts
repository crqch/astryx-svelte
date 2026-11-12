// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file create-reorderable.ts
 * @input The reorder's options, and List's reorder machinery
 *   (list-reorder-engine.ts: the session and its handle)
 * @output `createReorderable`, which makes the object a collection's
 *   `reorderable` prop takes, whose one public method, `start(key)`, enters
 *   reorder mode from the app's own UI. And its types: `Reorderable`,
 *   `ReorderableOptions`, `ReorderMove`
 * @position Public Core API, exported from the package root.
 *   The machinery ships here, on the object: a collection imports only the
 *   object's type, so one without `reorderable` loads no reorder code.
 *
 * Ported from Astryx's `reorderable/createReorderable.ts`.
 */

import {
	REORDER_ENGINE,
	type ListReorderOptions,
	type ReorderableInternals
} from '../components/list/list-reorder-context.svelte.js';
import { listReorderEngine } from '../components/list/list-reorder-engine.js';

/** A committed move: the item that moved and where it went. */
export interface ReorderMove<TKey extends string | number = string | number, TTo = number> {
	/**
	 * The moved item's key: its ListItem's `itemKey`. A collection built from
	 * data takes it through its `idKey`, a field name or a function of the
	 * item, as Table's does.
	 */
	readonly key: TKey;
	/**
	 * Its index after the move, in the full order of the collection's items,
	 * mounted or not. A tree reports `{parent, index}`.
	 */
	readonly to: TTo;
}

/** What `createReorderable` takes. */
export interface ReorderableOptions<TKey extends string | number = string | number, TTo = number> {
	/**
	 * Called once per committed move: a drop, or each move in reorder mode.
	 * Apply it by rendering the items in their new order. A cancelled move calls
	 * nothing. The latest function given is the one called, so the object may be
	 * made on every render.
	 */
	onReorder: (move: ReorderMove<TKey, TTo>) => void;
	/**
	 * Whether the item with `key` can move. An item it rejects shows no handle
	 * and cannot be picked up. One at either end of the collection also bounds
	 * the others, so nothing drops beyond it and a keyboard move into it is
	 * refused. Every item moves without it.
	 */
	isReorderable?: (key: TKey) => boolean;
}

declare const reorderableBrand: unique symbol;

/**
 * A collection's reorder behavior, made by `createReorderable` and passed as
 * its `reorderable` prop. It applies to the whole collection; each item's key
 * and `isReorderable` decide which items move.
 */
export interface Reorderable<TKey extends string | number = string | number, TTo = number> {
	/** The keys and places it reports; a type, not a value. */
	readonly [reorderableBrand]: { readonly key: TKey; readonly to: TTo };
	/**
	 * Enters reorder mode for the item with `key` from the app's own UI, as
	 * activating its handle does. A Move item in a context menu or a toolbar
	 * button can call it. The focus moves to the handle, which scrolls into
	 * view, and the mode's keys, hint, announcements and exits follow. A key
	 * that cannot move, or whose item is not mounted, does nothing. It warns in
	 * development. On an object passed to two collections, it starts the mode
	 * in the one mounted last.
	 */
	start(key: TKey): void;
}

/**
 * Makes a collection's rows reorderable: pass the result as the collection's
 * `reorderable` prop (`<List reorderable={createReorderable({onReorder})}>`),
 * with an `itemKey` on each ListItem. Make it once per collection (with
 * `$derived` or a component field); one made again on each render still works.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   const reorderable = createReorderable({
 *     onReorder: ({ key, to }) => (tasks = moveItem(tasks, key, to))
 *   });
 * </script>
 * <List {reorderable}>
 *   {#each tasks as task (task.id)}
 *     <ListItem itemKey={task.id} label={task.title} />
 *   {/each}
 * </List>
 * ```
 */
export function createReorderable<TKey extends string | number = string | number, TTo = number>(
	options: ReorderableOptions<TKey, TTo>
): Reorderable<TKey, TTo> {
	const internals: ReorderableInternals = {
		options: options as unknown as ListReorderOptions,
		[REORDER_ENGINE]: listReorderEngine,
		start: (key) => listReorderEngine.start(internals.options, key)
	};
	return internals as unknown as Reorderable<TKey, TTo>;
}
