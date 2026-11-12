<script lang="ts">
	import { useFingerScroll } from '$lib/gestures/use-finger-scroll.svelte.js';
	import FingerScrollWatcher from './finger-scroll-watcher.svelte';

	let {
		kind = 'list' as 'list' | 'section' | 'page',
		watchers = 1,
		external = null,
		onEnd
	}: {
		kind?: 'list' | 'section' | 'page';
		watchers?: number;
		external?: Element | null;
		onEnd?: () => void;
	} = $props();

	let element = $state<HTMLElement | null>(null);
	const getScroller = () => (kind === 'page' ? document : (external ?? element));
	const read = useFingerScroll(getScroller, {
		get onEnd() {
			return onEnd;
		}
	});

	export const getRead = () => read;
	export const getElement = () => element;
</script>

{#if kind === 'section'}
	<section bind:this={element} data-testid="list">
		<p data-testid="row">row</p>
	</section>
{:else if kind === 'list'}
	<div bind:this={element} data-testid="list">
		<p data-testid="row">row</p>
	</div>
{:else}
	<p data-testid="row">row</p>
{/if}

{#if watchers > 1}
	<FingerScrollWatcher {getScroller} {onEnd} />
{/if}
