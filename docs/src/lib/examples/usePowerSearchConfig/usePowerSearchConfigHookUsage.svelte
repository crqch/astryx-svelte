<!--
	Ported from upstream's `templates/blocks/components/PowerSearch/usePowerSearchConfigHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Field definitions, the people rows and the column contents are upstream's,
	unchanged. Three translations, each the precedent `PowerSearchSearchWithTable`
	already set:
	- `usePowerSearchConfig` takes getters and returns getters, so it is held as
	  `search` rather than destructured (destructuring would snapshot `config`
	  and `applyFilters` and stop tracking).
	- `renderCell` is a `Snippet<[Person]>` here, so `columns` is a `$derived.by`:
	  a template snippet does not exist while the `<script>` runs.
	- `useState` → `$state`, and `filteredPeople` is a `$derived`, so the table
	  and the result count both follow the filters.
-->
<script lang="ts">
	import { PowerSearch, Table, VStack, usePowerSearchConfig } from '@astryx-svelte/core';
	import type { PowerSearchFilter, TableColumn } from '@astryx-svelte/core';

	const statusValues = [
		{ value: 'active', label: 'Active' },
		{ value: 'on-leave', label: 'On Leave' },
		{ value: 'contractor', label: 'Contractor' }
	];

	const fieldDefs = [
		{ key: 'name', type: 'string', label: 'Name' },
		{ key: 'status', type: 'enum', label: 'Status', enumValues: statusValues },
		{ key: 'startDate', type: 'date', label: 'Start date' }
	] as const;

	interface Person extends Record<string, unknown> {
		id: string;
		name: string;
		status: string;
		startDate: number;
	}

	const people: Person[] = [
		{ id: '1', name: 'Alice Chen', status: 'active', startDate: 1672531200 },
		{ id: '2', name: 'Bob Dylan', status: 'on-leave', startDate: 1680307200 },
		{ id: '3', name: 'Charlie Kim', status: 'active', startDate: 1688169600 },
		{ id: '4', name: 'Dana Scully', status: 'contractor', startDate: 1696118400 },
		{ id: '5', name: 'Evan Wright', status: 'active', startDate: 1704067200 }
	];

	let filters = $state<PowerSearchFilter[]>([]);

	const columns = $derived.by<TableColumn<Person>[]>(() => [
		{ key: 'name', header: 'Name' },
		{
			key: 'status',
			header: 'Status',
			renderCell: statusCell
		},
		{
			key: 'startDate',
			header: 'Start Date',
			renderCell: startDateCell
		}
	]);

	const search = usePowerSearchConfig(
		() => fieldDefs,
		() => 'PeopleDirectory'
	);
	const filteredPeople = $derived(search.applyFilters(filters, people));
</script>

{#snippet statusCell(person: Person)}
	{statusValues.find((s) => s.value === person.status)?.label ?? person.status}
{/snippet}

{#snippet startDateCell(person: Person)}
	{new Date(person.startDate * 1000).toLocaleDateString('en-US', {
		timeZone: 'UTC',
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	})}
{/snippet}

<VStack gap={4}>
	<PowerSearch
		config={search.config}
		{filters}
		onChange={(newFilters) => (filters = [...newFilters])}
		placeholder="Filter directory by name, status, start date..."
		resultCount={filteredPeople.length}
	/>
	<Table data={filteredPeople} {columns} idKey="id" hasHover />
</VStack>
