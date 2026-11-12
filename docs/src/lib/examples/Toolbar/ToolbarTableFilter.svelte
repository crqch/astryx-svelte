<!--
	Ported from upstream's `templates/blocks/components/Toolbar/ToolbarTableFilter.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Two translations, both mechanical. Every `stylex.create` block becomes an
	inline `style` string over the same token variables. And `controlXstyle`
	becomes `style`: this port's `Selector` has one style seam and it targets the
	control box — the element that paints the border and background — which is
	exactly what upstream's `controlXstyle` addresses.

	`OverflowList` takes `items` plus an `item` snippet where upstream slices
	`children`, so the clause list is `FIELDS` and the same `clauseSelector`
	snippet renders the row and the folded panel.
-->
<script lang="ts">
	import {
		Button,
		CheckboxList,
		CheckboxListItem,
		EmptyState,
		HStack,
		Heading,
		Icon,
		Link,
		OverflowList,
		Popover,
		Section,
		Selector,
		Stack,
		StackItem,
		Table,
		Text,
		TextInput,
		Toolbar,
		VStack,
		pixel,
		proportional,
		type TableColumn
	} from '@astryx-svelte/core';

	interface Job extends Record<string, unknown> {
		id: string;
		job: string;
		customer: string;
		status: string;
		priority: string;
	}

	const JOBS: Job[] = [
		{
			id: 'SJ-2136',
			job: 'VAV zones not cooling',
			customer: 'Northgate Dental',
			status: 'In progress',
			priority: 'High'
		},
		{
			id: 'SJ-2135',
			job: 'Exhaust fan noise',
			customer: 'Riverside Club',
			status: 'On hold',
			priority: 'Normal'
		},
		{
			id: 'SJ-2134',
			job: 'Humidifier board fault',
			customer: 'Summit Medical',
			status: 'Overdue',
			priority: 'High'
		},
		{
			id: 'SJ-2133',
			job: 'Economizer stuck shut',
			customer: 'Northgate Dental',
			status: 'Scheduled',
			priority: 'Normal'
		},
		{
			id: 'SJ-2101',
			job: 'Contactor replacement',
			customer: 'Harborview Hotel',
			status: 'Completed',
			priority: 'Low'
		}
	];

	// One entry per filterable field. The closed trigger reads as the bare field
	// name unset, and `renderValue` expands a set one to the whole clause, so each
	// Selector doubles as its own filter chip.
	const FIELDS = [
		{
			key: 'status',
			label: 'Status',
			options: ['Scheduled', 'In progress', 'On hold', 'Overdue', 'Completed']
		},
		{ key: 'priority', label: 'Priority', options: ['High', 'Normal', 'Low'] },
		{
			key: 'customer',
			label: 'Customer',
			options: ['Northgate Dental', 'Riverside Club', 'Summit Medical', 'Harborview Hotel']
		}
	];

	const COLUMNS: TableColumn<Job>[] = [
		{ key: 'job', header: 'Job', width: proportional(2) },
		{ key: 'customer', header: 'Customer', width: proportional(2) },
		{ key: 'status', header: 'Status', width: pixel(110) },
		{ key: 'priority', header: 'Priority', width: pixel(90) }
	];

	/**
	 * Width held back inside the clause slot for the readout that sits in it.
	 *
	 * The readout lives in the slot the overflow list measures, so without this
	 * the list would count its width as room for another clause and push it off
	 * the end. The slot pays for it as padding — the one part of the box the
	 * measurement already subtracts — and the readout takes it back with a
	 * matching negative margin, so it draws over the reserve and still lands
	 * against the last clause rather than at the row's far edge.
	 */
	const READOUT_RESERVE = 116;

	let search = $state('');
	let clauses = $state<Record<string, string | null>>({});
	let columnKeys = $state(COLUMNS.map((column) => column.key));

	const hasFilters = $derived(
		search !== '' || Object.values(clauses).some((value) => value != null)
	);

	function clearAll(): void {
		search = '';
		clauses = {};
	}

	// Search and every clause narrow one pass, so the table answers the whole bar
	// rather than whichever control moved last.
	const results = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return JOBS.filter(
			(row) =>
				(query === '' || `${row.job} ${row.customer}`.toLowerCase().includes(query)) &&
				FIELDS.every((field) => clauses[field.key] == null || row[field.key] === clauses[field.key])
		);
	});

	const visibleColumns = $derived(COLUMNS.filter((column) => columnKeys.includes(column.key)));
</script>

