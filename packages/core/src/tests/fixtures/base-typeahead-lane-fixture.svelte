<script lang="ts">
	import BaseTypeahead from '$lib/components/typeahead/base-typeahead.svelte';
	import {
		createBusyIndicatorLane,
		setBusyIndicatorLaneContext
	} from '$lib/components/typeahead/busy-indicator-lane.svelte.js';
	import type { SearchableItem, SearchSource } from '$lib/components/typeahead/types.js';

	/**
	 * A wrapper that has taken the busy indicator over, as `Typeahead` and
	 * `Tokenizer` do. Upstream wraps the field in `BusyIndicatorLaneProvider`;
	 * the Svelte seam is a context set during the fixture's init.
	 */
	interface Props {
		searchSource: SearchSource<SearchableItem>;
		minQueryLength?: number;
		hasEntriesOnFocus?: boolean;
		debounceMs?: number;
		onBusyChange?: (isBusy: boolean) => void;
	}

	const {
		searchSource,
		minQueryLength = 1,
		hasEntriesOnFocus = false,
		debounceMs = 0,
		onBusyChange
	}: Props = $props();

	const lane = createBusyIndicatorLane();
	const providedLane = {
		onBusyChange(next: boolean) {
			lane.onBusyChange(next);
			onBusyChange?.(next);
		},
		getIsBusy: lane.getIsBusy
	};
	setBusyIndicatorLaneContext(() => providedLane);
</script>

<BaseTypeahead
	{searchSource}
	value={null}
	onChange={() => {}}
	{minQueryLength}
	{hasEntriesOnFocus}
	{debounceMs}
/>
