<script lang="ts" module>
	export type { WheelOption, WheelProps, WheelHandle } from './wheel-options.js';
</script>

<script lang="ts">
	import { useMediaQuery } from '../../hooks/use-media-query.svelte.js';
	import { TOUCH_QUERY } from '../../utils/touch-queries.js';
	import type { WheelProps } from './wheel-options.js';
	import PickerWheel from './picker-wheel.svelte';
	import ScrollWheel from './scroll-wheel.svelte';

	/**
	 * Ported from Astryx's `DateInput/Wheel.tsx`: one picker column, presented
	 * by the primary pointer. Under a finger it is `PickerWheel`, the touch
	 * layer; under a fine pointer it is the snap-scrolling column.
	 *
	 * Internal to `DateInput`; not exported from the barrel, exactly as upstream
	 * keeps it out of `DateInput/index.ts`.
	 */
	let props: WheelProps = $props();

	const isTouch = useMediaQuery(() => TOUCH_QUERY);

	let picker = $state<PickerWheel | null>(null);
	let scroller = $state<ScrollWheel | null>(null);

	/** Turn the wheel onto `index`: the active column's `spinTo`. */
	export function spinTo(index: number): Promise<boolean> {
		return (
			(isTouch.matches ? picker?.spinTo(index) : scroller?.spinTo(index)) ?? Promise.resolve(false)
		);
	}
</script>

{#if isTouch.matches}
	<PickerWheel bind:this={picker} {...props} />
{:else}
	<ScrollWheel bind:this={scroller} {...props} />
{/if}
