<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';

	/** Upstream's `TwoMessageOwner`: join two messages, one message, withdraw. */
	const announce = useAnnounce();
</script>

<button
	type="button"
	onclick={() => {
		announce('Added Design');
		announce('Removed Eng');
	}}>Both</button
>
<button type="button" onclick={() => announce('Loading')}>Busy</button>
<button type="button" onclick={() => announce('')}>Withdraw</button>
