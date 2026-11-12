<!--
	Ported from upstream's `templates/blocks/components/Hooks/useOverflowHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Two translations, both this port's standing shapes:
	- `useOverflow` takes its item count and options as getters, and its two refs
	  are `attachContainer` / `attachMeasure` attachments.
	- Upstream's local `stylex.create` has no counterpart in a `.svelte` file, so
	  its declarations are inline `style` strings with the same values. `MoreMenu`
	  is a snippet rather than a component: it holds no state and calls no hook.

	The card is intentionally resizable — drag its inline-end edge to watch items
	collapse into the More menu and return.
-->
<script lang="ts">
	import { Button, Card, DropdownMenu, useOverflow } from '@astryx-svelte/core';

	const actions = [
		'Bold',
		'Italic',
		'Underline',
		'Strikethrough',
		'Link',
		'Quote',
		'Code',
		'Clear formatting'
	];

	const GAP = 4;

	const overflow = useOverflow(
		() => actions.length,
		() => ({ gap: GAP })
	);

	const boxStyle =
		'resize: horizontal; overflow: hidden; width: 480px; min-width: 120px; max-width: 100%';
	const rowStyle = `display: flex; gap: ${GAP}px`;
	// Takes no space and paints nothing, so the hook measures every item
	// without a flicker. Do not use display: none, which stops measurement.
	const measureStyle =
		'position: absolute; visibility: hidden; height: 0; overflow: hidden; white-space: nowrap; pointer-events: none';
</script>

{#snippet moreMenu(items: string[])}
	<DropdownMenu
		button={{ label: 'More', variant: 'ghost', size: 'sm' }}
		items={items.map((label) => ({ label }))}
	/>
{/snippet}

<Card padding={2} style={boxStyle}>
	<div
		{@attach overflow.attachMeasure}
		aria-hidden="true"
		inert
		style={`${rowStyle}; ${measureStyle}`}
	>
		{#each actions as label (label)}
			<Button {label} variant="ghost" size="sm" />
		{/each}
		<div data-overflow-indicator>
			{@render moreMenu(actions)}
		</div>
	</div>
	<div
		{@attach overflow.attachContainer}
		role="group"
		aria-label="Text formatting"
		style={rowStyle}
	>
		{#each actions.slice(0, overflow.visibleCount) as label (label)}
			<Button {label} variant="ghost" size="sm" />
		{/each}
		{#if overflow.hasOverflow}
			{@render moreMenu(actions.slice(overflow.visibleCount))}
		{/if}
	</div>
</Card>
