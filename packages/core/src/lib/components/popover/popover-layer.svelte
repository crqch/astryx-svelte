<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { StyleArg } from '../../internal/sx.js';
	import type { LayerAlignment, LayerPlacement } from '../layer/use-layer.svelte.js';
	import type { UsePopoverReturn } from './use-popover.svelte.js';

	/**
	 * As with `LayerProps` and `HoverCardLayerProps`, upstream has no counterpart
	 * name: `usePopover`'s `render` is a function on the hook's return, not a
	 * component, so there is nothing there for a props type to describe.
	 */
	export interface PopoverLayerProps {
		/** The value returned by `usePopover`. */
		popover: UsePopoverReturn;
		/** Logical placement relative to the trigger. Upstream's `render` prop. */
		placement?: LayerPlacement;
		/** Alignment along the placement axis. Upstream's `render` prop. */
		alignment?: LayerAlignment;
		/**
		 * Clearance from the trigger, as a CSS length. Upstream's `render` prop,
		 * new at 0.4.x (#4951) — surfaces that used to bake a `marginBlockStart`
		 * into their own popover style pass this instead, so the gap survives a
		 * `position-try-fallbacks` flip.
		 */
		offset?: number | string;
		/**
		 * StyleX styles for the layer's positioned container — upstream's
		 * `render` prop `xstyle` (the `[popoverXstyle, gap, layerAnimations]`
		 * array `Popover` builds). Distinct from the hook's `xstyle` option,
		 * which styles the inner content wrapper.
		 */
		xstyle?: StyleArg;
		/**
		 * Inline styles for the layer's positioned container — upstream's `render`
		 * prop `style`, which `usePopover` passes straight through to `layer.render`
		 * along with the rest of its `ContextRenderProps`. `Selector` is the first
		 * consumer: its selected-item overlay is a computed negative
		 * `margin-block-start`, a per-instance measurement with no class worth
		 * minting.
		 */
		style?: string;
		/** Popover content. */
		children: Snippet;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { stableClassName } from '../../internal/naming.js';
	import Button from '../button/button.svelte';
	import Layer from '../layer/layer.svelte';
	import {
		popoverCloseButtonWrapperAttrs,
		popoverContentWrapperAttrs
	} from './use-popover.stylex.js';
	import { popoverSurfaceAttrs } from './popover.stylex.js';

	/**
	 * The rendering half of `usePopover`, replacing upstream's `render` function.
	 *
	 * The same split `layer.render` → `<Layer>` and `renderHoverCard` →
	 * `<HoverCardLayer>` took: a Svelte hook cannot return markup, so the render
	 * function becomes a component and the hook hands it what the closure
	 * captured.
	 *
	 * The element tree is upstream's `render` verbatim: a `<Layer>` container
	 * wrapping a focus-trap content `<div>` (the `role="dialog"` wrapper, carrying
	 * `aria-modal`/`aria-label`, the surface styles and the focus-trap
	 * attachment), the caller's content, and the hidden close button that reveals
	 * on focus.
	 *
	 * The layer container gets no `role`: upstream's `layer.render` is called with
	 * only `{placement, alignment, xstyle}`, so the dialog role lives on the inner
	 * wrapper, not the popover element.
	 */
	const {
		popover,
		placement,
		alignment,
		offset,
		xstyle,
		style: styleProp,
		children
	}: PopoverLayerProps = $props();

	// contentWrapper + (hasSurface && surface) + the hook's option xstyle.
	const contentWrapper = $derived(popoverContentWrapperAttrs(popover.hasSurface, popover.xstyle));

	// The surface is created here, not by the calling component, so a component
	// that wants its popup themeable cannot reach it on its own — a target it
	// renders itself would land on the content INSIDE this box. Upstream 0.7.13
	// removed the private `popover-surface` class and documents `popover` as the
	// broad target instead; `surfaceTarget` still names a component-specific
	// class where one exists.
	const surfaceClass = $derived(
		cx(
			popover.surfaceTarget != null ? stableClassName(popover.surfaceTarget) : undefined,
			contentWrapper.class
		)
	);
	const closeWrapper = popoverCloseButtonWrapperAttrs();

	const isDialog = $derived(popover.role === 'dialog');

	/**
	 * Whether the content overflows the surface's box, which makes it a scroll
	 * container (spec:AST-059). Upstream measures the surface it renders through
	 * `usePopover`'s content ref; here the surface is this component's element.
	 */
	let surfaceEl = $state<HTMLElement | null>(null);
	let hasOverflow = $state(false);
	let measurementFrame: number | null = null;

	function measureOverflow(): void {
		const surface = surfaceEl;
		if (surface == null) {
			return;
		}
		const next =
			surface.scrollHeight > surface.clientHeight + 1 ||
			surface.scrollWidth > surface.clientWidth + 1;
		if (next !== hasOverflow) {
			hasOverflow = next;
		}
	}

	function scheduleOverflowMeasurement(): void {
		if (measurementFrame != null) {
			return;
		}
		// The surface's own window paints it, so its frame runs the measurement.
		const view = surfaceEl?.ownerDocument.defaultView ?? window;
		measurementFrame = view.requestAnimationFrame(() => {
			measurementFrame = null;
			measureOverflow();
		});
	}

	$effect(() => {
		const surface = surfaceEl;
		if (surface == null || !popover.isOpen) {
			return;
		}
		// Observe from the surface's own window: a Popover rendered into a second
		// document resizes with that document's window.
		const view = surface.ownerDocument.defaultView ?? window;
		measureOverflow();
		const resizeObserver =
			typeof view.ResizeObserver === 'undefined'
				? null
				: new view.ResizeObserver(scheduleOverflowMeasurement);
		const mutationObserver =
			typeof MutationObserver === 'undefined'
				? null
				: new MutationObserver(scheduleOverflowMeasurement);
		resizeObserver?.observe(surface);
		mutationObserver?.observe(surface, { childList: true, characterData: true, subtree: true });
		surface.addEventListener('load', scheduleOverflowMeasurement, true);
		view.addEventListener('resize', scheduleOverflowMeasurement);
		view.visualViewport?.addEventListener('resize', scheduleOverflowMeasurement);
		return () => {
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			surface.removeEventListener('load', scheduleOverflowMeasurement, true);
			view.removeEventListener('resize', scheduleOverflowMeasurement);
			view.visualViewport?.removeEventListener('resize', scheduleOverflowMeasurement);
			if (measurementFrame != null) {
				view.cancelAnimationFrame(measurementFrame);
				measurementFrame = null;
			}
		};
	});

	const surface = $derived(popoverSurfaceAttrs(hasOverflow));
</script>

<Layer layer={popover.layer} {placement} {alignment} {offset} {xstyle} style={styleProp}>
	<div
		bind:this={surfaceEl}
		{@attach popover.attachContent}
		role={isDialog ? 'dialog' : undefined}
		aria-modal={isDialog && popover.isModal ? true : undefined}
		aria-label={isDialog ? popover.dialogLabel : undefined}
		class={cx(surfaceClass, surface.class)}
		style={mergeStyle(contentWrapper.style, surface.style)}
	>
		{@render children()}
		{#if popover.hasCloseButton}
			<div class={closeWrapper.class} style={closeWrapper.style}>
				<Button variant="secondary" label={popover.closeButtonLabel} onclick={popover.hide} />
			</div>
		{/if}
	</div>
</Layer>
