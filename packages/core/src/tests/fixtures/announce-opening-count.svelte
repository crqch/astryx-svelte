<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';

	/**
	 * Upstream's `OpeningCount`: a `hasReplace` instance that announces twice in
	 * the commit that presents its Dialog, before the Dialog's own effect has
	 * called `showModal()`.
	 */
	const announce = useAnnounce({ hasReplace: true });
	$effect(() => {
		announce('1 result');
		announce('2 results');
	});
</script>

<span>Results</span>
