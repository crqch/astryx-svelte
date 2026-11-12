<script lang="ts">
	import { usePager } from '../../lib/hooks/use-pager.svelte.js';

	let { count, onPagesChange }: { count: number; onPagesChange: (pageCount: number) => void } =
		$props();

	let viewportEl = $state<HTMLDivElement | null>(null);
	let trackEl = $state<HTMLDivElement | null>(null);

	usePager(() => ({
		viewportRef: () => viewportEl,
		trackRef: () => trackEl,
		count,
		pages: 'children',
		onPagesChange
	}));
</script>

<!--
	The width the test's mocked rects claim, so Chromium's computed width agrees
	with them: the pager divides rects by the track's used width to undo a CSS
	zoom. jsdom reports no computed width, so upstream's fixture needs none.
-->
<div bind:this={viewportEl}>
	<div bind:this={trackEl} data-track="" style:width="{count * 160 - 10}px" style:height="100px">
		{#each Array.from({ length: count }, (_, i) => i) as i (i)}
			<div data-child=""></div>
		{/each}
	</div>
</div>
