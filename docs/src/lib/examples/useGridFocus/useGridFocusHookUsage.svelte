<!--
	Ported from upstream's `templates/blocks/components/Hooks/useGridFocusHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`gridRef` is the hook's `attachGrid` attachment here, and upstream's React
	`onFocus` (which bubbles) is `onfocusin`.
-->
<script lang="ts">
	import { Card, Text, useGridFocus, VStack } from '@astryx-sv/core';

	const COLUMNS = 8;

	const SWATCHES = [
		{ name: 'Red', value: '#e5484d' },
		{ name: 'Tomato', value: '#f76b15' },
		{ name: 'Amber', value: '#ffc53d' },
		{ name: 'Lime', value: '#bdee63' },
		{ name: 'Green', value: '#30a46c' },
		{ name: 'Teal', value: '#12a594' },
		{ name: 'Cyan', value: '#00a2c7' },
		{ name: 'Blue', value: '#0090ff' },
		{ name: 'Indigo', value: '#3e63dd' },
		{ name: 'Violet', value: '#6e56cf' },
		{ name: 'Purple', value: '#8e4ec6' },
		{ name: 'Plum', value: '#ab4aba' },
		{ name: 'Pink', value: '#d6409f' },
		{ name: 'Brown', value: '#ad7f58' },
		{ name: 'Gray', value: '#8d8d8d' },
		{ name: 'Black', value: '#111111' }
	];

	const ROWS = Array.from({ length: SWATCHES.length / COLUMNS }, (_, row) =>
		SWATCHES.slice(row * COLUMNS, (row + 1) * COLUMNS)
	);

	let selected = $state(SWATCHES[0].name);

	const grid = useGridFocus(() => ({
		columns: COLUMNS,
		cellSelector: '[role="gridcell"]',
		getFocusTarget: (cell) => cell.querySelector('button'),
		hasRovingTabIndex: true
	}));
</script>

<Card padding={4}>
	<VStack gap={3}>
		<Text type="body">Selected: {selected}</Text>
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			{@attach grid.attachGrid}
			role="grid"
			aria-label="Colors"
			onkeydown={grid.handleKeyDown}
			onfocusin={grid.handleFocus}
			style="display: flex; flex-direction: column; gap: 4px"
		>
			{#each ROWS as row, index (index)}
				<div role="row" style="display: flex; gap: 4px">
					{#each row as swatch (swatch.name)}
						<div role="gridcell" aria-selected={swatch.name === selected}>
							<button
								type="button"
								aria-label={swatch.name}
								aria-pressed={swatch.name === selected}
								onclick={() => (selected = swatch.name)}
								style="width: 28px; height: 28px; border: none; box-shadow: inset 0 0 0 1px var(--color-border-emphasized); border-radius: 4px; background: {swatch.value}"
							>
							</button>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</VStack>
</Card>
