<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { ElementSize } from '../../internal/contexts.svelte.js';
	import type { SpacingStep } from '../../internal/types.js';
	import type { SectionDivider, SectionVariant } from '../section/section.stylex.js';

	export type ToolbarSize = ElementSize;

	export interface ToolbarProps extends BaseProps<HTMLDivElement> {
		/** Content aligned to the start (left in LTR). */
		startContent?: Snippet;
		/**
		 * Content centred between start and end. When provided, switches to the
		 * three-lane layout: the centre sits at the toolbar's middle while each
		 * side lane fits in half of the width it leaves, and the row wraps when
		 * the lanes do not fit.
		 */
		centerContent?: Snippet;
		/** Content aligned to the end (right in LTR). */
		endContent?: Snippet;
		/** Accessible label, applied as `aria-label` on the inner toolbar element. */
		label: string;
		/**
		 * Size of the toolbar. Children inherit it as their default through the
		 * size context, so `Button`, `TextInput`, `TabList` and `Selector` line up.
		 * @default 'md'
		 */
		size?: ToolbarSize;
		/**
		 * Gap between items within each slot, on the spacing scale.
		 * @default 1
		 */
		gap?: SpacingStep;
		/**
		 * Orientation for keyboard navigation — which arrow keys move between
		 * items.
		 * @default 'horizontal'
		 */
		orientation?: 'horizontal' | 'vertical';
		/**
		 * Visual variant passed through to `Section`.
		 * @default 'transparent'
		 */
		variant?: SectionVariant;
		/** Which sides get divider borders. Passed through to `Section`. */
		dividers?: SectionDivider[];
	}
</script>

