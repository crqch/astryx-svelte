<!--
	Ported from upstream's `templates/blocks/components/BaseTypeahead/BaseTypeaheadMenu.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	The standing translations. Upstream's `handleRef` + `useRef` become
	`bind:this` on `BaseTypeahead` (the handle is an instance export), and its
	`anchorRef` becomes `anchorEl` — a plain element, the shape `Popover` settled.
	`HStack` exposes no element seam, so the field wrapper is captured with an
	attachment threaded through its rest props, as in
	`BaseTypeaheadCustomSearch.svelte`. The two React render functions become
	snippets; the listbox-role `render` receives the result list as a snippet,
	because Svelte cannot pass a rendered node through a plain object.
-->
<script lang="ts">
	import {
		BaseTypeahead,
		Button,
		HStack,
		Icon,
		RadioList,
		RadioListItem,
		Text,
		VStack,
		createStaticSource
	} from '@astryx-svelte/core';
	import type {
		BaseTypeaheadDialogMenuInfo,
		BaseTypeaheadHandle,
		BaseTypeaheadListboxMenuInfo,
		SearchableItem
	} from '@astryx-svelte/core';

	type Field = SearchableItem & { values: string[] };

	const fields: Field[] = [
		{ id: 'status', label: 'Status', values: ['Open', 'In review', 'Closed'] },
		{ id: 'priority', label: 'Priority', values: ['High', 'Medium', 'Low'] },
		{ id: 'owner', label: 'Owner', values: ['Me', 'My team', 'Anyone'] }
	];

	const source = createStaticSource<Field>(fields);

	type Filter = { field: Field; value: string };

	let typeahead = $state<BaseTypeaheadHandle | null>(null);
	let fieldEl = $state<HTMLElement | null>(null);
	let filters = $state<Filter[]>([]);
	let editing = $state<Filter | null>(null);
	let draft = $state('');

	function edit(filter: Filter): void {
		editing = filter;
		draft = filter.value;
		typeahead?.open();
	}
</script>

{#snippet listboxMenu({ listbox, query }: BaseTypeaheadListboxMenuInfo)}
	<Text
		type="supporting"
		color="secondary"
		style="padding-block: var(--spacing-1); padding-inline: var(--spacing-3)"
	>
		{query === '' ? 'Filter by' : `Fields matching “${query}”`}
	</Text>
	{@render listbox()}
	<Text
		type="supporting"
		color="secondary"
		style="padding-block: var(--spacing-1); padding-inline: var(--spacing-3)"
	>
		Arrow keys move, Enter picks
	</Text>
{/snippet}

{#snippet dialogMenu({ close }: BaseTypeaheadDialogMenuInfo)}
	{#if editing}
		<VStack gap={3} style="padding: var(--spacing-3); min-width: 260px">
			<RadioList label={editing.field.label} value={draft} onChange={(value) => (draft = value)}>
				{#each editing.field.values as value (value)}
					<RadioListItem label={value} {value} />
				{/each}
			</RadioList>
			<HStack gap={2} hAlign="end">
				<Button label="Cancel" variant="secondary" onclick={close} />
				<Button
					label="Apply"
					variant="primary"
					onclick={() => {
						const next = { field: editing!.field, value: draft };
						filters = [...filters.filter((f) => f.field.id !== next.field.id), next];
						close();
					}}
				/>
			</HStack>
		</VStack>
	{/if}
{/snippet}

<VStack gap={3} style="width: 100%; max-width: 420px">
	<HStack
		{@attach (el) => {
			fieldEl = el;
		}}
		gap={2}
		vAlign="center"
		class="base-typeahead-menu-field"
	>
		<Icon icon="funnel" size="sm" color="secondary" />
		<BaseTypeahead
			aria-label="Add a filter"
			searchSource={source}
			value={null}
			onChange={(field) => {
				if (field != null) {
					// A field that already has a filter opens on its applied value.
					edit(
						filters.find((filter) => filter.field.id === field.id) ?? {
							field,
							value: field.values[0]
						}
					);
				}
			}}
			onOpenChange={(isOpen) => {
				if (!isOpen) {
					editing = null;
				}
			}}
			bind:this={typeahead}
			menu={editing == null
				? { role: 'listbox', render: listboxMenu }
				: {
						role: 'dialog',
						label: `${editing.field.label} filter`,
						render: dialogMenu
					}}
			anchorEl={fieldEl}
			placeholder="Add a filter…"
			hasEntriesOnFocus
			debounceMs={0}
		/>
	</HStack>
	<HStack gap={2} wrap="wrap">
		{#if filters.length === 0}
			<Text type="supporting" color="secondary">No filters</Text>
		{:else}
			{#each filters as filter (filter.field.id)}
				<Button
					label={`${filter.field.label}: ${filter.value}`}
					variant="secondary"
					size="sm"
					onclick={() => edit(filter)}
				/>
			{/each}
		{/if}
	</HStack>
</VStack>

<style>
	/* The class lands on `HStack`'s internal element, so `:global` is what lets
	   the component's scoped CSS reach it — the same reason the showcase's focus
	   rule is global. */
	:global(.base-typeahead-menu-field) {
		background-color: var(--color-background-surface);
		border-color: var(--color-border);
		border-radius: var(--radius-element);
		border-style: solid;
		border-width: var(--border-width);
		padding-block: var(--spacing-1-5);
		padding-inline: var(--spacing-2);
		outline-color: transparent;
		outline-offset: var(--focus-outline-offset);
		outline-style: solid;
		outline-width: 0;
	}

	:global(.base-typeahead-menu-field:has(input:focus-visible)) {
		outline-color: var(--focus-outline-color);
		outline-width: var(--focus-outline-width);
	}
</style>
