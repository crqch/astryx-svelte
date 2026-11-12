<script lang="ts" module>
	export interface DrawerTouchProbeProps {
		isOpen: boolean;
		hasScrim?: boolean;
		onact?: () => void;
	}
</script>

<script lang="ts">
	import Drawer from '$lib/components/drawer/drawer.svelte';

	let { isOpen, hasScrim = true, onact }: DrawerTouchProbeProps = $props();
</script>

<button type="button" onclick={() => onact?.()}>Outside</button>
<Drawer {isOpen} onOpenChange={() => {}} label="Held" {hasScrim}>
	<button type="button" onclick={() => onact?.()}>Act</button>
</Drawer>
