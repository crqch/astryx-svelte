<script lang="ts" module>
	export interface ScrollableAreaNestedProbeProps {
		innerAxis?: 'inline' | 'block';
	}
</script>

<script lang="ts">
	import { useScrollableArea } from '$lib/hooks/use-scrollable-area.svelte.js';

	let { innerAxis = 'inline' }: ScrollableAreaNestedProbeProps = $props();

	const outer = useScrollableArea(() => ({
		axis: 'block',
		keyboardAccess: { owner: 'viewport', label: 'Outer results' }
	}));
	const inner = useScrollableArea(() => ({
		axis: innerAxis,
		keyboardAccess: { owner: 'viewport', label: 'Inner results' }
	}));
</script>

<div data-testid="outer-viewport" {...outer.getViewportProps()}>
	<div data-testid="outer-content" {...outer.getContentProps()}>
		<div data-testid="inner-viewport" {...inner.getViewportProps()}>
			<div data-testid="inner-content" {...inner.getContentProps()}>
				<span data-testid="leaf">Content</span>
			</div>
		</div>
	</div>
</div>
