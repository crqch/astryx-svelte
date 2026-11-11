<script lang="ts" module>
	export interface DialogTouchProbeProps {
		isOpen: boolean;
		onact?: () => void;
	}
</script>

<script lang="ts">
	import Dialog from '$lib/components/dialog/dialog.svelte';

	let { isOpen, onact }: DialogTouchProbeProps = $props();
</script>

<button type="button" onclick={() => onact?.()}>Outside</button>
<Dialog {isOpen} onOpenChange={() => {}} aria-label="Held">
	<button type="button" onclick={() => onact?.()}>Act</button>
</Dialog>
