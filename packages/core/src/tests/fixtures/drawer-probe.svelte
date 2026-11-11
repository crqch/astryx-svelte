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
		withAutofocus?: boolean;
		onkeydown?: (event: KeyboardEvent) => void;
		class?: string;
		sideStyle?: string;
		dataExtra?: string;
		ariaDescribedby?: string;
		onclick?: (event: MouseEvent) => void;
		experimental?: DrawerProps['experimental'];
		xstyle?: import('$lib/internal/sx.js').StyleArg;
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
		withHeader = true,
		withAutofocus = false,
		onkeydown,
		class: className,
		sideStyle = 'transition-duration: 0.01s',
		dataExtra,
		ariaDescribedby,
		onclick,
		experimental,
		xstyle
	}: DrawerProbeProps = $props();

	let isOpen = $state(initialOpen);
	let dialogRef = $state<HTMLDialogElement | null>(null);

	export const setOpen = (value: boolean) => {
		isOpen = value;
	};
	export const getOpen = () => isOpen;
	export const getDialog = () => dialogRef;
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
	{experimental}
	{xstyle}
	onOpenChange={(open) => (isOpen = open)}
	data-testid="drawer"
	data-extra={dataExtra}
	aria-describedby={ariaDescribedby}
	class={className}
	style={sideStyle}
	{onclick}
	{onkeydown}
>
	{#if withHeader}
		<DrawerHeader title="Details" onOpenChange={(open) => (isOpen = open)} />
	{/if}
	{#if withAutofocus}
		<button data-autofocus data-testid="autofocus">Autofocus</button>
	{/if}
	<div data-testid="drawer-content">Drawer content</div>
</Drawer>
