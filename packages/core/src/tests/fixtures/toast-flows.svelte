<script lang="ts">
	import ToastViewport from '$lib/components/toast/toast-viewport.svelte';
	import ToastFlowControls, { type ToastFlow } from './toast-flow-controls.svelte';
	import type { ToastDismissReason } from '$lib/components/toast/types.js';

	/**
	 * The viewport around upstream's inline toast flows. The controls are a child
	 * so `useToast()` in them reads the viewport's provider context.
	 */
	const {
		flow,
		onHide,
		maxVisible
	}: {
		flow: ToastFlow;
		onHide?: (reason: ToastDismissReason) => void;
		maxVisible?: number;
	} = $props();
</script>

<ToastViewport isTopLayer={false} {maxVisible}>
	<ToastFlowControls {flow} {onHide} />
</ToastViewport>
