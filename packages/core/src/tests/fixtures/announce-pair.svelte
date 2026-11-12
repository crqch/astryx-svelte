<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';

	/** Upstream's `Pair`: announce a message and take it back in one commit. */
	const announce = useAnnounce();
</script>

<button
	type="button"
	onclick={() => {
		announce('3 results');
		announce('');
	}}>Pair</button
>
