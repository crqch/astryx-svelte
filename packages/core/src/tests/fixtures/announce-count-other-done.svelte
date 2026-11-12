<script lang="ts">
	import AnnounceCountOther from './announce-count-other.svelte';

	/** Upstream's `CountAndOther` with a Done button, inside a caller's host. */
	const { onDone }: { onDone?: () => void } = $props();
</script>

<AnnounceCountOther />
<button type="button" onclick={() => onDone?.()}>Done</button>
