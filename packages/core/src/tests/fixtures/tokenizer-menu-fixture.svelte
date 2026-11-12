<script lang="ts">
	import Tokenizer from '$lib/components/tokenizer/tokenizer.svelte';
	import type {
		BaseTypeaheadDialogMenuInfo,
		BaseTypeaheadHandle
	} from '$lib/components/typeahead/base-typeahead.svelte';
	import type { SearchSource, SearchableItem } from '$lib/components/typeahead/types.js';

	interface Props {
		searchSource: SearchSource<SearchableItem>;
		onOpenChange?: (isOpen: boolean) => void;
	}

	const { searchSource, onOpenChange }: Props = $props();

	let typeahead = $state<BaseTypeaheadHandle | null>(null);

	/** Upstream's `TokenizerHandle`; the fixture holds the instance the test drives. */
	export function open(): void {
		typeahead?.open();
	}

	export function close(): void {
		typeahead?.close();
	}
</script>

{#snippet dialogPanel()}
	<p>Panel</p>
{/snippet}

<Tokenizer
	label="Filters"
	presentation="popover"
	{searchSource}
	value={[]}
	onChange={() => {}}
	debounceMs={0}
	bind:this={typeahead}
	{onOpenChange}
	menu={{ role: 'dialog', label: 'Status', render: dialogPanel }}
/>
