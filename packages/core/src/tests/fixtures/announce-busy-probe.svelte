<script lang="ts" module>
	export interface AnnounceBusyProbeProps {
		isBusy: boolean;
		message?: string;
	}
</script>

<script lang="ts">
	import { useBusyAnnouncement } from '$lib/hooks/use-busy-announcement.svelte.js';

	/** Upstream's `renderBusy` harness: one busy owner and its settle. */
	const { isBusy, message = 'Loading' }: AnnounceBusyProbeProps = $props();
	let element = $state<HTMLDivElement>();
	const settle = useBusyAnnouncement(
		() => isBusy,
		() => message,
		() => element
	);
	export { settle };
</script>

<div bind:this={element}>thing</div>
