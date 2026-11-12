<!--
	Ported from upstream's `templates/blocks/components/ComplexSelector/ComplexSelectorShowcase.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { ComplexSelector, Text } from '@astryx-sv/core';
	import { useGridFocus } from '@astryx-sv/core/hooks';

	type Fruit = 'Apple' | 'Pear' | 'Peach' | 'Plum';
	type Ripeness = 'Crisp' | 'Tender' | 'Juicy' | 'Peak';

	interface FruitValue {
		fruit: Fruit;
		ripeness: Ripeness;
	}

	const fruits: Array<{ id: Fruit; emoji: string; description: string }> = [
		{ id: 'Apple', emoji: '🍎', description: 'Bright and balanced' },
		{ id: 'Pear', emoji: '🍐', description: 'Soft floral sweetness' },
		{ id: 'Peach', emoji: '🍑', description: 'Round summer flavor' },
		{ id: 'Plum', emoji: '🟣', description: 'Jammy and tart' }
	];

	const ripenessLevels: Array<{ id: Ripeness; shortLabel: string; description: string }> = [
		{ id: 'Crisp', shortLabel: 'C', description: 'Snappy bite' },
		{ id: 'Tender', shortLabel: 'T', description: 'Easy bite' },
		{ id: 'Juicy', shortLabel: 'J', description: 'Full juice' },
		{ id: 'Peak', shortLabel: 'P', description: 'Most intense' }
	];

	const GRID_CELL_SELECTOR = '[role="gridcell"]';

	let value = $state<FruitValue>({ fruit: 'Apple', ripeness: 'Juicy' });

	const grid = useGridFocus(() => ({
		columns: ripenessLevels.length,
		cellSelector: GRID_CELL_SELECTOR,
		hasRovingTabIndex: true
	}));

	$effect(() => {
		// Read `value` so the effect re-runs when the selection moves; upstream
		// re-seeds the roving tab stop from the selected cell the same way.
		void value.fruit;
		void value.ripeness;
		const rowIndex = fruits.findIndex((fruit) => fruit.id === value.fruit);
		const columnIndex = ripenessLevels.findIndex((level) => level.id === value.ripeness);
		const frame = requestAnimationFrame(() => {
			grid.focusCell(
				rowIndex >= 0 && columnIndex >= 0 ? rowIndex * ripenessLevels.length + columnIndex : 0
			);
		});
		return () => cancelAnimationFrame(frame);
	});
</script>

{#snippet fruitGrid(
	selectedValue: FruitValue,
	onChange: (next: FruitValue) => void,
	close: () => void
)}
	<div
		{@attach grid.attachGrid}
		role="grid"
		tabindex={-1}
		aria-label="Fruit ripeness choices"
		onkeydown={grid.handleKeyDown}
		onfocusin={grid.handleFocus}
		class="grid"
	>
		{#each fruits as fruit (fruit.id)}
			<div role="row" class="row">
				<div role="rowheader" class="row-header">
					<span aria-hidden="true" class="emoji">{fruit.emoji}</span>
					<span class="fruit-text">
						<Text type="body">{fruit.id}</Text>
						<Text type="supporting" color="secondary">{fruit.description}</Text>
					</span>
				</div>
				{#each ripenessLevels as level (level.id)}
					{@const isSelected =
						selectedValue.fruit === fruit.id && selectedValue.ripeness === level.id}
					<button
						type="button"
						role="gridcell"
						aria-label={`${fruit.id}, ${level.id}: ${level.description}`}
						aria-selected={isSelected || undefined}
						tabindex={isSelected ? 0 : -1}
						class="cell"
						class:selected={isSelected}
						onclick={() => {
							onChange({ fruit: fruit.id, ripeness: level.id });
							close();
						}}
					>
						{level.shortLabel}
					</button>
				{/each}
			</div>
		{/each}
	</div>
{/snippet}

<ComplexSelector
	label="Fruit blend"
	description="Choose a fruit and ripeness in one control. Arrow keys move across the grid."
	{value}
	onChange={(next) => (value = next)}
	triggerLabel={`${value.fruit} · ${value.ripeness}`}
	width={280}
	children={fruitGrid}
/>

<style>
	.grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 280px;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(150px, 1fr) repeat(4, 44px);
		align-items: center;
		column-gap: var(--spacing-1);
	}

	.row-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		text-align: start;
		min-width: 0;
	}

	.emoji {
		font-size: 18px;
		flex-shrink: 0;
	}

	.fruit-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.cell {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 36px;
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius-container);
		background-color: var(--color-background-card);
		color: var(--color-text-secondary);
		font-family: inherit;
		cursor: pointer;
	}

	.cell:hover {
		border-color: var(--color-border-emphasized);
		color: var(--color-text-primary);
	}

	.cell.selected {
		border-color: var(--color-accent);
		background-color: var(--color-accent);
		color: var(--color-on-accent);
	}
</style>
