<script lang="ts" module>
	export interface DrawerDirectionProbeProps {
		side?: 'start' | 'end';
		dir?: 'ltr' | 'rtl';
		pageDir?: 'ltr' | 'rtl';
	}
</script>

<script lang="ts">
	import Drawer from '$lib/components/drawer/drawer.svelte';

	let { side = 'end', dir, pageDir = 'ltr' }: DrawerDirectionProbeProps = $props();

	let isOpen = $state(true);
	export const setOpen = (value: boolean) => {
		isOpen = value;
	};
</script>

<div dir={pageDir}>
	<Drawer
		{side}
		{dir}
		{isOpen}
		onOpenChange={() => {}}
		label="Details"
		style="transition-duration: 0s">Content</Drawer
	>
</div>
