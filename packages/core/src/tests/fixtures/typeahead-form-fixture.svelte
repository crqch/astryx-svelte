<script lang="ts">
	import Typeahead from '$lib/components/typeahead/typeahead.svelte';
	import type { SearchableItem, SearchSource } from '$lib/components/typeahead/types.js';

	/** A Typeahead inside a form, for the Enter-does-not-submit case. */
	interface Props {
		searchSource: SearchSource<SearchableItem>;
		isDisabled?: boolean;
		disabledMessage?: string;
		onSubmit?: (event: SubmitEvent) => void;
		onChange?: (item: SearchableItem | null) => void;
	}

	const {
		searchSource,
		isDisabled = false,
		disabledMessage = 'You need the Editor role',
		onSubmit,
		onChange
	}: Props = $props();
</script>

<form
	onsubmit={(event) => {
		event.preventDefault();
		onSubmit?.(event);
	}}
>
	<Typeahead
		label="Assignee"
		{searchSource}
		value={null}
		onChange={onChange ?? (() => {})}
		hasEntriesOnFocus
		{isDisabled}
		{disabledMessage}
	/>
</form>
