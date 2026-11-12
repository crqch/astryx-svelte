<script lang="ts">
	import { useLayerDismissal } from '$lib/components/layer/use-layer-dismissal.svelte.js';
	import LayerDepthProvider from '$lib/components/layer/layer-depth-provider.svelte';
	import Picker from './combobox-field-fixture.svelte';

	/**
	 * Upstream's `Layer`: a registered layer, like a Dialog or Popover, around the
	 * field. Its dismissal listens for Escape through the shared stack, so the
	 * case can prove the combobox hides its list first on the same press.
	 */
	interface Props {
		onDismiss: () => void;
	}

	const { onDismiss }: Props = $props();

	useLayerDismissal(() => ({
		isActive: true,
		onDismiss,
		getContainer: () => container ?? null
	}));

	let container: HTMLDivElement | undefined = $state();
</script>

<div bind:this={container}>
	<LayerDepthProvider>
		<Picker />
	</LayerDepthProvider>
</div>
