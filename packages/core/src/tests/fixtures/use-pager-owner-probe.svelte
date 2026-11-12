<script lang="ts">
	import type { Pager } from '../../lib/pager.js';
	import PagerProbe from './use-pager-probe.svelte';

	let { onPager }: { onPager: (pager: Pager) => void } = $props();
	let index = $state(2);

	function onIndexChange(next: number): void {
		index = next;
	}
</script>

<PagerProbe {index} {onIndexChange} {onPager} />
