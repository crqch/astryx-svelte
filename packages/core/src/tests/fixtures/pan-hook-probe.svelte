<script lang="ts">
	import type { PanGestureEvent } from '$lib/gestures/create-pan-gesture.js';
	import { usePanGesture } from '$lib/gestures/use-pan-gesture.svelte.js';

	let {
		axis,
		onPan,
		which = 'a' as 'a' | 'b'
	}: {
		axis?: 'x' | 'y';
		onPan: (event: PanGestureEvent) => void;
		which?: 'a' | 'b';
	} = $props();

	let first = $state<HTMLDivElement | null>(null);
	let second = $state<HTMLDivElement | null>(null);

	usePanGesture(() => (which === 'a' ? first : second), {
		get axis() {
			return axis;
		},
		get onPan() {
			return onPan;
		}
	});
</script>

<button type="button" onclick={() => (which = which === 'a' ? 'b' : 'a')}>swap</button>
{#if which === 'a'}
	<div bind:this={first} data-testid="a"></div>
{:else}
	<div bind:this={second} data-testid="b"></div>
{/if}
