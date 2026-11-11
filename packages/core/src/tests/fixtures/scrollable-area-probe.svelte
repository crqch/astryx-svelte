<script lang="ts" module>
	import type { Snippet } from 'svelte';
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
		style?: string;
		contentStyle?: string;
		contentClass?: string;
		contentXstyle?: import('$lib/internal/sx.js').StyleArg;
		children?: Snippet;
	}
</script>

<script lang="ts">
	import { useScrollableArea } from '$lib/hooks/use-scrollable-area.svelte.js';

	let {
		axis = 'inline',
		chaining = 'allow',
		keyboardOwner = 'viewport',
		stickyContainment,
		style = 'background-color: red',
		contentStyle,
		contentClass,
		contentXstyle,
		children
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

<div data-testid="viewport" {...hook.getViewportProps({ style })}>
	<div
		data-testid="content"
		{...hook.getContentProps({ style: contentStyle, class: contentClass, xstyle: contentXstyle })}
	>
		{#if children}
			{@render children()}
		{:else}
			<span data-testid="descendant">Content</span>
		{/if}
	</div>
</div>
<output data-testid="state">{JSON.stringify(hook.state)}</output>