<script lang="ts">
	import Section from '../section/section.svelte';
	import KeyboardHintLayer from '../../hooks/keyboard-hint-layer.svelte';
	import { oneTabStopAmong, useListFocus } from '../../hooks/use-list-focus.svelte.js';
	import { useKeyboardHint } from '../../hooks/use-keyboard-hint.svelte.js';
	import { setSizeContext } from '../../internal/contexts.svelte.js';
	import { observeResize } from '../../internal/shared-resize-observer.js';
	import { cx } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import {
		defaultBlockPaddingForSize,
		toolbarAttrs,
		toolbarCenterSlotAttrs,
		toolbarEndLaneAttrs,
		toolbarEndSlotAttrs,
		toolbarStartLaneAttrs,
		toolbarStartSlotAttrs
	} from './toolbar.stylex.js';

	// `a[href]` catches a Button rendered with `href`.
	const TOOLBAR_ITEMS = 'button, input, a[href], [tabindex]';
	const TOOLBAR_BOUNDARY = '[role="toolbar"], [popover]';
	const toolbarTabStop = oneTabStopAmong(TOOLBAR_ITEMS, TOOLBAR_BOUNDARY);

	/**
	 * Whether a three-lane row has wrapped: its lanes no longer share one
	 * vertical band.
	 */
	function lanesHaveWrapped(row: Element): boolean {
		// An empty lane is a box with no height, so it shares every line.
		const boxes = [...row.children]
			.slice(0, 3)
			.map((lane) => lane.getBoundingClientRect())
			.filter((box) => box.height > 0);
		return (
			boxes.length > 1 &&
			Math.max(...boxes.map((box) => box.top)) >= Math.min(...boxes.map((box) => box.bottom))
		);
	}

	/**
	 * A general-purpose toolbar with start, centre and end content slots.
	 *
	 * Built on `Section`: flex or grid layout with roving-tabindex keyboard
	 * navigation from `useListFocus`, the size cascaded to children through the
	 * size context, and edge compensation so ghost buttons sit flush at container
	 * edges.
	 *
	 * @example
	 * ```svelte
	 * <Toolbar label="Actions" size="sm">
	 *   {#snippet startContent()}<Button label="Cut" variant="ghost" />{/snippet}
	 *   {#snippet endContent()}<Button label="Settings" variant="ghost" />{/snippet}
	 * </Toolbar>
	 * ```
	 */
	let {
		startContent,
		centerContent,
		endContent,
		label,
		size = 'md',
		gap = 1,
		orientation = 'horizontal',
		variant = 'transparent',
		dividers,
		xstyle,
		class: className,
		style: styleProp,
		onkeydown: onKeyDownProp,
		onfocusin: onFocusProp,
		onfocusout: onBlurProp,
		// Read and dropped, as upstream reads and drops them: the toolbar owns
		// its own `role`/`aria-label`/`aria-orientation`.
		role: _role,
		'aria-label': _ariaLabel,
		'aria-orientation': _ariaOrientation,
		...props
	}: ToolbarProps = $props();

	const hasCenterContent = $derived(centerContent != null);
	const hasStartContent = $derived(startContent != null);
	const hasEndContent = $derived(endContent != null);
	const hasBottomDivider = $derived(dividers?.includes('bottom') ?? false);

	const hintId = $props.id();

	const listFocus = useListFocus(() => ({
		itemSelector: TOOLBAR_ITEMS,
		boundarySelector: TOOLBAR_BOUNDARY,
		orientation,
		hasRovingTabIndex: true,
		hasCaretGuard: true,
		// A read-only toolbar of disabled controls stays one Tab stop.
		tabStopOrder: toolbarTabStop
	}));

	const keyboardHint = useKeyboardHint(() => ({ id: hintId, orientation }));

	setSizeContext(() => size);

	// A bottom divider drops a tab's indicator onto its rail through the block
	// padding. That is right only while the lanes share one line, so a wrapped
	// row keeps the indicator on its tab. The row reports a wrap after layout,
	// in a resize observation.
	const watchesWrap = $derived(hasCenterContent && hasBottomDivider);
	let isWrapped = $state(false);
	const dropsIndicatorOnRail = $derived(hasBottomDivider && !(watchesWrap && isWrapped));

	function attachWrap(node: HTMLElement): (() => void) | undefined {
		if (!watchesWrap) {
			return;
		}
		return observeResize(node, () => {
			isWrapped = lanesHaveWrapped(node);
		});
	}

	function handleToolbarKeyDown(e: KeyboardEvent): void {
		onKeyDownProp?.(e as KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement });
		if (e.defaultPrevented) {
			return;
		}
		keyboardHint.onKeyDown(e);
		listFocus.handleKeyDown(e);
	}

	function handleToolbarFocus(e: FocusEvent): void {
		onFocusProp?.(e as FocusEvent & { currentTarget: EventTarget & HTMLDivElement });
		if (e.defaultPrevented) {
			return;
		}
		keyboardHint.onFocus(e);
		listFocus.handleFocus(e);
	}

	function handleToolbarBlur(e: FocusEvent): void {
		onBlurProp?.(e as FocusEvent & { currentTarget: EventTarget & HTMLDivElement });
		if (e.defaultPrevented) {
			return;
		}
		keyboardHint.onBlur(e);
	}

	const theme = $derived(themeProps('toolbar', { size }));
	const rootAttrs = $derived(
		toolbarAttrs(hasCenterContent, orientation, size, gap, dropsIndicatorOnRail)
	);
	const startAttrs = $derived(toolbarStartSlotAttrs(size, gap, !hasEndContent));
	const centerAttrs = $derived(toolbarCenterSlotAttrs(gap));
	const endAttrs = $derived(toolbarEndSlotAttrs(size, gap, !hasStartContent));
	// The three-lane layout's side slots always sit between siblings, so neither
	// is "only", and each lane shares the width the centre leaves.
	const laneStartAttrs = $derived(toolbarStartLaneAttrs(size, gap));
	const laneEndAttrs = $derived(toolbarEndLaneAttrs(size, gap));
</script>

<Section
	{variant}
	paddingBlock={defaultBlockPaddingForSize[size]}
	{dividers}
	{xstyle}
	class={className}
	style={styleProp}
>
	<div
		{...props}
		{@attach listFocus.attachList}
		{@attach attachWrap}
		role="toolbar"
		aria-label={label}
		aria-orientation={orientation}
		onkeydown={handleToolbarKeyDown}
		onfocusin={handleToolbarFocus}
		onfocusout={handleToolbarBlur}
		{...theme}
		class={cx(theme.class, rootAttrs.class)}
		style={rootAttrs.style}
	>
		{#if hasCenterContent}
			<!-- Three-lane layout -->
			<div class={laneStartAttrs.class} style={laneStartAttrs.style}>
				{@render startContent?.()}
			</div>
			<div class={centerAttrs.class} style={centerAttrs.style}>
				{@render centerContent?.()}
			</div>
			<div class={laneEndAttrs.class} style={laneEndAttrs.style}>
				{@render endContent?.()}
			</div>
		{:else}
			<!-- Two-slot flex layout -->
			{#if hasStartContent}
				<div class={startAttrs.class} style={startAttrs.style}>{@render startContent?.()}</div>
			{/if}
			{#if hasEndContent}
				<div class={endAttrs.class} style={endAttrs.style}>{@render endContent?.()}</div>
			{/if}
		{/if}
		<KeyboardHintLayer hint={keyboardHint} />
	</div>
</Section>
