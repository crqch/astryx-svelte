<script lang="ts">
	import {
		useResizable,
		type ResizableRegion,
		type UseResizableSingleConfig
	} from '$lib/components/resizable/use-resizable.svelte.js';
	import { untrack } from 'svelte';

	/**
	 * `renderHook`'s counterpart for `useResizable`: the hook runs during this
	 * component's init, and `render(...).component.region()` is `result.current`.
	 * `version` is read inside the config getter so a test can make the parent
	 * update reach the hook when nothing else in the config changed, the way a
	 * React rerender would.
	 */
	interface Props {
		config: UseResizableSingleConfig;
		version?: number;
		containerRef?: { readonly current: HTMLElement | null };
		collapseOnUpdate?: boolean;
		onRegion?: (region: ResizableRegion) => void;
	}

	let { config, version = 0, containerRef, collapseOnUpdate = false, onRegion }: Props = $props();

	const region = useResizable(() => {
		void version;
		return {
			...config,
			containerRef: containerRef ?? config.containerRef
		};
	});
	untrack(() => onRegion?.(region));

	// Upstream's "consumer layout effect calls collapse()" case: the effect
	// runs after the controlled prop reached this component.
	$effect(() => {
		if (collapseOnUpdate) {
			region.collapse();
		}
	});

	export function current(): ResizableRegion {
		return region;
	}
</script>

<output data-testid="size">{region.size}</output>
<output data-testid="collapsed">{String(region.isCollapsed)}</output>
