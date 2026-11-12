<script lang="ts">
	import { useFingerScroll } from '$lib/gestures/use-finger-scroll.svelte.js';

	let {
		getScroller,
		onEnd
	}: {
		getScroller: () => Element | Document | null;
		onEnd?: () => void;
	} = $props();

	useFingerScroll(getScroller, {
		get onEnd() {
			return onEnd;
		}
	});
</script>
