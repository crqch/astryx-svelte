<script lang="ts">
	import Drawer from '$lib/components/drawer/drawer.svelte';

	let side = $state<'start' | 'end' | null>(null);
</script>

<button type="button" data-testid="open-start" onclick={() => (side = 'start')}>
	Open from start
</button>
<Drawer
	isOpen={side != null}
	onOpenChange={(isOpen) => {
		if (!isOpen) side = null;
	}}
	label="Filters"
	side={side ?? 'end'}
>
	Content
</Drawer>