{#snippet clauseSelector(field: (typeof FIELDS)[number])}
	<Selector
		label={`${field.label} filter`}
		isLabelHidden
		placeholder={field.label}
		size="sm"
		hasClear
		options={field.options}
		value={clauses[field.key] ?? null}
		style={clauses[field.key] != null
			? 'background-color: var(--color-overlay-pressed)'
			: undefined}
		onChange={(value) => (clauses = { ...clauses, [field.key]: value })}
	>
		{#snippet renderValue(option)}
			{`${field.label} is ${option.label ?? option.value}`}
		{/snippet}
	</Selector>
{/snippet}

<!--
	Section, not a bare stack: the toolbar row and the table's first column have
	to start on the same line, and the container publishes the padding both read
	— the toolbar pads to it, and the table bleeds edge to edge and compensates
	its outer cells back to it. Transparent and borderless, because whatever hosts
	this block already paints its own frame.
-->
<Section variant="transparent" padding={2} width="100%" height="100%">
	<Toolbar label="Job filters" size="sm" dividers={['bottom']}>
		{#snippet startContent()}
			<!--
				One full-width row rather than the toolbar's own two slots: the
				overflow list has to measure the width it actually has, and a slot
				sized by its own contents would feed the list its own output — fold
				a clause, the slot narrows, the list folds again.
			-->
			<HStack gap={2} vAlign="center" wrap="nowrap" style="flex-grow: 1; min-width: 0">
				<!--
					Search leads the row as the broadest filter, and sits outside the
					overflow list so it is never the clause that folds — a hidden
					search box reads as a missing feature, not a folded one.
				-->
				<StackItem style="flex-shrink: 1; min-width: 120px; width: 120px">
					<TextInput
						label="Search jobs"
						isLabelHidden
						placeholder="Search"
						size="sm"
						width="100%"
						value={search}
						onChange={(value) => (search = value)}
						hasClear
					>
						{#snippet startIcon()}<Icon icon="search" size="sm" color="secondary" />{/snippet}
					</TextInput>
				</StackItem>
				<!--
					The slot, not the list, carries the sizing: as the row's only
					grower it settles at whatever the search box and the trailing
					controls leave, and the list reads that.
				-->
				<StackItem
					size="fill"
					style="display: flex; align-items: center; min-width: 0; overflow: hidden; container-type: inline-size; padding-inline-end: 116px"
				>
					<!--
						No floor on how many stay out: at this width a set clause
						reads as a whole sentence ("Status is Overdue"), and pinning
						one to the row would push the readout off the end. The count
						is what stays, and it opens onto every clause.
					-->
					<OverflowList
						items={FIELDS}
						gap={2}
						behavior="observeParent"
						style="flex-grow: 0; flex-shrink: 0; width: max-content; max-width: 100%"
						minVisibleItems={0}
					>
						{#snippet item(field)}
							{@render clauseSelector(field)}
						{/snippet}
						{#snippet overflowRenderer(overflowItems)}
							<Popover
								placement="below"
								alignment="start"
								width={240}
								label={`${overflowItems.length} more filters`}
							>
								{#snippet content()}
									<VStack gap={2}>
										{#each overflowItems as { value } (value.key)}
											<Stack direction="vertical">
												{@render clauseSelector(value)}
											</Stack>
										{/each}
									</VStack>
								{/snippet}
								<Button
									label={`+${overflowItems.length}`}
									tooltip={`${overflowItems.length} more filters`}
									variant="ghost"
									size="sm"
									style="border: var(--border-width) solid var(--color-border-emphasized); border-radius: var(--radius-element); background-color: var(--color-background-surface)"
								/>
							</Popover>
						{/snippet}
					</OverflowList>

					<!--
						Inside the slot rather than beside it: a sibling would sit
						after the slot, and the slot spans the row's leftover, so the
						readout would land at the trailing edge however few clauses
						were showing. In here it follows the clauses, and the reserve
						is what stops the list from spending the width it needs.
					-->
					<HStack
						gap={2}
						vAlign="center"
						wrap="nowrap"
						style={`flex-shrink: 0; white-space: nowrap; margin-inline-start: 8px; margin-inline-end: -${READOUT_RESERVE}px`}
					>
						<Text type="supporting" color="secondary">
							{results.length} of {JOBS.length}
						</Text>
						{#if hasFilters}
							<Text type="supporting" color="secondary">•</Text>
							<!--
								Href-less, so Link renders a button: this resets the
								filters, it does not navigate.
							-->
							<Link type="supporting" onclick={clearAll}>Clear all</Link>
						{/if}
					</HStack>
				</StackItem>
				<!--
					View options closes the row: it acts on the table, not on the
					filter set, so it stands apart from the clauses.
				-->
				<Popover placement="below" alignment="end" label="View options">
					{#snippet content()}
						<VStack gap={3} style="width: 320px">
							<Heading level={3}>Columns</Heading>
							<CheckboxList
								label="Displayed columns"
								isLabelHidden
								density="compact"
								value={columnKeys}
								onChange={(values) => (columnKeys = values)}
							>
								{#each COLUMNS as column (column.key)}
									<CheckboxListItem value={column.key} label={String(column.header)} />
								{/each}
							</CheckboxList>
						</VStack>
					{/snippet}
					<Button label="View options" tooltip="View options" isIconOnly variant="ghost" size="sm">
						{#snippet icon()}<Icon icon="viewColumns" size="sm" color="secondary" />{/snippet}
					</Button>
				</Popover>
			</HStack>
		{/snippet}
	</Toolbar>
	{#if results.length === 0}
		<EmptyState isCompact title="No jobs match these filters">
			{#snippet actions()}
				<Button label="Clear all" size="sm" onclick={clearAll} />
			{/snippet}
		</EmptyState>
	{:else}
		<Table
			idKey="id"
			density="compact"
			textOverflow="truncate"
			columns={visibleColumns}
			data={results}
		/>
	{/if}
</Section>
