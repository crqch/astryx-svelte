<script lang="ts" module>
	import type { AnnouncePoliteness } from '$lib/hooks/use-announce.js';

	export interface AnnounceOwnerProps {
		message?: string;
		politeness?: AnnouncePoliteness;
		label?: string;
		hasReplace?: boolean;
	}
</script>

<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';

	/** Upstream's `Owner`: one button that announces its message. */
	const {
		message = 'Added Design',
		politeness,
		label = 'Say',
		hasReplace = false
	}: AnnounceOwnerProps = $props();

	// svelte-ignore state_referenced_locally
	const announce = useAnnounce({ hasReplace });
</script>

<button type="button" onclick={() => announce(message, politeness)}>{label}</button>
