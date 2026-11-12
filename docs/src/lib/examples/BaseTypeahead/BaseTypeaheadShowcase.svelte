<!--
	Ported from upstream's `templates/blocks/components/BaseTypeahead/BaseTypeaheadShowcase.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Two translations. Upstream passes `anchorRef` (a `RefObject`) where this port
	takes `anchorEl` — the element itself, the shape `Popover` settled. And the
	field's focus ring is `:has(input:focus-visible)` on the wrapper, which an
	inline style cannot express, so it is the scoped rule below — wrapped in
	`:global()` because the input belongs to `BaseTypeahead`, and Svelte would
	otherwise compile the rule away as unused.
-->
<script lang="ts">
	import { BaseTypeahead, Text, VStack, createStaticSource } from '@astryx-svelte/core';
	import type { SearchableItem } from '@astryx-svelte/core';

	const frameworks: SearchableItem<{ category: string }>[] = [
		{ id: 'react', label: 'React', auxiliaryData: { category: 'UI library' } },
		{ id: 'remix', label: 'Remix', auxiliaryData: { category: 'Web framework' } },
		{ id: 'next', label: 'Next.js', auxiliaryData: { category: 'Web framework' } }
	];

	const source = createStaticSource(frameworks);

	let value = $state<SearchableItem<{ category: string }> | null>(null);
	let wrapperEl = $state<HTMLElement | null>(null);
</script>

<VStack gap={3} style="width: 100%; max-width: 360px">
	<div bind:this={wrapperEl} class="field">
		<BaseTypeahead
			aria-label="Search frameworks"
			searchSource={source}
			{value}
			onChange={(item) => (value = item)}
			anchorEl={wrapperEl}
			placeholder="Search frameworks…"
			hasEntriesOnFocus
			debounceMs={0}
		>
			{#snippet renderItem(item)}
				<VStack gap={0} style="min-width: 0">
					<Text type="label">{item.label}</Text>
					<Text type="supporting" color="secondary">
						{item.auxiliaryData?.category}
					</Text>
				</VStack>
			{/snippet}
		</BaseTypeahead>
	</div>
</VStack>

<style>
	.field {
		background-color: var(--color-background-surface);
		border-color: var(--color-border);
		border-radius: var(--radius-element);
		border-style: solid;
		border-width: var(--border-width);
		padding-block: var(--spacing-1-5);
		padding-inline: var(--spacing-2);
		outline-color: transparent;
		outline-offset: var(--focus-outline-offset);
		outline-style: solid;
		outline-width: 0;
	}

	.field:global(:has(input:focus-visible)) {
		outline-color: var(--focus-outline-color);
		outline-width: var(--focus-outline-width);
	}
</style>
