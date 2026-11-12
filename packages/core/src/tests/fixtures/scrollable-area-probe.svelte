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
		stopFocusEvents?: boolean;
		probeKey?: number;
		initialGeometry?: Partial<
			Pick<
				HTMLElement,
				'clientWidth' | 'clientHeight' | 'scrollWidth' | 'scrollHeight' | 'scrollLeft' | 'scrollTop'
			>
		> & { overflow?: 'x' | 'y' };
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
		children,
		stopFocusEvents = false,
		initialGeometry,
		probeKey = 0
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

	// Geometry set before the hook's attachment runs, so its first measure sees
	// the content already overflowing (as a loaded-data mount does).
	const applyInitialGeometry = (node: HTMLElement) => {
		if (initialGeometry == null) return;
		const { overflow, ...values } = initialGeometry;
		for (const [key, value] of Object.entries(values)) {
			Object.defineProperty(node, key, { configurable: true, value, writable: true });
		}
		if (overflow === 'x') node.style.overflowX = 'auto';
		if (overflow === 'y') node.style.overflowY = 'auto';
	};

	export const getState = () => hook.state;
</script>

{#snippet area()}
	<div data-testid="viewport" {@attach applyInitialGeometry} {...hook.getViewportProps({ style })}>
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
{/snippet}

{#key probeKey}
	{#if stopFocusEvents}
		<div
			onfocuscapture={(event: FocusEvent) => event.stopPropagation()}
			onblurcapture={(event: FocusEvent) => event.stopPropagation()}
		>
			{@render area()}
		</div>
	{:else}
		{@render area()}
	{/if}
{/key}
<output data-testid="state">{JSON.stringify(hook.state)}</output>
