<script lang="ts" module>
	import type { DrawerProps } from '$lib/components/drawer/drawer.svelte';

	export interface DrawerProbeProps {
		initialOpen?: boolean;
		side?: DrawerProps['side'];
		hasScrim?: boolean;
		purpose?: DrawerProps['purpose'];
		label?: string;
		width?: DrawerProps['width'];
		padding?: DrawerProps['padding'];
		withHeader?: boolean;
	}
</script>

<script lang="ts">
	import Drawer from '$lib/components/drawer/drawer.svelte';
	import DrawerHeader from '$lib/components/drawer/drawer-header.svelte';

	let {
		initialOpen = true,
		side = 'end',
		hasScrim = true,
		purpose = 'info',
		label = 'Details',
		width = 400,
		padding,
		withHeader = true
	}: DrawerProbeProps = $props();

	let isOpen = $state(initialOpen);

	export const setOpen = (value: boolean) => {
		isOpen = value;
	};
	export const getOpen = () => isOpen;
</script>

<button data-testid="trigger" onclick={() => (isOpen = true)}>Open drawer</button>

<Drawer
	{isOpen}
	{side}
	{hasScrim}
	{purpose}
	{label}
	{width}
	{padding}
	onOpenChange={(open) => (isOpen = open)}
	data-testid="drawer"
	style="transition-duration: 0.01s"
>
	{#if withHeader}
		<DrawerHeader title="Details" onOpenChange={(open) => (isOpen = open)} />
	{/if}
	<div data-testid="drawer-content">Drawer content</div>
</Drawer>
