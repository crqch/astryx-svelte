<script lang="ts" module>
	import type { SnapPaging } from '$lib/components/snap-paging/snap-paging-value.js';

	export interface SnapPagingCarouselProbeProps {
		hasSnap?: boolean | SnapPaging;
		count?: number;
	}
</script>

<script lang="ts">
	import Carousel from '$lib/components/carousel/carousel.svelte';

	let { hasSnap = false, count = 2 }: SnapPagingCarouselProbeProps = $props();

	let carousel: {
		scrollNext(): void;
		scrollPrev(): void;
		scrollTo(index: number): void;
	} | null = null;

	const items = $derived(Array.from({ length: count }, (_, index) => index));

	export const getCarousel = () => carousel;
</script>

{#snippet carouselItem(value: number)}
	<div>Item {value + 1}</div>
{/snippet}

<Carousel bind:this={carousel} aria-label="Items" {hasSnap} {items} item={carouselItem} />
