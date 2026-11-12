<!--
	Ported from upstream's `templates/blocks/components/Table/TableLeadingMarkSelection.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Three translations, all this port's standing shape:

	- `useState` → `$state`, and `setSelectedKeys` is the plain setter the ported
	  hook takes (React's updater form has no counterpart; a `$state` read is
	  never stale).
	- Upstream's local `stylex.create` has no counterpart — a `.svelte` file may
	  not import StyleX — so its four rules become a scoped `<style>` block with
	  the same declarations. `mergeProps` composition becomes an explicit
	  class/style join in upstream's order: the reveal props come last, so they
	  win where the two sources set the same property.
	- `columns` is a `$derived.by`, not a plain array: `renderCell` and `header`
	  are template snippets, which do not exist yet while the `<script>` runs.
	  Deferring the array to first read lands inside the render, as
	  `TableRichCellTable` records.
-->
<script lang="ts">
	import {
		Avatar,
		CheckboxInput,
		HStack,
		Table,
		proportional,
		useContainerReveal,
		useTableSelectionState,
		type TableColumn
	} from '@astryx-svelte/core';

	interface Automation extends Record<string, unknown> {
		id: string;
		name: string;
		owner: string;
		schedule: string;
	}

	const automations: Automation[] = [
		{ id: '1', name: 'Nightly backup', owner: 'Alice', schedule: 'Daily, 2:00' },
		{ id: '2', name: 'Weekly digest', owner: 'Bob', schedule: 'Mondays, 9:00' },
		{ id: '3', name: 'Cache warmup', owner: 'Diana', schedule: 'Hourly' },
		{ id: '4', name: 'Usage report', owner: 'Eve', schedule: 'Monthly, 1st' }
	];

	let selectedKeys = $state(new Set<string>());
	// The mark reveals its checkbox on hover and keyboard focus, and always
	// shows it on touch.
	const reveal = useContainerReveal();
	const { selectionConfig, selectionState } = useTableSelectionState<Automation>(() => ({
		data: automations,
		idKey: 'id',
		selectedKeys,
		setSelectedKeys: (next) => (selectedKeys = next)
	}));

	const columns = $derived.by<TableColumn<Automation>[]>(() => [
		{
			key: 'name',
			header: nameHeader,
			width: proportional(2),
			renderCell: nameCell
		},
		{ key: 'owner', header: 'Owner', width: proportional(1) },
		{ key: 'schedule', header: 'Schedule', width: proportional(1) }
	]);
</script>

{#snippet nameHeader()}
	<HStack gap={2} vAlign="center">
		<CheckboxInput
			label="Select all automations"
			isLabelHidden
			value={selectionConfig.getIsAllSelected()
				? true
				: selectionConfig.getIsIndeterminate?.()
					? 'indeterminate'
					: false}
			onChange={(checked) => selectionConfig.onSelectAll({ isAllSelected: checked })}
		/>
		Automation
	</HStack>
{/snippet}

{#snippet nameCell(item: Automation)}
	{@const isSelected = selectionConfig.getIsItemSelected(item)}
	{@const markProps = reveal.getContainerProps()}
	{@const revealProps = reveal.getContentRevealProps({
		isLayoutPreserved: true,
		forceVisibility: selectionState.hasSelection ? 'shown' : undefined
	})}
	<HStack gap={2} vAlign="center">
		<span class={['mark', markProps.class].filter(Boolean).join(' ')} style={markProps.style}>
			{#if !selectionState.hasSelection}
				<span class="layer">
					<Avatar name={item.owner} size="sm" tooltip={false} />
				</span>
			{/if}
			<span
				class={['layer', 'checkbox', revealProps.class].filter(Boolean).join(' ')}
				style={[
					'border-radius: 50%; background-color: var(--color-background-surface)',
					revealProps.style
				]
					.filter(Boolean)
					.join(';')}
			>
				<CheckboxInput
					label={`Select ${item.name}`}
					isLabelHidden
					value={isSelected}
					onChange={(checked) => selectionConfig.onSelectItem({ item, isSelected: checked })}
				/>
			</span>
		</span>
		<span class="name">{item.name}</span>
	</HStack>
{/snippet}

<Table data={automations} {columns} idKey="id" />

<style>
	.mark {
		display: grid;
		place-items: center;
		flex-shrink: 0;
	}
	/* A flex layer is exactly as tall as the 24px avatar; a block layer
	   follows the taller line box and lets the avatar's edge show under the
	   checkbox. */
	.layer {
		grid-area: 1 / 1;
		display: flex;
	}
	/* The checkbox covers the avatar while it shows, so the two never read as
	   one mark. */
	.checkbox {
		border-radius: 50%;
		background-color: var(--color-background-surface);
	}
	.name {
		padding-inline-start: var(--spacing-1);
	}
</style>
