<script lang="ts" module>
	export interface ScrollableAreaDetachProbeProps {
		isAttached?: boolean;
	}
</script>

<script lang="ts">
	import { useScrollableArea } from '$lib/hooks/use-scrollable-area.svelte.js';

	let { isAttached = true }: ScrollableAreaDetachProbeProps = $props();

	const area = useScrollableArea(() => ({
		axis: 'inline',
		keyboardAccess: { owner: 'viewport', label: 'Detachable results' }
	}));
</script>

{#if isAttached}
	<div data-testid="detachable" {...area.getViewportProps()} />
{/if}
<!-- Outside the viewport, so only its own detach can clear the state. -->
<div {...area.getContentProps()} />
<output data-testid="retained-tab-index"
	>{String((area.getViewportProps() as { tabindex?: number }).tabindex)}</output
>
