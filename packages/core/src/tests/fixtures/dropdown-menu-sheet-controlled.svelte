<script lang="ts">
	import DropdownMenu from '$lib/components/dropdown-menu/dropdown-menu.svelte';
	import type { DropdownMenuOption } from '$lib/components/dropdown-menu/dropdown-menu-types.js';
	import Button from '$lib/components/button/button.svelte';

	/**
	 * Upstream's controlled bottom-sheet harness: an external control closes the
	 * menu while a drilled-in view is showing, so the next open must return to
	 * the root view.
	 */
	const { items }: { items: DropdownMenuOption[] } = $props();

	let isOpen = $state(false);
</script>

<Button label="Close externally" onclick={() => (isOpen = false)} />
<DropdownMenu
	button={{ label: 'Project actions' }}
	presentation="bottom-sheet"
	{items}
	isMenuOpen={isOpen}
	onOpenChange={(open) => (isOpen = open)}
/>
