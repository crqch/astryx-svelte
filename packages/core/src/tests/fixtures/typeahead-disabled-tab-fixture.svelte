<script lang="ts">
	import Typeahead from '$lib/components/typeahead/typeahead.svelte';
	import type { SearchableItem, SearchSource } from '$lib/components/typeahead/types.js';

	/** A control before the field, so Tab lands on the disabled field's tab stop. */
	interface Props {
		searchSource: SearchSource<SearchableItem>;
		onChange?: (item: SearchableItem | null) => void;
	}

	const { searchSource, onChange }: Props = $props();
</script>

<button type="button">Before</button>
<Typeahead
	label="Assignee"
	{searchSource}
	value={null}
	onChange={onChange ?? (() => {})}
	hasEntriesOnFocus
	isDisabled
/>
