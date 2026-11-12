<!--
	Ported from upstream's `templates/blocks/components/Item/ItemDocumentTabs.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Upstream's `DocumentTab` helper component becomes the `documentTab` snippet.
	`mergeProps` has no counterpart — Svelte has no props object to merge — so the
	two sources are combined at the attribute they share: the container's reveal
	state arrives as `class` plus inline custom properties, and the tab's sizing
	and the close action's margin/transition are appended to that style string, in
	upstream's merge order (the action's `transition-property: none` wins over the
	reveal's).

	Upstream's `DocumentIcon` and `PlusIcon` are Heroicons; the registry ships
	neither a document nor a plus glyph, so this substitutes built-ins — the same
	gap and the same pairings `ItemShowcase` and `ToolbarWithTabs` record,
	retiring with the icon registry (port/todo.md). `XMarkIcon` is a true match:
	it is the registry's `close`.
-->
<script lang="ts">
	import { Divider, HStack, Icon, IconButton, Item, useContainerReveal } from '@astryx-sv/core';

	const TABS = [
		{ name: 'Project brief', isActive: true },
		{ name: 'Research notes', isActive: false },
		{ name: 'Interaction prototype', isActive: false }
	];
</script>

{#snippet documentTab(name: string, isActive: boolean)}
	{@const reveal = useContainerReveal()}
	{@const containerProps = reveal.getContainerProps()}
	{@const revealProps = reveal.getContentRevealProps({
		forceVisibility: isActive ? 'shown' : undefined,
		isLayoutPreserved: true
	})}
	{@const tabStyle = [containerProps.style, 'flex-shrink: 1', 'width: 164px', 'min-width: 96px']
		.filter(Boolean)
		.join(';')}
	{@const closeStyle = [
		revealProps.style,
		'margin: calc(-1 * var(--spacing-1))',
		'transition-property: none'
	]
		.filter(Boolean)
		.join(';')}
	<Item
		label={name}
		density="compact"
		isSelected={isActive}
		onclick={() => {}}
		aria-current={isActive ? 'true' : undefined}
		class={containerProps.class}
		style={tabStyle}
	>
		{#snippet startContent()}
			<Icon icon="copy" size="sm" color={isActive ? 'primary' : 'secondary'} />
		{/snippet}
		{#snippet endContent()}
			<IconButton
				label={`Close ${name}`}
				variant="ghost"
				size="sm"
				class={revealProps.class}
				style={closeStyle}
			>
				{#snippet icon()}<Icon icon="close" size="sm" />{/snippet}
			</IconButton>
		{/snippet}
	</Item>
{/snippet}

<HStack width="100%" maxWidth={600} gap={0.5} vAlign="center">
	<HStack
		role="group"
		aria-label="Open documents"
		vAlign="center"
		paddingInline={2}
		paddingBlock={1}
		isScrollable
		style="min-width: 0; flex-shrink: 1; scrollbar-width: none"
	>
		{#each TABS as tab, index (tab.name)}
			{#if index > 0}
				<Divider
					orientation="vertical"
					style="height: 16px{TABS[index - 1]?.isActive || tab.isActive
						? '; visibility: hidden'
						: ''}"
				/>
			{/if}
			{@render documentTab(tab.name, tab.isActive)}
		{/each}
	</HStack>
	<IconButton label="New document" tooltip="New document" variant="ghost" size="sm">
		{#snippet icon()}<Icon icon="check" size="sm" color="secondary" />{/snippet}
	</IconButton>
</HStack>
