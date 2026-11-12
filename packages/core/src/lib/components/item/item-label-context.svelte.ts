import { Context } from '../../internal/context.js';

/**
 * Svelte equivalent of Astryx's `Item/ItemLabelContext.tsx`.
 *
 * `Item` renders the row's label and owns the element that holds it. A control
 * in a slot points at that element with `aria-labelledby`, so a label of any
 * shape names it. A List row's reorder handle is one: "Reorder" followed by
 * the row's label. Only `Item` knows the element's id. Publishing it here keeps
 * that wiring internal, as the description context does for the description.
 *
 * `null` when the row renders no label, or when no control asks for it
 * (`ItemLabelNeededContext`): a row gives its label an id only when needed.
 */
const ItemLabelContext = new Context<() => string | null>('astryx.itemLabel');

/** The enclosing Item's label element id getter. Null outside an Item. */
export function useItemLabel(): () => string | null {
	return ItemLabelContext.getOr<() => string | null>(() => null);
}

/** Publishes the label element id to a control `Item` renders in a slot. */
export function setItemLabel(get: () => string | null): void {
	ItemLabelContext.set(get);
}

/**
 * Whether a control in the row is named after the row's label. `Item` gives its
 * label element an id, and publishes it, only then.
 */
const ItemLabelNeededContext = new Context<() => boolean>('astryx.itemLabelNeeded');

/** Whether the enclosing Item should give its label element an id. */
export function useItemLabelNeeded(): () => boolean {
	return ItemLabelNeededContext.getOr<() => boolean>(() => false);
}

/** Asks the enclosing Item for the label element's id. */
export function setItemLabelNeeded(get: () => boolean): void {
	ItemLabelNeededContext.set(get);
}
