<script lang="ts" module>
	import type {
		ScrollAxis,
		ScrollOverscroll,
		ScrollStickyContainment
	} from '$lib/hooks/use-scrollable-area.svelte.js';

	export interface ScrollableAreaProbeProps {
		axis?: ScrollAxis;
		chaining?: ScrollOverscroll;
		keyboardOwner?: 'viewport' | 'contentOrViewport';
		stickyContainment?: ScrollStickyContainment;
	}
</script>

<script lang="ts">
	import { useScrollableArea } from '$lib/hooks/use-scrollable-area.svelte.js';

	let {
		axis = 'inline',
		chaining = 'allow',
		keyboardOwner = 'viewport',
		stickyContainment
	}: ScrollableAreaProbeProps = $props();

	const hook = useScrollableArea(() => ({
		axis,
		keyboardAccess: {
			owner: keyboardOwner,
			label: 'Scrollable results',
			role: 'region'
		},
		overscroll: chaining,
		stickyContainment
	}));

	export const getState = () => hook.state;
</script>

<div data-testid="viewport" {...hook.getViewportProps({ style: 'background-color: red' })}>
	<div data-testid="content" {...hook.getContentProps()}>
		<span data-testid="descendant">Content</span>
	</div>
</div>
<output data-testid="state">{JSON.stringify(hook.state)}</output>
