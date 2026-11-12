<script lang="ts">
	import FormLayout from '$lib/components/form-layout/form-layout.svelte';
	import Typeahead from '$lib/components/typeahead/typeahead.svelte';
	import type { SearchableItem, SearchSource } from '$lib/components/typeahead/types.js';

	/**
	 * Upstream's JSX tree for the resolved-required-state case: two fields
	 * outside a FormLayout and two inside one whose default is `required`.
	 */
	interface Props {
		searchSource: SearchSource<SearchableItem>;
	}

	const { searchSource }: Props = $props();
</script>

<Typeahead label="Plain" {searchSource} value={null} onChange={() => {}} />
<Typeahead label="Explicit" isRequired {searchSource} value={null} onChange={() => {}} />
<FormLayout defaultOptionality="required">
	<Typeahead label="By default" {searchSource} value={null} onChange={() => {}} />
	<Typeahead label="Opted out" isOptional {searchSource} value={null} onChange={() => {}} />
</FormLayout>
