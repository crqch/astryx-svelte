<script lang="ts">
	import DropdownMenu from '$lib/components/dropdown-menu/dropdown-menu.svelte';
	import type { DropdownMenuPresentation } from '$lib/components/dropdown-menu/dropdown-menu.svelte';
	import type { DropdownMenuOption } from '$lib/components/dropdown-menu/dropdown-menu-types.js';

	/**
	 * `DropdownMenu` under a `direction: rtl` ancestor — upstream's
	 * `<div style={{direction: 'rtl'}}>` wrapper. The `self-*` position-area
	 * keywords resolve against the popover's own inherited direction, so this
	 * exists to prove RTL emits the *same* logical mapping as LTR, and that the
	 * sheet's drill-in chevrons mirror.
	 */
	const {
		items = [{ label: 'Item 1' }],
		presentation
	}: { items?: DropdownMenuOption[]; presentation?: DropdownMenuPresentation } = $props();
</script>

<div style="direction: rtl">
	<DropdownMenu button={{ label: 'Actions' }} {items} {presentation} />
</div>
