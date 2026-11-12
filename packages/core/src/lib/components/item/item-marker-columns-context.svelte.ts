import { Context } from '../../internal/context.js';

/**
 * Svelte equivalent of Astryx's `Item/ItemMarkerColumnsContext.tsx`.
 *
 * A numbered `ListItem` row needs two subgrid cells: one for its marker and one
 * for everything else, so the marker's intrinsic width is what sizes the List's
 * shared column. The row publishes the request to the `Item` it composes; every
 * other marked `Item` keeps its flat flex children, because the value defaults
 * to `false`.
 */
const ItemMarkerColumnsContext = new Context<() => boolean>('astryx.itemMarkerColumns');

/** Whether this row's Item should wrap its content beside the marker. */
export function setItemMarkerColumns(get: () => boolean): void {
	ItemMarkerColumnsContext.set(get);
}

/**
 * The enclosing row's request as a getter, or a constant `false` for a
 * standalone `Item`. A getter rather than a value so a row that switches
 * between markers and shared number columns updates without remounting.
 */
export function useItemMarkerColumns(): () => boolean {
	return ItemMarkerColumnsContext.getOr(() => false);
}
