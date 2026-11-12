<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';

	/**
	 * Upstream's `CountAndOther`: a `hasReplace` count and a plain announcer
	 * that may say the same words.
	 */
	const count = useAnnounce({ hasReplace: true });
	const other = useAnnounce();
</script>

<button type="button" onclick={() => count('1 result')}>Count</button>
<button type="button" onclick={() => count('2 results')}>Recount</button>
<button
	type="button"
	onclick={() => {
		other('1 result');
		count('1 result');
	}}>Both</button
>
<button
	type="button"
	onclick={() => {
		other('1 result');
		count('2 results');
	}}>Next</button
>
