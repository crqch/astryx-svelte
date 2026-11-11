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
	import { isSegmentDisabledOnItsOwn } from '../../private-attributes/segment-disabled.js';
	import { isCoarsePointer, watchCoarsePointer } from '../../utils/coarse-pointer.js';
	import { awaitBrowserClick, clickForLift } from '../../utils/browser-click-wait.js';
	import { segmentedControlContainerAttrs } from './segmented-control.stylex.js';
	import { SegmentedSelectionMotion } from './segmented-selection-motion.js';
	import {
		liftTargetAt,
		measureLiftArea,
		measureSegments
	} from './use-segmented-touch-tracking.js';

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
		'aria-describedby': ariaDescribedByProp,
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
	let isTouchPresentation = $state(false);

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
		// One Tab stop, placed by the control: the selected segment, enabled or
		// not and in a disabled control too, else the first segment not disabled
		// by its own `isDisabled`, else the first.
		tabStopOrder: orderTabStop,
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
		isTouchPresentation,
		disabledReasonID: showsDisabledMessage ? disabledMessageTooltip.describedBy : undefined,
		hasDisabledMessage: showsDisabledMessage
	}));

	/**
	 * The control's segments, its Tab stop first: the selected segment, enabled
	 * or not, else the first segment not disabled by its own `isDisabled`, else
	 * the first.
	 */
	function orderTabStop(list: HTMLElement): ReadonlyArray<HTMLElement> {
		const segments = Array.from(list.querySelectorAll<HTMLElement>('[role="radio"]'));
		const stop =
			segments.find((segment) => segment.getAttribute('aria-checked') === 'true') ??
			segments.find((segment) => !isSegmentDisabledOnItsOwn(segment)) ??
			segments[0];
		return stop == null ? segments : [stop, ...segments.filter((segment) => segment !== stop)];
	}

	let containerEl = $state<HTMLDivElement | null>(null);
	const motion = new SegmentedSelectionMotion();
	let previousValue = value;

	/** The segment under a pointer, for the press that begins there. */
	function segmentAtTarget(target: EventTarget | null): HTMLElement | null {
		return target instanceof Element
			? (target.closest<HTMLElement>('[role="radio"][data-value]') ?? null)
			: null;
	}

	$effect(() => {
		isTouchPresentation = isCoarsePointer(window);
		return watchCoarsePointer(window, (isCoarse) => {
			isTouchPresentation = isCoarse;
		});
	});

	$effect(() => {
		motion.present(isTouchPresentation);
	});

	// The DOM already shows the new value; the controller moves the lens from
	// the segment that held it.
	$effect(() => {
		const next = value;
		if (next !== previousValue && containerEl != null) {
			motion.select(containerEl, previousValue, next);
		}
		previousValue = next;
	});

	// The controller's animators attach while the control is mounted. A resize
	// hands any motion in flight back, because its boxes were measured before it.
	$effect(() => {
		const track = containerEl;
		if (track == null) return;
		motion.attachTrack(track);
		const stop = observeResize(track, () => motion.resized(track));
		return () => {
			stop();
			motion.settle();
			motion.attachTrack(null);
			motion.stop();
		};
	});

	interface SegmentedDrag {
		pointerId: number;
		startX: number;
		carriesLens: boolean;
		moved: boolean;
	}
	let drag: SegmentedDrag | null = null;
	let suppressClick = false;
	/** The browser's click a lift is waiting for, if any. */
	let endClickWait: (() => void) | null = null;

	function endWait(): void {
		endClickWait?.();
		endClickWait = null;
	}

	/**
	 * A tap: the browser's own click commits it. The wait reports after the
	 * segment's click handlers run, and clicks the segment itself when no click
	 * comes (a hold), so the selection commits either way.
	 */
	function waitForClick(segment: HTMLElement, track: HTMLElement, committed: string): void {
		endWait();
		const end = awaitBrowserClick(segment, {
			onClicked: (isCancelled) => {
				endClickWait = null;
				motion.clicked(track, committed, isCancelled);
			},
			onNoClick: () => {
				endClickWait = null;
				motion.clicked(track, committed, clickForLift(segment));
			}
		});
		endClickWait = end;
	}

	function handlePointerDown(event: PointerEvent): void {
		const container = containerEl;
		if (isDisabled || event.button !== 0 || container == null) return;
		endWait();
		const target = segmentAtTarget(event.target);
		if (target == null || target.getAttribute('aria-disabled') === 'true') return;
		motion.begin(container, target, event.pointerType === 'touch');
		drag = {
			pointerId: event.pointerId,
			startX: event.clientX,
			carriesLens: target.dataset.value === value,
			moved: false
		};
		try {
			container.setPointerCapture?.(event.pointerId);
		} catch {
			// A synthetic pointer may not be active; the container still hears it.
		}
	}

	function handlePointerMove(event: PointerEvent): void {
		if (drag == null || event.pointerId !== drag.pointerId) return;
		if (!drag.moved && Math.abs(event.clientX - drag.startX) < 4) return;
		drag.moved = true;
		if (drag.carriesLens) motion.drag(event.clientX);
	}

	function finishDrag(event: PointerEvent, isCancelled = false): void {
		const container = containerEl;
		if (drag == null || container == null || event.pointerId !== drag.pointerId) return;
		const wasMoved = drag.moved;
		const carriesLens = drag.carriesLens;
		const pointerType = event.pointerType;
		drag = null;
		try {
			container.releasePointerCapture?.(event.pointerId);
		} catch {
			// The pointer capture may already have ended.
		}
		if (isCancelled) {
			motion.cancel();
			if (wasMoved) suppressClick = true;
			return;
		}
		const spans = measureSegments(container);
		const target = liftTargetAt(
			event.clientX,
			event.clientY,
			measureLiftArea(container, spans),
			spans
		);
		const committed = motion.release(target);
		if (committed == null) return;
		if (!wasMoved && target != null && pointerType === 'touch') {
			// A finger's tap: its click (and the focus it moves) comes after the
			// lift, so the press stays in force until the click has run.
			waitForClick(target, container, committed);
			return;
		}
		// The browser sends no click for a drag (or a mouse tap has already
		// dispatched it): commit now and settle the lens on the new value.
		if (wasMoved) suppressClick = true;
		onChange(committed);
		queueMicrotask(() => {
			if (containerEl != null) motion.clicked(containerEl, committed, false);
		});
	}

	function handleClickCapture(event: MouseEvent): void {
		if (!suppressClick) return;
		suppressClick = false;
		event.preventDefault();
		event.stopPropagation();
	}

	const describedBy = $derived(
		[ariaDescribedByProp, showsDisabledMessage ? disabledMessageTooltip.describedBy : undefined]
			.filter((id): id is string => typeof id === 'string' && id.length > 0)
			.join(' ') || undefined
	);
	const theme = $derived(themeProps('segmented-control', { size }));
	const containerAttrs = $derived(
		segmentedControlContainerAttrs({ size, layout, isDisabled, showsDisabledMessage }, xstyle)
	);

	function handleContainerKeyDown(e: KeyboardEvent): void {
		// A key going down makes a focus move the keyboard's, which selects.
		endWait();
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
		// A pointer press moves focus before its click commits; that click owns
		// the selection, so the focus move itself selects nothing.
		if (isDisabled || motion.isPressed || endClickWait != null) {
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
	aria-describedby={describedBy}
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
	{@render children()}
	<KeyboardHintLayer hint={keyboardHint} />
</div>
{#if showsDisabledMessage && disabledMessage}
	<TooltipLayer tooltip={disabledMessageTooltip}>{disabledMessage}</TooltipLayer>
{/if}
