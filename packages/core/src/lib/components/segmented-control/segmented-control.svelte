<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type {
		SegmentedControlLayout,
		SegmentedControlSize
	} from './segmented-control-context.svelte.js';

	export interface SegmentedControlProps extends Omit<BaseProps<HTMLDivElement>, 'onchange'> {
		/** The currently selected value (controlled). */
		value: string;
		/** Fired when a segment is selected. */
		onChange: (value: string) => void;
		/** Accessible label for the radio group (used as `aria-label`, never rendered). */
		label: string;
		/** @default 'md' */
		size?: SegmentedControlSize;
		/**
		 * - `'hug'` (default): each segment hugs its content width.
		 * - `'fill'`: segments stretch equally to fill the container.
		 * @default 'hug'
		 */
		layout?: SegmentedControlLayout;
		/** @default false */
		isDisabled?: boolean;
		/**
		 * Explains why the whole control is disabled. With `isDisabled`, the control
		 * shows this in a tooltip on hover/focus and stays focusable (via
		 * `aria-disabled`) so the reason is discoverable; selection stays blocked.
		 */
		disabledMessage?: string;
		/** `SegmentedControlItem` children. */
		children: Snippet;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { useSize } from '../../internal/contexts.svelte.js';
	import { useListFocus } from '../../hooks/use-list-focus.svelte.js';
	import { useKeyboardHint } from '../../hooks/use-keyboard-hint.svelte.js';
	import KeyboardHintLayer from '../../hooks/keyboard-hint-layer.svelte';
	import { useTooltip } from '../tooltip/use-tooltip.svelte.js';
	import TooltipLayer from '../tooltip/tooltip-layer.svelte';
	import { observeResize } from '../../internal/shared-resize-observer.js';
	import { setSegmentedControlContext } from './segmented-control-context.svelte.js';
	import {
		segmentedControlContainerAttrs,
		segmentedControlLensAttrs
	} from './segmented-control.stylex.js';

	/**
	 * Segmented button group for single selection (radiogroup semantics). Items
	 * self-register through context; the group never iterates its children.
	 * `useListFocus` owns the roving tab stop and arrow/Home/End navigation, and
	 * selection follows focus (APG radiogroup).
	 *
	 * @example
	 * ```svelte
	 * <SegmentedControl {value} onChange={(v) => (value = v)} label="View mode">
	 *   <SegmentedControlItem value="grid" label="Grid" />
	 *   <SegmentedControlItem value="list" label="List" />
	 * </SegmentedControl>
	 * ```
	 */
	const {
		value,
		onChange,
		label,
		size: sizeProp,
		layout = 'hug',
		isDisabled = false,
		disabledMessage,
		children,
		xstyle,
		class: className,
		style: styleProp,
		onkeydown: onKeyDownProp,
		onfocusin: onFocusProp,
		onfocusout: onBlurProp,
		...rest
	}: SegmentedControlProps = $props();

	const uid = $props.id();
	const hintID = `${uid}-hint`;
	const tooltipID = `${uid}-tooltip`;

	const resolveSize = useSize();
	const size = $derived(resolveSize(sizeProp, 'md') as SegmentedControlSize);

	// Disabled-reason tooltip for the whole-group disabled state. Disabled controls
	// swallow pointer events, so listeners attach to the radiogroup container (which
	// keeps pointer events on in this mode) and selection stays blocked by the guards.
	const showsDisabledMessage = $derived(isDisabled && !!disabledMessage);
	const disabledMessageTooltip = useTooltip(() => ({
		id: tooltipID,
		placement: 'above' as const,
		focusTrigger: 'always' as const,
		isEnabled: showsDisabledMessage
	}));

	// Roving tabindex + arrow/Home/End navigation across the radios.
	const listFocus = useListFocus(() => ({
		itemSelector: '[role="radio"]:not([aria-disabled="true"])',
		hasRovingTabIndex: true,
		wrap: true,
		orientation: 'horizontal' as const
	}));

	const keyboardHint = useKeyboardHint(() => ({
		id: hintID,
		orientation: 'horizontal' as const,
		isEnabled: !isDisabled
	}));

	setSegmentedControlContext(() => ({
		value,
		onChange,
		size,
		layout,
		isDisabled,
		hasDisabledMessage: showsDisabledMessage
	}));

	let containerEl = $state<HTMLDivElement | null>(null);
	/**
	 * The selected face's box, relative to the container's padding box. It is one
	 * element rather than each item's own background, so a selection change moves
	 * and resizes one surface instead of cross-fading two.
	 */
	let lens = $state({ x: 0, y: 0, width: 0, height: 0, ready: false });
	/** False for the first placement, so the lens starts on the selection. */
	let canAnimate = $state(false);
	let isDragging = $state(false);

	interface SegmentedDrag {
		pointerId: number;
		startX: number;
		startLensX: number;
		moved: boolean;
	}
	let drag: SegmentedDrag | null = null;
	let suppressClick = false;

	function segments(): HTMLElement[] {
		if (containerEl == null) return [];
		return [...containerEl.querySelectorAll<HTMLElement>('[role="radio"][data-value]')].filter(
			(item) => item.getAttribute('aria-disabled') !== 'true'
		);
	}

	function segmentFor(target: string): HTMLElement | null {
		return segments().find((item) => item.dataset.value === target) ?? null;
	}

	function measureLens(target: string): void {
		const container = containerEl;
		if (container == null) return;
		const item = segmentFor(target);
		if (item == null) {
			if (lens.ready) lens = { ...lens, ready: false };
			return;
		}
		const containerRect = container.getBoundingClientRect();
		const itemRect = item.getBoundingClientRect();
		lens = {
			x: itemRect.left - containerRect.left - container.clientLeft,
			y: itemRect.top - containerRect.top - container.clientTop,
			width: itemRect.width,
			height: itemRect.height,
			ready: true
		};
	}

	$effect(() => {
		const container = containerEl;
		// Track the selected value.
		void value;
		if (container == null || isDragging) return;
		measureLens(value);
		const stop = observeResize(container, () => {
			if (!isDragging) measureLens(value);
		});
		const frame = requestAnimationFrame(() => {
			canAnimate = true;
		});
		return () => {
			stop();
			cancelAnimationFrame(frame);
		};
	});

	function segmentAtPointer(event: PointerEvent): HTMLElement | null {
		const container = containerEl;
		if (container == null) return null;
		const x = event.clientX - container.getBoundingClientRect().left - container.clientLeft;
		const items = segments();
		const inside = items.find(
			(item) => x >= item.offsetLeft && x <= item.offsetLeft + item.offsetWidth
		);
		if (inside != null) return inside;
		return (
			items.reduce<HTMLElement | null>((best, item) => {
				if (best == null) return item;
				const itemDistance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - x);
				const bestDistance = Math.abs(best.offsetLeft + best.offsetWidth / 2 - x);
				return itemDistance < bestDistance ? item : best;
			}, null) ?? null
		);
	}

	function handlePointerDown(event: PointerEvent): void {
		if (isDisabled || event.button !== 0 || containerEl == null) return;
		const target =
			event.target instanceof Element
				? event.target.closest<HTMLElement>('[role="radio"][data-value]')
				: null;
		if (
			target == null ||
			target.dataset.value !== value ||
			target.getAttribute('aria-disabled') === 'true'
		) {
			return;
		}
		drag = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startLensX: lens.x,
			moved: false
		};
		try {
			containerEl.setPointerCapture?.(event.pointerId);
		} catch {
			// A synthetic pointer may not be active; the drag still works from the
			// container's own pointermove events.
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		const container = containerEl;
		if (drag == null || container == null || event.pointerId !== drag.pointerId) return;
		const dx = event.clientX - drag.startX;
		if (!drag.moved && Math.abs(dx) < 4) return;
		drag.moved = true;
		if (!isDragging) isDragging = true;
		const items = segments();
		if (items.length === 0) return;
		const first = items[0];
		const last = items[items.length - 1];
		const min = first.offsetLeft;
		const max = Math.max(min, last.offsetLeft + last.offsetWidth - lens.width);
		const x = Math.min(Math.max(drag.startLensX + dx, min), max);
		lens = { ...lens, x };
		// The face moves to a neighbour only once its center is past that
		// segment's boundary by a quarter of the segment's width (at least 8 px),
		// so a short wobble on the selected segment does not switch it.
		const index = items.findIndex((item) => item.dataset.value === value);
		if (index < 0) return;
		const current = items[index];
		const center = x + lens.width / 2;
		let nextIndex = index;
		if (center > current.offsetLeft + current.offsetWidth) {
			const following = items[index + 1];
			if (
				following != null &&
				center >= following.offsetLeft + Math.max(8, 0.25 * following.offsetWidth)
			) {
				nextIndex = index + 1;
			}
		} else if (center < current.offsetLeft) {
			const previous = items[index - 1];
			if (
				previous != null &&
				center <= current.offsetLeft - Math.max(8, 0.25 * current.offsetWidth)
			) {
				nextIndex = index - 1;
			}
		}
		if (nextIndex !== index) {
			const next = items[nextIndex].dataset.value;
			if (next != null) onChange(next);
		}
	}

	function finishDrag(event: PointerEvent, isCancelled = false): void {
		if (drag == null || event.pointerId !== drag.pointerId) return;
		const wasMoved = drag.moved;
		drag = null;
		try {
			containerEl?.releasePointerCapture?.(event.pointerId);
		} catch {
			// The pointer capture may already have ended.
		}
		if (!wasMoved) return;
		// The drop commits the segment under the pointer, so a fast drag that
		// never reached the hysteresis still lands where it was let go.
		if (!isCancelled) {
			const dropped = segmentAtPointer(event);
			const next = dropped?.dataset.value;
			if (next != null && next !== value) onChange(next);
		}
		suppressClick = !isCancelled;
		isDragging = false;
		measureLens(value);
		if (suppressClick) {
			setTimeout(() => {
				suppressClick = false;
			}, 0);
		}
	}

	function handleClickCapture(event: MouseEvent): void {
		if (!suppressClick) return;
		suppressClick = false;
		event.preventDefault();
		event.stopPropagation();
	}

	const lensAttrs = segmentedControlLensAttrs();
	const lensStyle = $derived(
		`transform: translate3d(${lens.x}px, ${lens.y}px, 0); width: ${lens.width}px; height: ${lens.height}px; visibility: ${lens.ready ? 'visible' : 'hidden'};${isDragging || !canAnimate ? ' transition: none;' : ''}`
	);

	const theme = $derived(themeProps('segmented-control', { size }));
	const containerAttrs = $derived(
		segmentedControlContainerAttrs({ size, layout, isDisabled, showsDisabledMessage }, xstyle)
	);

	function handleContainerKeyDown(e: KeyboardEvent): void {
		onKeyDownProp?.(e as KeyboardEvent & { currentTarget: HTMLDivElement });
		if (e.defaultPrevented) {
			return;
		}
		keyboardHint.onKeyDown(e);
		listFocus.handleKeyDown(e);
	}

	// Selection-follows-focus (APG radiogroup): useListFocus only *moves* focus, so
	// when it lands focus on a new radio we select that radio's value — but only for
	// focus moving WITHIN the group. A Tab entering from outside stays a pure focus
	// move so an unmatched/disabled-selected value doesn't get rewritten on traversal.
	function handleContainerFocus(e: FocusEvent): void {
		onFocusProp?.(e as FocusEvent & { currentTarget: HTMLDivElement });
		if (e.defaultPrevented) {
			return;
		}
		keyboardHint.onFocus(e);
		listFocus.handleFocus(e);
		if (isDisabled) {
			return;
		}
		const currentTarget = e.currentTarget as HTMLElement;
		if (!currentTarget.contains(e.relatedTarget as Node | null)) {
			return;
		}
		const focused = (e.target as HTMLElement | null)?.closest<HTMLElement>(
			'[role="radio"][data-value]'
		);
		if (!focused || focused.getAttribute('aria-disabled') === 'true') {
			return;
		}
		const nextValue = focused.dataset.value;
		if (nextValue != null && nextValue !== value) {
			onChange(nextValue);
		}
	}

	function handleContainerBlur(e: FocusEvent): void {
		onBlurProp?.(e as FocusEvent & { currentTarget: HTMLDivElement });
		if (e.defaultPrevented) {
			return;
		}
		keyboardHint.onBlur(e);
	}
</script>

<div
	bind:this={containerEl}
	{...rest}
	{@attach listFocus.attachList}
	{@attach disabledMessageTooltip.attachTrigger}
	role="radiogroup"
	aria-label={label}
	aria-disabled={isDisabled || undefined}
	aria-describedby={showsDisabledMessage ? disabledMessageTooltip.describedBy : undefined}
	onkeydown={handleContainerKeyDown}
	onfocusin={handleContainerFocus}
	onfocusout={handleContainerBlur}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={(event) => finishDrag(event)}
	onpointercancel={(event) => finishDrag(event, true)}
	onclickcapture={handleClickCapture}
	{...theme}
	class={cx(theme.class, containerAttrs.class, className)}
	style={mergeStyle(containerAttrs.style, styleProp as string | undefined)}
>
	<span {...lensAttrs} style={lensStyle} data-astryx-segmented-lens="" aria-hidden="true"></span>
	{@render children()}
	<KeyboardHintLayer hint={keyboardHint} />
</div>
{#if showsDisabledMessage && disabledMessage}
	<TooltipLayer tooltip={disabledMessageTooltip}>{disabledMessage}</TooltipLayer>
{/if}
