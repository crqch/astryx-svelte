<script lang="ts" module>
	export interface DrawerRadiosProbeProps {
		radios?: 'start' | 'end';
	}
</script>

<script lang="ts">
	import Drawer from '$lib/components/drawer/drawer.svelte';

	let { radios = 'end' }: DrawerRadiosProbeProps = $props();
</script>

<Drawer isOpen onOpenChange={() => {}} label="Details" style="transition-duration: 0.01s">
	{#if radios === 'start'}
		<fieldset>
			<legend>Size</legend>
			<input type="radio" name="size" value="s" aria-label="Small" />
			<input type="radio" name="size" value="m" aria-label="Medium" checked />
			<input type="radio" name="size" value="l" aria-label="Large" />
		</fieldset>
		<button type="button" data-testid="last">Last</button>
	{:else}
		<button type="button" data-testid="first">First</button>
		<fieldset>
			<legend>Size</legend>
			<input type="radio" name="size" value="s" aria-label="Small" />
			<input type="radio" name="size" value="m" aria-label="Medium" checked />
			<input type="radio" name="size" value="l" aria-label="Large" />
		</fieldset>
	{/if}
</Drawer>
