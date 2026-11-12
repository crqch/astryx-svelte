<script lang="ts">
	import {
		useResizable,
		type ResizableRegion,
		type UseResizableMultiConfig
	} from '$lib/components/resizable/use-resizable.svelte.js';
	import { untrack } from 'svelte';

	/** `renderHook`'s counterpart for the multi-region form. */
	interface Props {
		config: UseResizableMultiConfig;
		version?: number;
		containerRef?: { readonly current: HTMLElement | null };
		onRegions?: (regions: Record<string, ResizableRegion>) => void;
	}

	let { config, version = 0, containerRef, onRegions }: Props = $props();

	const regions = useResizable(() => {
		void version;
		return {
			...config,
			containerRef: containerRef ?? config.containerRef
		};
	});
	untrack(() => onRegions?.(regions));

	export function current(): Record<string, ResizableRegion> {
		return regions;
	}
</script>

{#each Object.entries(regions) as [key, region] (key)}
	<output data-size={key}>{region.size}</output>
{/each}
