<script lang="ts">
	import Typeahead from '$lib/components/typeahead/typeahead.svelte';
	import type { SearchableItem, SearchSource } from '$lib/components/typeahead/types.js';

	/** Upstream's three-field tree for the `aria-invalid` case. */
	interface Props {
		searchSource: SearchSource<SearchableItem>;
	}

	const { searchSource }: Props = $props();
</script>

<Typeahead label="None" {searchSource} value={null} onChange={() => {}} />
<Typeahead
	label="Warned"
	status={{ type: 'warning', message: 'Check this' }}
	{searchSource}
	value={null}
	onChange={() => {}}
/>
<Typeahead
	label="Failed"
	status={{ type: 'error', message: 'Pick one' }}
	{searchSource}
	value={null}
	onChange={() => {}}
/>
