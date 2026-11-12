<script lang="ts">
	import ScrollableArea from '$lib/components/scrollable-area/scrollable-area.svelte';

	let viewport: HTMLDivElement | null = $state(null);

	export const getViewport = () => viewport;
</script>

<ScrollableArea label="Messages" bind:ref={viewport} data-testid="viewport">
	<p style="block-size: 200px">Message history</p>
</ScrollableArea>
