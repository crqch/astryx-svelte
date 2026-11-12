<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';
	import { useBusyAnnouncement } from '$lib/hooks/use-busy-announcement.svelte.js';

	/** Upstream's `Search`: busy start overtaken by its own outcome. */
	let element = $state<HTMLDivElement>();
	let isBusy = $state(false);
	const announce = useAnnounce();
	const settle = useBusyAnnouncement(
		() => isBusy,
		() => 'Loading',
		() => element
	);
</script>

<div bind:this={element}>
	<button type="button" onclick={() => (isBusy = true)}>Start</button>
	<button
		type="button"
		onclick={() => {
			settle();
			isBusy = false;
			announce('3 results');
		}}>Outcome</button
	>
</div>
