<!--
	Ported from upstream's
	`templates/blocks/components/Table/useTableSortableStateHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Both hooks take a getter, and the state result is held rather than
	destructured because `sortedData`, `sort` and `sortConfig` are live getters
	on the one object the hook returns. `sort` is read through a derived label.
-->
<script lang="ts">
	import {
		Table,
		Text,
		VStack,
		useTableSortable,
		useTableSortableState,
		type TableColumn
	} from '@astryx-sv/core';

	interface Order extends Record<string, unknown> {
		id: string;
		customer: string;
		total: number;
	}

	const orders: Order[] = [
		{ id: '1042', customer: 'Chen', total: 85 },
		{ id: '1043', customer: 'Ana', total: 120 },
		{ id: '1044', customer: 'Ben', total: 40 },
		{ id: '1045', customer: 'Ana', total: 35 },
		{ id: '1046', customer: 'Chen', total: 15 },
		{ id: '1047', customer: 'Ben', total: 210 },
		{ id: '1048', customer: 'Ana', total: 60 }
	];

	const columns: TableColumn<Order>[] = [
		{ key: 'id', header: 'Order' },
		{ key: 'customer', header: 'Customer', sortable: true },
		{ key: 'total', header: 'Total ($)', sortable: true, align: 'end' }
	];

	const sortState = useTableSortableState<Order>(() => ({
		data: orders,
		isMultiSortEnabled: true
	}));

	const sortablePlugin = useTableSortable<Order>(() => sortState.sortConfig);

	const sortLabel = $derived(
		sortState.sort.length === 0
			? 'none'
			: sortState.sort.map(({ sortKey, direction }) => `${sortKey} ${direction}`).join(', then ')
	);
</script>

<VStack gap={3}>
	<Text type="supporting" color="secondary">Sorted by: {sortLabel}</Text>
	<Table data={sortState.sortedData} {columns} idKey="id" plugins={{ sortable: sortablePlugin }} />
</VStack>
