<!--
	Helper for `DialogAdaptivePresentation.svelte`, transcribed from the
	`AdaptiveDialog` component in upstream's block. A separate file because it
	owns a media-query branch; the block file keeps upstream's single `useState`
	per field.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		BottomSheet,
		Dialog,
		DialogHeader,
		Layout,
		LayoutContent,
		LayoutFooter,
		VStack,
		type DialogPurpose
	} from '@astryx-svelte/core';
	import { useMediaQuery } from '@astryx-svelte/core/hooks';

	type AdaptivePresentation = 'dialog' | 'fullscreen' | 'bottom-sheet';

	const TOUCH_ORIENTED_LG_QUERY = '(max-width: 1024px) and (pointer: coarse) and (hover: none)';

	let {
		isOpen,
		onOpenChange,
		title,
		children,
		footer,
		purpose = 'info',
		width = 480,
		maxHeight = '75dvh',
		touchPresentation = 'dialog',
		presentation,
		bottomSheetHeight = 'capped'
	}: {
		isOpen: boolean;
		onOpenChange: (isOpen: boolean) => void;
		title: string;
		children: Snippet;
		footer?: Snippet;
		purpose?: DialogPurpose;
		width?: number | string;
		maxHeight?: number | string;
		touchPresentation?: AdaptivePresentation;
		presentation?: AdaptivePresentation;
		bottomSheetHeight?: 'hug' | 'capped' | 'tall' | number | string;
	} = $props();

	const isTouchOrientedLargeOrBelow = useMediaQuery(() => TOUCH_ORIENTED_LG_QUERY);
	const resolvedPresentation = $derived(
		presentation ?? (isTouchOrientedLargeOrBelow.matches ? touchPresentation : 'dialog')
	);
</script>

{#snippet dialogHeader()}
	<DialogHeader {title} {onOpenChange} />
{/snippet}

{#snippet dialogContent()}
	<LayoutContent>{@render children()}</LayoutContent>
{/snippet}

{#snippet dialogFooter()}
	<LayoutFooter>{@render footer?.()}</LayoutFooter>
{/snippet}

{#if resolvedPresentation === 'bottom-sheet'}
	<BottomSheet {isOpen} {onOpenChange} label={title} {purpose} height={bottomSheetHeight}>
		<VStack gap={4}>
			{#if title}<h3 class="sheet-title">{title}</h3>{/if}
			{@render children()}
			{@render footer?.()}
		</VStack>
	</BottomSheet>
{:else}
	<Dialog
		{isOpen}
		{onOpenChange}
		{purpose}
		{width}
		{maxHeight}
		variant={resolvedPresentation === 'fullscreen' ? 'fullscreen' : 'standard'}
	>
		<Layout
			header={dialogHeader}
			content={dialogContent}
			footer={footer ? dialogFooter : undefined}
		/>
	</Dialog>
{/if}

<style>
	.sheet-title {
		margin: 0;
		font-size: var(--text-heading-3-size);
		font-weight: var(--text-heading-3-weight);
		line-height: var(--text-heading-3-leading);
	}
</style>
