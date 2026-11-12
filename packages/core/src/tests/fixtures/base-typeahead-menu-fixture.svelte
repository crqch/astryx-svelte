<script lang="ts">
	import BaseTypeahead from '$lib/components/typeahead/base-typeahead.svelte';
	import type {
		BaseTypeaheadDialogMenuInfo,
		BaseTypeaheadHandle,
		BaseTypeaheadListboxMenuInfo
	} from '$lib/components/typeahead/base-typeahead.svelte';
	import type { SearchSource, SearchableItem } from '$lib/components/typeahead/types.js';

	/**
	 * The markup and state upstream writes around `BaseTypeahead` in
	 * `BaseTypeahead.menu.test.tsx`, which a Svelte case cannot author: the two
	 * menu render functions are snippets, and an opener button needs a component
	 * that holds the handle.
	 *
	 * - `listbox-header` — information around the result list.
	 * - `listbox-control` — a focusable control outside the result list.
	 * - `editor` — a button opens a named dialog; `removeOpener` unmounts it in
	 *   the same click, as the "opener is gone" case does.
	 * - `field-picker` — a pick switches the same menu to a dialog.
	 * - `picker-listbox` — a pick calls `open()` and stays a listbox.
	 */
	type Variant =
		| 'listbox-header'
		| 'listbox-control'
		| 'editor'
		| 'field-picker'
		| 'picker-listbox';

	interface Props {
		variant: Variant;
		searchSource: SearchSource<SearchableItem>;
		removeOpener?: boolean;
		hasEntriesOnFocus?: boolean;
		onOpenChange?: (isOpen: boolean) => void;
	}

	const {
		variant,
		searchSource,
		removeOpener = false,
		hasEntriesOnFocus = false,
		onOpenChange
	}: Props = $props();

	let typeahead = $state<BaseTypeaheadHandle | null>(null);
	let field = $state<string | null>(null);
	let isOpenerShown = $state(true);

	/** Upstream reaches these through `handleRef`; here the fixture holds the instance. */
	export function open(): void {
		typeahead?.open();
	}

	export function close(): void {
		typeahead?.close();
	}
</script>

{#snippet listboxHeader({ listbox, query }: BaseTypeaheadListboxMenuInfo)}
	<div>Results for {query}</div>
	{@render listbox()}
	<div>Arrow keys move</div>
{/snippet}

{#snippet listboxControl({ listbox }: BaseTypeaheadListboxMenuInfo)}
	{@render listbox()}
	<button type="button">Create</button>
{/snippet}

{#snippet dialogPanel({ close }: BaseTypeaheadDialogMenuInfo)}
	<input aria-label="Value" value="Open" />
	<button type="button" onclick={close}>Cancel</button>
{/snippet}

{#snippet pickerDialog({ close }: BaseTypeaheadDialogMenuInfo)}
	<input aria-label="Value" />
	<button type="button" onclick={close}>Cancel</button>
{/snippet}

{#if variant === 'listbox-header'}
	<BaseTypeahead
		aria-label="Fruit"
		{searchSource}
		value={null}
		onChange={() => {}}
		debounceMs={0}
		bind:this={typeahead}
		menu={{ role: 'listbox', render: listboxHeader }}
	/>
{:else if variant === 'listbox-control'}
	<BaseTypeahead
		aria-label="Fruit"
		{searchSource}
		value={null}
		onChange={() => {}}
		debounceMs={0}
		bind:this={typeahead}
		menu={{ role: 'listbox', render: listboxControl }}
	/>
{:else if variant === 'editor'}
	{#if isOpenerShown}
		<button
			type="button"
			onclick={() => {
				if (removeOpener) {
					isOpenerShown = false;
				}
				typeahead?.open();
			}}
		>
			Status: is Open
		</button>
	{/if}
	<BaseTypeahead
		aria-label="Filters"
		{searchSource}
		value={null}
		onChange={() => {}}
		debounceMs={0}
		{hasEntriesOnFocus}
		bind:this={typeahead}
		{onOpenChange}
		menu={{ role: 'dialog', label: 'Status', render: dialogPanel }}
	/>
	<button type="button">Elsewhere</button>
{:else if variant === 'field-picker'}
	<BaseTypeahead
		aria-label="Filters"
		{searchSource}
		value={null}
		onChange={(item) => {
			field = item?.label ?? null;
			typeahead?.open();
		}}
		debounceMs={0}
		bind:this={typeahead}
		{onOpenChange}
		menu={field == null
			? { role: 'listbox' }
			: { role: 'dialog', label: field, render: pickerDialog }}
	/>
{:else}
	<BaseTypeahead
		aria-label="Fruit"
		{searchSource}
		value={null}
		onChange={() => typeahead?.open()}
		debounceMs={0}
		{hasEntriesOnFocus}
		bind:this={typeahead}
		menu={{ role: 'listbox' }}
	/>
{/if}
