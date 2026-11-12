<script lang="ts">
	import BottomSheet from '$lib/components/bottom-sheet/bottom-sheet.svelte';

	/**
	 * Upstream's nested-sheet swipe host: an inner sheet rendered inside the
	 * outer sheet's content, so the inner handle's pointer events bubble through
	 * the outer sheet's body listeners.
	 */
	let {
		onOuterOpenChange = () => {},
		onInnerOpenChange = () => {}
	}: {
		onOuterOpenChange?: (isOpen: boolean) => void;
		onInnerOpenChange?: (isOpen: boolean) => void;
	} = $props();
</script>

<BottomSheet isOpen onOpenChange={onOuterOpenChange} label="Outer">
	Outer content
	<BottomSheet isOpen onOpenChange={onInnerOpenChange} label="Inner">Inner content</BottomSheet>
</BottomSheet>
