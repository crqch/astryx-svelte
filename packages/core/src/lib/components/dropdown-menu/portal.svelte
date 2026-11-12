<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export interface PortalProps {
		/** The element to move this component's children into. */
		target: HTMLElement | null;
		children: Snippet;
	}
</script>

<script lang="ts">
	import { portalHostAttrs } from './portal.stylex.js';

	/**
	 * Svelte's stand-in for React's `createPortal`.
	 *
	 * The children render in place first and are then moved, in an effect, into
	 * `target`. Svelte keeps patching the same nodes wherever they live. The
	 * cleanup is load-bearing: a moved node is outside the range Svelte clears
	 * when the block unmounts, so it has to remove itself.
	 */
	const { target, children }: PortalProps = $props();

	let anchor = $state<HTMLElement | null>(null);
	const host = portalHostAttrs();

	$effect(() => {
		const node = anchor;
		const destination = target;
		if (node == null || destination == null) {
			return;
		}
		destination.appendChild(node);
		return () => {
			node.remove();
		};
	});
</script>

<div bind:this={anchor} class={host.class} style={host.style}>
	{@render children()}
</div>
