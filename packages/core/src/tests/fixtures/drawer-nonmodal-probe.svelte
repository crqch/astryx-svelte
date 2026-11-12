<script lang="ts" module>
	export interface DrawerNonModalProbeProps {
		show?: boolean;
	}
</script>

<script lang="ts">
	import Drawer from '$lib/components/drawer/drawer.svelte';

	let { show = false }: DrawerNonModalProbeProps = $props();
</script>

<button type="button" data-testid="open-row">Open row</button>
<button type="button" data-testid="latest-row">Latest row</button>

<Drawer
	isOpen={show}
	onOpenChange={() => {}}
	label="Details"
	hasScrim={false}
	data-testid="drawer"
	style="transition-duration: 0.01s"
>
	Content
</Drawer>
