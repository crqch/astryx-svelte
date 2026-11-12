<!--
	Ported from upstream's `templates/blocks/components/Table/TableBulkActionsTable.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Two translations: `useState` → `$state` (the `Set` reassignment is the
	reactive boundary), and both hooks take getters where upstream passes the
	config object. `setSelectedKeys` is a plain setter — the port's hook takes
	`(next: Set<string>) => void` because React's updater form only guards a
	stale batched setter, and a `$state` read is never stale.
-->
<script lang="ts">
	import {
		Button,
		Table,
		TableSelectionToolbar,
		proportional,
		useTableSelection,
		useTableSelectionState,
		type TableColumn
	} from '@astryx-svelte/core';

	interface User extends Record<string, unknown> {
		id: string;
		name: string;
		email: string;
		role: string;
	}

	const users: User[] = [
		{ id: '1', name: 'Alice', email: 'alice@example.com', role: 'Engineer' },
		{ id: '2', name: 'Bob', email: 'bob@example.com', role: 'Designer' },
		{ id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'Manager' },
		{ id: '4', name: 'Diana', email: 'diana@example.com', role: 'Engineer' },
		{ id: '5', name: 'Eve', email: 'eve@example.com', role: 'Admin' }
	];

	const columns: TableColumn<User>[] = [
		{ key: 'name', header: 'Name', width: proportional(1) },
		{ key: 'email', header: 'Email', width: proportional(2) },
		{ key: 'role', header: 'Role', width: proportional(1) }
	];

	let selectedKeys = $state(new Set<string>());

	const { selectionConfig, selectionState } = useTableSelectionState<User>(() => ({
		data: users,
		idKey: 'id',
		selectedKeys,
		setSelectedKeys: (next) => (selectedKeys = next)
	}));
	const selectionPlugin = useTableSelection<User>(() => selectionConfig);
</script>

<div>
	<TableSelectionToolbar selection={selectionState}>
		{#snippet startContent()}
			<Button label="Export" variant="ghost" onclick={() => {}} />
			<Button label="Delete" variant="ghost" onclick={selectionState.clearSelection} />
		{/snippet}
	</TableSelectionToolbar>
	<Table data={users} {columns} idKey="id" plugins={{ selection: selectionPlugin }} />
</div>
