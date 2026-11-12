<script lang="ts">
	import { untrack } from 'svelte';
	import Typeahead from '$lib/components/typeahead/typeahead.svelte';
	import type { SearchableItem, SearchSource } from '$lib/components/typeahead/types.js';

	/**
	 * Upstream's inline `Controlled` component in the edit-mode clear cases: the
	 * field owns the value it was given and updates it from `onChange`.
	 */
	interface Props {
		searchSource: SearchSource<SearchableItem>;
		initialValue: SearchableItem;
		onChange?: (item: SearchableItem | null) => void;
		onChangeQuery?: (query: string) => void;
		hasClear?: boolean;
		hasEntriesOnFocus?: boolean;
		debounceMs?: number;
	}

	const {
		searchSource,
		initialValue,
		onChange,
		onChangeQuery,
		hasClear = true,
		hasEntriesOnFocus = false,
		debounceMs = 0
	}: Props = $props();

	let value = $state<SearchableItem | null>(untrack(() => initialValue));

	function handleChange(item: SearchableItem | null): void {
		value = item;
		onChange?.(item);
	}
</script>

<Typeahead
	label="Fruit"
	{searchSource}
	{value}
	onChange={handleChange}
	{onChangeQuery}
	{hasClear}
	{hasEntriesOnFocus}
	{debounceMs}
/>
