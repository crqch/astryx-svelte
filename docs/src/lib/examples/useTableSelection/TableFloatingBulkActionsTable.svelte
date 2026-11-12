<!--
	Ported from upstream's `templates/blocks/components/Table/TableFloatingBulkActionsTable.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Upstream's local `stylex.create` block has no counterpart — a `.svelte` file
	may not import StyleX — so its six rules become a scoped `<style>` block with
	the same declarations. The two caller-owned rules that upstream passes as
	`xstyle` (`styles.page` on `ScrollableArea`, `styles.toolbar` on
	`TableSelectionToolbar`) become inline `style` strings: a class passed into a
	component prop is not rewritten by Svelte's scoping, while an inline style
	lands on the same element upstream's `xstyle` does.

	`useState` → `$state` and both hooks take getters, as in the other examples.
-->
<script lang="ts">
	import {
		Button,
		ScrollableArea,
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

	const baseUsers: Array<Pick<User, 'name' | 'email' | 'role'>> = [
		{ name: 'Alice', email: 'alice@example.com', role: 'Engineer' },
		{ name: 'Bob', email: 'bob@example.com', role: 'Designer' },
		{ name: 'Charlie', email: 'charlie@example.com', role: 'Manager' },
		{ name: 'Diana', email: 'diana@example.com', role: 'Engineer' },
		{ name: 'Eve', email: 'eve@example.com', role: 'Admin' }
	];

	const users: User[] = Array.from({ length: 40 }, (_, index) => {
		const user = baseUsers[index % baseUsers.length]!;
		return { ...user, id: String(index + 1), name: `${user.name} ${index + 1}` };
	});

	const columns: TableColumn<User>[] = [
		{ key: 'name', header: 'Name', width: proportional(1) },
		{ key: 'email', header: 'Email', width: proportional(1) },
		{ key: 'role', header: 'Role', width: proportional(1) }
	];

	const pageStyle = 'max-block-size: 640px; isolation: isolate; scrollbar-gutter: stable';
	const toolbarStyle = [
		'position: sticky',
		'inset-block-start: calc(var(--table-bulk-actions-space) + var(--spacing-4))',
		'transform: translateY(calc(0px - var(--table-bulk-actions-space)))',
		'margin-block-end: calc(var(--spacing-4) - var(--table-bulk-actions-space))',
		'z-index: 1',
		'border-radius: var(--radius-element)',
		'box-shadow: var(--shadow-med)'
	].join('; ');

	let selectedKeys = $state(new Set<string>());

	const { selectionConfig, selectionState } = useTableSelectionState<User>(() => ({
		data: users,
		idKey: 'id',
		selectedKeys,
		setSelectedKeys: (next) => (selectedKeys = next)
	}));
	const selectionPlugin = useTableSelection<User>(() => selectionConfig);
</script>

<ScrollableArea axis="block" label="Bulk actions example" overscroll="contain" style={pageStyle}>
	<div class="metrics">
		{#each [['Active users', '12,840'], ['Selection rate', '18.4%'], ['Pending reviews', '247']] as [label, value] (label)}
			<div class="metric-card">
				<span class="metric-label">{label}</span>
				<strong class="metric-value">{value}</strong>
			</div>
		{/each}
	</div>
	<div class="table-region">
		<TableSelectionToolbar selection={selectionState} style={toolbarStyle}>
			{#snippet startContent()}
				<Button label="Approve" variant="ghost" onclick={() => {}} />
			{/snippet}
		</TableSelectionToolbar>
		<Table data={users} {columns} idKey="id" plugins={{ selection: selectionPlugin }} />
	</div>
</ScrollableArea>

<style>
	.metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--spacing-3);
		margin-block-end: var(--spacing-6);
	}
	.metric-card {
		padding: var(--spacing-4);
		border-radius: var(--radius-container);
		background-color: var(--color-background-muted);
	}
	.metric-label {
		display: block;
		color: var(--color-text-secondary);
	}
	.metric-value {
		display: block;
		margin-block-start: var(--spacing-1);
		color: var(--color-text-primary);
	}
	.table-region {
		--table-bulk-actions-space: calc(
			var(--size-element-sm) + var(--spacing-2) + var(--spacing-2) + var(--spacing-4)
		);
		position: relative;
		padding-block-start: var(--table-bulk-actions-space);
	}
</style>
