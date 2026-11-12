<script lang="ts" module>
	import type { Pager } from '../../lib/pager.js';

	export interface Props {
		/** Controlled target page. Omit for uncontrolled. */
		index?: number;
		defaultIndex?: number;
		/** A changed value replaces the viewport element, and the track with it. */
		viewportKey?: string;
		isPanEnabled?: boolean;
		isControlledChangeAnimated?: boolean;
		onIndexChange?: (index: number) => void;
		onSettle?: (index: number, previous: number) => void;
		onPager?: (pager: Pager) => void;
	}
</script>

<script lang="ts">
	import { usePager } from '../../lib/hooks/use-pager.svelte.js';

	let {
		index,
		defaultIndex,
		viewportKey = 'a',
		isPanEnabled,
		isControlledChangeAnimated,
		onIndexChange,
		onSettle,
		onPager
	}: Props = $props();

	let viewportEl = $state<HTMLDivElement | null>(null);
	let trackEl = $state<HTMLDivElement | null>(null);

	const pager = usePager(() => ({
		viewportRef: () => viewportEl,
		trackRef: () => trackEl,
		count: 5,
		index,
		defaultIndex,
		isPanEnabled,
		isControlledChangeAnimated,
		onIndexChange,
		onSettle
	}));

	// The pager is created once; this is the mount-time capture, as upstream's
	// `props.onPager?.(pager)` does on its every render.
	// svelte-ignore state_referenced_locally
	onPager?.(pager);
</script>

{#key viewportKey}
	<div bind:this={viewportEl} data-testid="viewport">
		<div bind:this={trackEl}></div>
	</div>
{/key}
