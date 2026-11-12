<script lang="ts">
	import AvatarStatusDot from '$lib/components/avatar/avatar-status-dot.svelte';

	/**
	 * A dot whose label is state inside the consumer's own wrapper, so changing
	 * it needs no prop change on the Avatar around it. `setPresence` is the
	 * probe handle the test drives, standing in for the setter React's case
	 * captures in a closure.
	 */
	let presence = $state('Online');

	export function setPresence(next: string): void {
		presence = next;
	}
</script>

<AvatarStatusDot label={presence} />
