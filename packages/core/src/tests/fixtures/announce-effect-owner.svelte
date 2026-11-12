<script lang="ts" module>
	export interface AnnounceEffectOwnerProps {
		message: string;
	}
</script>

<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';

	/** Upstream's `Announcer`: announces its message from a mount effect. */
	const { message }: AnnounceEffectOwnerProps = $props();
	const announce = useAnnounce();
	$effect(() => {
		announce(message);
	});
</script>
