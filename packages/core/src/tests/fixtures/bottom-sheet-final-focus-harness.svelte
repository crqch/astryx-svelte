<script lang="ts">
	import BottomSheet from '$lib/components/bottom-sheet/bottom-sheet.svelte';

	/**
	 * Upstream's explicit-final-focus harnesses: a page control that closes the
	 * sheet, a page control the sheet returns focus to, and an opener inside the
	 * sheet. `finalFocusRef` is a getter here — the port's `RefObject`
	 * translation — so the element is read when the exit completes.
	 */
	interface Props {
		hasScrim?: boolean;
	}

	let { hasScrim = true }: Props = $props();

	let isOpen = $state(false);
	let targetEl = $state<HTMLButtonElement | null>(null);
</script>

<button type="button" onclick={() => (isOpen = true)}>Open sheet</button>
<button bind:this={targetEl} type="button">Adaptive trigger</button>
<button type="button" onclick={() => (isOpen = false)}>Close from page</button>

<BottomSheet
	{isOpen}
	onOpenChange={(next) => (isOpen = next)}
	label="Filters"
	{hasScrim}
	finalFocusRef={() => targetEl}
>
	<button type="button" onclick={() => (isOpen = false)}>Done</button>
</BottomSheet>
