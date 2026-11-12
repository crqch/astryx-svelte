<script lang="ts">
	import type { Snippet } from 'svelte';
	import BottomSheet from '$lib/components/bottom-sheet/bottom-sheet.svelte';
	import { setBottomSheetEscape } from '$lib/components/bottom-sheet/bottom-sheet-escape.js';

	/**
	 * Upstream's `BottomSheetEscapeContext value={false}` wrapper: a sheet that
	 * always light-dismisses (scrim tap, swipe) while Escape and the native
	 * close request stay off. Svelte has no provider component, so the context
	 * is set by the fixture that owns the subtree.
	 */
	let {
		isOpen,
		onOpenChange,
		children
	}: {
		isOpen: boolean;
		onOpenChange: (isOpen: boolean) => void;
		children: Snippet;
	} = $props();

	setBottomSheetEscape(() => false);
</script>

<BottomSheet {isOpen} {onOpenChange} label="Filters">
	{@render children()}
</BottomSheet>
