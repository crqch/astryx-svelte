import type { Snippet } from 'svelte';
import { Context } from '../../internal/context.js';

/**
 * Svelte equivalent of Astryx's `Item/ItemTrailingContext.tsx`.
 *
 * A List row's reorder handle is the one element reordering adds to a row.
 * With end content, the handle joins Item's end slot. Without it, putting the
 * handle in `endContent` would wrap it in an end-slot element of its own, a
 * second element. Such a row passes the handle here instead, and Item renders
 * it after its slots, unwrapped. Item resets the context for what it renders,
 * so a nested Item never renders its parent's control.
 *
 * `null` when the row adds nothing.
 */
const ItemTrailingContext = new Context<() => Snippet | null>('astryx.itemTrailing');

/** The trailing snippet getter the enclosing row adds. Null by default. */
export function useItemTrailing(): () => Snippet | null {
	return ItemTrailingContext.getOr<() => Snippet | null>(() => null);
}

/** Publishes the row's trailing control to the Item it composes. */
export function setItemTrailing(get: () => Snippet | null): void {
	ItemTrailingContext.set(get);
}
