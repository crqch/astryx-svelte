<script lang="ts">
	import Typeahead from '$lib/components/typeahead/typeahead.svelte';
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

	/** Upstream's `handleRef`; the fixture holds the instance the test drives. */
	export function open(): void {
		typeahead?.open();
	}

	export function close(): void {
		typeahead?.close();
	}
</script>

{#snippet dialogPanel({ close }: BaseTypeaheadDialogMenuInfo)}
	<p>Panel</p>
	<button type="button" onclick={close}>Done</button>
{/snippet}

<Typeahead
	label="Fruit"
	{searchSource}
	value={null}
	onChange={() => {}}
	debounceMs={0}
	bind:this={typeahead}
	{onOpenChange}
	menu={{ role: 'dialog', label: 'Pick', render: dialogPanel }}
/>
