<script lang="ts">
	import Dialog from '$lib/components/dialog/dialog.svelte';
	import BaseTypeahead from '$lib/components/typeahead/base-typeahead.svelte';
	import type { SearchableItem, SearchSource } from '$lib/components/typeahead/types.js';

	/** A field inside a host Dialog, for the outside-press interaction. */
	interface Props {
		searchSource: SearchSource<SearchableItem>;
		onDialogChange?: (isOpen: boolean) => void;
	}

	const { searchSource, onDialogChange }: Props = $props();
</script>

<Dialog isOpen onOpenChange={(isOpen) => onDialogChange?.(isOpen)}>
	<p>Dialog text</p>
	<BaseTypeahead {searchSource} value={null} onChange={() => {}} debounceMs={0} />
</Dialog>
