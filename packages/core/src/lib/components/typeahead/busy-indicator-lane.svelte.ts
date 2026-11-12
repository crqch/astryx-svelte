import { Context } from '../../internal/context.js';

/**
 * Ported from Astryx's `Typeahead/busyIndicatorLane.tsx`.
 *
 * How the base hands its busy state to a wrapper that owns the inline-end lane.
 *
 * Typeahead and Tokenizer both render a clear button and end content in one
 * corner, and both want the busy indicator in that same lane rather than a
 * second one competing for the corner. The base is the only thing that knows
 * when a search starts or settles, so that state has to travel from the base
 * out to its wrapper.
 *
 * A CONTEXT rather than a prop, because a prop cannot be package-internal
 * here: `BaseTypeaheadProps` is re-exported from the package entry point, so
 * every name on it ships as public API however it is commented — an
 * `@internal` tag is a note to a reader, not a boundary. The module is not
 * exported from the barrel, so the seam is closed by module boundary instead
 * of by naming convention.
 *
 * Upstream's lane is a store because React needs a subscription to keep the
 * wrapper from re-rendering; Svelte's fine-grained reactivity does that for a
 * plain `$state` read, so `getIsBusy` is the whole subscription here. The
 * state has exactly one owner — the base — and only the leaf that paints the
 * indicator reads it.
 */
export interface BusyIndicatorLane {
	/** Called by the base when a search starts or settles. */
	onBusyChange: (isBusy: boolean) => void;
	/** The current busy state. */
	getIsBusy: () => boolean;
}

/**
 * The lane a wrapper creates once and provides around its `BaseTypeahead`.
 *
 * Edge-triggered, as upstream's is: the base already guards its own redundant
 * reports, and this keeps a second caller from waking every reader for a state
 * they are already rendering.
 */
export function createBusyIndicatorLane(): BusyIndicatorLane {
	let isBusy = $state(false);
	return {
		onBusyChange(next: boolean) {
			if (isBusy === next) {
				return;
			}
			isBusy = next;
		},
		getIsBusy: () => isBusy
	};
}

const busyIndicatorLaneContext = new Context<() => BusyIndicatorLane | null>(
	'astryx.busyIndicatorLane'
);

/** Provide the wrapper's lane to the `BaseTypeahead` below it. */
export function setBusyIndicatorLaneContext(get: () => BusyIndicatorLane | null): void {
	busyIndicatorLaneContext.set(get);
}

/**
 * The wrapper's lane, or null when the base is used directly.
 *
 * Null is the released behaviour: the base renders its own visible, named
 * status. Non-null means a wrapper paints it instead, so the base renders
 * nothing and the two cannot both appear.
 */
export function useBusyIndicatorLane(): (() => BusyIndicatorLane | null) | null {
	return busyIndicatorLaneContext.getOr(null);
}
