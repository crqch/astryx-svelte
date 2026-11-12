<script lang="ts" module>
	import type { AnnouncePoliteness } from '$lib/hooks/use-announce.js';

	export interface AnnounceReplaceTypistProps {
		messages: ReadonlyArray<readonly [string, AnnouncePoliteness]>;
	}
</script>

<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';

	/** Upstream's `Typist`: writes every message through one `hasReplace` instance. */
	const { messages }: AnnounceReplaceTypistProps = $props();
	const announce = useAnnounce({ hasReplace: true });
</script>

<button
	type="button"
	onclick={() => {
		for (const [message, politeness] of messages) {
			announce(message, politeness);
		}
	}}>Type</button
>
