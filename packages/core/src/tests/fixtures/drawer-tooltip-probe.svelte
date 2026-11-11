<script lang="ts" module>
	export interface DrawerTooltipProbeProps {
		show?: boolean;
	}
</script>

<script lang="ts">
	import Drawer from '$lib/components/drawer/drawer.svelte';
	import Tooltip from '$lib/components/tooltip/tooltip.svelte';

	let { show = false }: DrawerTooltipProbeProps = $props();
</script>

<Drawer isOpen={show} onOpenChange={() => {}} label="Filters" hasScrim={false}>
	<Tooltip content="Close the filters">
		<button type="button">Close</button>
	</Tooltip>
</Drawer>
