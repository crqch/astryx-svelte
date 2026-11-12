<script lang="ts" module>
	export interface AnnounceBusyThingProps {
		label?: string;
		message?: string;
	}
</script>

<script lang="ts">
	import { useBusyAnnouncement } from '$lib/hooks/use-busy-announcement.svelte.js';

	/**
	 * Upstream's `BusyThing`: a control that announces a busy start once and
	 * re-arms when it settles.
	 */
	const { label = '', message = 'Loading' }: AnnounceBusyThingProps = $props();
	let element = $state<HTMLDivElement>();
	let isBusy = $state(false);
	const settle = useBusyAnnouncement(
		() => isBusy,
		() => message,
		() => element
	);
</script>

<div bind:this={element}>
	<button type="button" onclick={() => (isBusy = true)}>Start{label ? ` ${label}` : ''}</button>
	<button type="button" onclick={() => (isBusy = false)}>Stop{label ? ` ${label}` : ''}</button>
	<button type="button" onclick={() => settle()}>Settle{label ? ` ${label}` : ''}</button>
</div>
