<script lang="ts">
	import { percent, pixel, useResizable } from '$lib/components/resizable/use-resizable.svelte.js';

	/**
	 * The SSR and hydration counterpart of upstream's structured-default
	 * cases. The container is a real element whose `bind:this` is null during
	 * the server render, so a percentage default uses the deterministic 1200px
	 * basis there; hydration fills it and the region resolves against the
	 * measured content box.
	 */
	interface Props {
		autoSaveId?: string;
	}

	let { autoSaveId = 'structured-hydration' }: Props = $props();
	let container: HTMLDivElement | undefined = $state();
	let sizeChanges = $state(0);
	const containerRef = {
		get current() {
			return container ?? null;
		}
	};
	const region = useResizable(() => ({
		defaultSize: percent(40, { min: pixel(333) }),
		containerRef,
		autoSaveId,
		onSizeChange: () => {
			sizeChanges += 1;
		}
	}));
</script>

<div bind:this={container} data-container style="width:500px">
	<output data-size={region.size} data-size-changes={sizeChanges}>{region.size}</output>
</div>
