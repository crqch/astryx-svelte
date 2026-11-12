<script lang="ts">
	import BottomSheet from '$lib/components/bottom-sheet/bottom-sheet.svelte';
	import Popover from '$lib/components/popover/popover.svelte';

	/**
	 * Upstream's nested-sheet Escape case: a popover sheet with Escape off whose
	 * content opens a sheet of its own. The inner sheet must start from Escape
	 * on, because `BottomSheetEscapeContext` is reset for a sheet's content.
	 */
	interface Props {
		onInnerOpenChange?: (isOpen: boolean) => void;
	}

	let { onInnerOpenChange }: Props = $props();
</script>

{#snippet content()}
	<BottomSheet isOpen onOpenChange={(next) => onInnerOpenChange?.(next)} label="Inner sheet">
		Inner
	</BottomSheet>
{/snippet}

<Popover label="Filters" presentation="adaptive" hasEscapeDismiss={false} {content}>
	<button type="button">Filter</button>
</Popover>
