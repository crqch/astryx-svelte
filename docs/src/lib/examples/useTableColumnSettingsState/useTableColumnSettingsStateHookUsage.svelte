<!--
	Ported from upstream's
	`templates/blocks/components/Table/useTableColumnSettingsStateHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Both hooks take a getter here, and `useTableColumnSettingsState`'s result is
	held rather than destructured because its members are live getters. The
	Popover's `content` prop is a `{#snippet}`, as upstream's JSX element prop is
	here, and its Button trigger stays as ordinary popover children.
-->
<script lang="ts">
	import {
		Button,
		CheckboxInput,
		HStack,
		Popover,
		Table,
		VStack,
		useTableColumnSettings,
		useTableColumnSettingsState,
		type TableColumn
	} from '@astryx-svelte/core';

	interface Member extends Record<string, unknown> {
		id: string;
		name: string;
		email: string;
		role: string;
	}

	const members: Member[] = [
		{ id: '1', name: 'Alice', email: 'alice@example.com', role: 'Engineer' },
		{ id: '2', name: 'Bob', email: 'bob@example.com', role: 'Designer' },
		{ id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'Manager' }
	];

	const allColumns: TableColumn<Member>[] = [
		{ key: 'name', header: 'Name' },
		{ key: 'email', header: 'Email' },
		{ key: 'role', header: 'Role' }
	];

	const columnOptions = [
		{ key: 'name' as const, label: 'Name', isAlwaysVisible: true },
		{ key: 'email' as const, label: 'Email' },
		{ key: 'role' as const, label: 'Role' }
	];

	const defaultKeys = ['name', 'email', 'role'];

	let activeKeys = $state<ReadonlyArray<string>>(defaultKeys);

	const columnState = useTableColumnSettingsState(() => ({
		columns: columnOptions,
		activeColumnKeys: activeKeys,
		onChangeActiveColumnKeys: (keys) => (activeKeys = [...keys]),
		defaultColumnKeys: defaultKeys
	}));

	const plugin = useTableColumnSettings<Member>(() => columnState.columnSettingsConfig);
</script>

<VStack gap={3}>
	<HStack hAlign="start">
		<Popover placement="below" label="Column settings" width={200}>
			{#snippet content()}
				<VStack gap={2}>
					{#each columnOptions as col (col.key)}
						<CheckboxInput
							label={col.label}
							value={columnState.isColumnActive(col.key)}
							isDisabled={!columnState.isColumnToggleable(col.key)}
							onChange={() => columnState.toggleColumn(col.key)}
						/>
					{/each}
					<Button label="Reset" size="sm" variant="secondary" onclick={columnState.resetToDefault}>
						Reset
					</Button>
				</VStack>
			{/snippet}
			<Button label="Columns" size="sm">Columns</Button>
		</Popover>
	</HStack>
	<Table data={members} columns={allColumns} idKey="id" plugins={{ columnSettings: plugin }} />
</VStack>
