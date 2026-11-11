<script lang="ts" module>
	export interface DrawerStackProbeProps {
		showFirst?: boolean;
		showSecond?: boolean;
	}
</script>

<script lang="ts">
	import Drawer from '$lib/components/drawer/drawer.svelte';

	let { showFirst = true, showSecond = true }: DrawerStackProbeProps = $props();

	let firstOpen = $state(true);
	let secondOpen = $state(true);
	let innerOpen = $state(false);

	export const closeFirst = () => (firstOpen = false);
	export const reopenFirst = () => (firstOpen = true);
	export const closeSecond = () => (secondOpen = false);
	export const openInner = () => (innerOpen = true);
	export const getFirst = () => firstOpen;
	export const getSecond = () => secondOpen;
	export const getInner = () => innerOpen;
</script>

<button type="button" data-testid="close-first" onclick={() => (firstOpen = false)}>
	Close first
</button>
<button type="button" data-testid="reopen-first" onclick={() => (firstOpen = true)}>
	Reopen first
</button>
<button type="button" data-testid="open-terms" onclick={() => (innerOpen = true)}>
	Open terms
</button>

{#if showFirst}
	<Drawer
		isOpen={firstOpen}
		onOpenChange={(open) => (firstOpen = open)}
		label="First"
		hasScrim={false}
	>
		First content
	</Drawer>
{/if}
{#if showSecond}
	<Drawer
		isOpen={secondOpen}
		onOpenChange={(open) => (secondOpen = open)}
		label="Second"
		hasScrim={false}
	>
		Second content
	</Drawer>
{/if}
<Drawer
	isOpen={innerOpen}
	onOpenChange={(open) => (innerOpen = open)}
	label="Accept terms"
	purpose="required"
>
	Terms
</Drawer>
