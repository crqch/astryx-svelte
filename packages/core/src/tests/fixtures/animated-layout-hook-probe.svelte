<script lang="ts">
	import { useAnimatedLayout } from '$lib/hooks/use-animated-layout.svelte.js';

	let container = $state<HTMLElement | null>(null);
	const layout = useAnimatedLayout({ container: () => container });

	export const getLayout = () => layout;
</script>

<div bind:this={container}></div>
