<script lang="ts">
	import InputGroup from '$lib/components/input-group/input-group.svelte';
	import Typeahead from '$lib/components/typeahead/typeahead.svelte';
	import type { SearchableItem, SearchSource } from '$lib/components/typeahead/types.js';

	/** Upstream's grouped aria-labelledby arrangement. */
	interface Props {
		searchSource: SearchSource<SearchableItem>;
	}

	const { searchSource }: Props = $props();
</script>

<span id="billing-heading">Billing</span>
<InputGroup label="Contact">
	<Typeahead
		label="Fruit"
		{searchSource}
		value={null}
		onChange={() => {}}
		aria-labelledby="billing-heading"
	/>
</InputGroup>
