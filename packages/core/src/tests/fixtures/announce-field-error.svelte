<script lang="ts" module>
	import type { AnnouncePoliteness } from '$lib/hooks/use-announce.js';

	export interface AnnounceFieldErrorProps {
		message?: string;
		politeness?: AnnouncePoliteness;
		withdraw?: boolean;
	}
</script>

<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';

	/** Upstream's `FieldError`: announces from a mount effect. */
	const {
		message = 'Name is required',
		politeness = 'assertive',
		withdraw = false
	}: AnnounceFieldErrorProps = $props();
	const announce = useAnnounce();
	$effect(() => {
		announce(message, politeness);
		if (withdraw) {
			// Taken back in the same commit, before the Dialog has presented.
			announce('', politeness);
		}
	});
</script>

<span>{message}</span>
