<script lang="ts" module>
	export type { WheelOption, WheelProps, WheelHandle } from './wheel-options.js';
</script>

<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import {
		playReducedMotionDip,
		reducedMotionFade,
		type ReducedMotionDip
	} from '../../motion/reduced-motion.js';
	import { useScrollSettle } from './use-scroll-settle.svelte.js';
	import { useOwnScrollGesture } from './use-own-scroll-gesture.svelte.js';
	import { usePointerDragScroll } from './use-pointer-drag-scroll.svelte.js';
	import { canSpinTo, endIndex, steppedIndex, type WheelProps } from './wheel-options.js';
	import {
		wheelBandAttrs,
		wheelColumnAttrs,
		wheelItemAttrs,
		wheelItemInnerAttrs,
		wheelScrollerAttrs
	} from './wheel.stylex.js';

	/**
	 * Ported from Astryx's `DateInput/Wheel.tsx` (`ScrollWheel`): one
	 * snap-scrolling picker column, under a fine pointer.
	 *
	 * A wheel is a scroll container, not a custom gesture surface. Momentum,
	 * rubber-banding, and the settle animation are the platform's.
	 *
	 * Accessibility: this is a listbox, not a novel widget. It is one tab stop
	 * with arrow/Home/End/PageUp/PageDown keys, `aria-activedescendant` tracking
	 * the active row, and every row reachable by tap.
	 *
	 * Internal to `DateInput`; not exported from the barrel, exactly as upstream
	 * keeps it out of `DateInput/index.ts`.
	 */
	let { label, options, value, onChange, isActive = true }: WheelProps = $props();

	const uid = $props.id();
	let scroller = $state<HTMLDivElement | null>(null);

	const selectedIndex = $derived(
		Math.max(
			0,
			options.findIndex((o) => o.value === value)
		)
	);

	// Which row is under the band right now. Tracks the finger during a scroll;
	// `selectedIndex` only catches up when the wheel settles.
	//
	// The initialiser runs once, at component init, and reads the props directly
	// rather than the `$derived` above — a `$derived` read here would be
	// evaluated in the same untracked initialisation pass anyway.
	// svelte-ignore state_referenced_locally
	let activeIndex = $state(
		Math.max(
			0,
			options.findIndex((o) => o.value === value)
		)
	);

	/**
	 * A spin commits the row at once. The new value then scrolls the column
	 * there, as any new value does.
	 */
	export function spinTo(index: number): Promise<boolean> {
		if (!canSpinTo(options, index)) {
			return Promise.resolve(false);
		}
		const option = options[index];
		if (option.value !== value) {
			onChange(option.value);
		}
		return Promise.resolve(true);
	}

	/**
	 * Row height in px, read from layout rather than assumed, so a theme that
	 * retunes the wheel item size still lands on the right row.
	 */
	function itemBlockSize(): number {
		const first = scroller?.firstElementChild;
		return first instanceof HTMLElement && first.offsetHeight > 0 ? first.offsetHeight : 0;
	}

	// The Reduced Motion dip a smooth landing is playing, and the landing it
	// will apply at the dip's middle. Under Reduce Motion the wheel's own
	// scroll lands without travel: it dips on a touch screen, and lands at once
	// on any other pointer.
	let pendingFade: { top: number } | null = null;
	let dip: ReducedMotionDip | null = null;

	function scrollToIndex(index: number, behavior: ScrollBehavior): void {
		const size = itemBlockSize();
		const node = scroller;
		if (node == null || size === 0) {
			return;
		}
		const top = index * size;
		const fadeTiming = behavior === 'smooth' ? reducedMotionFade(node) : null;
		const pending = pendingFade;
		// A change that lands now replaces a pending landing. Its dip goes on
		// and fades back in.
		if (fadeTiming == null) {
			pendingFade = null;
			node.scrollTo({ top, behavior });
			return;
		}
		if (fadeTiming.duration === 0 || typeof node.animate !== 'function') {
			pendingFade = null;
			node.scrollTo({ top, behavior: 'auto' });
			return;
		}
		if (pending != null) {
			// The dip is still fading out: its rows land here instead.
			pending.top = top;
			return;
		}
		// A step during the last dip's fade-in starts the new dip at the
		// column's current opacity, not at full opacity.
		const shown = Number.parseFloat(getComputedStyle(node).opacity);
		dip?.cancel();
		const landing = { top };
		pendingFade = landing;
		dip = playReducedMotionDip(
			node,
			fadeTiming,
			() => {
				if (pendingFade === landing) {
					pendingFade = null;
					node.scrollTo({ top: landing.top, behavior: 'auto' });
				}
			},
			Number.isFinite(shown) ? shown : 1
		);
	}

	onDestroy(() => {
		dip?.cancel();
		dip = null;
	});

	// Commit on rest. A wheel that stops on a disabled row travels on to the
	// nearest enabled row, as UIDatePicker does. That second rest commits it.
	// A rest on the committed row is not a stop to correct. A committed value
	// outside the bounds stays until a person moves the wheel.
	//
	// Declared here, above the park effect, because that effect consults the
	// `isAtRest` this returns before it repositions anything.
	const settle = useScrollSettle(
		() => scroller,
		(element) => {
			const size = itemBlockSize();
			if (size === 0) {
				return;
			}
			const index = Math.min(options.length - 1, Math.max(0, Math.round(element.scrollTop / size)));
			const option = options[index];
			if (option == null || option.isDisabled) {
				scrollToIndex(selectedIndex, 'smooth');
				return;
			}
			if (option.value !== value) {
				onChange(option.value);
			}
		},
		() => isActive
	);

	// Park the committed row under the band whenever the wheel is shown, or the
	// value is changed from outside (the calendar scrolled to another month).
	//
	// NEVER while the wheel is still moving. A scroller that is mid-gesture or
	// still carrying momentum is the user's, and repositioning it does not stop
	// the momentum — on iOS it feeds a cycle where the scroll this causes reads
	// as a new settle, commits the next row along, and parks again. See
	// use-scroll-settle.
	//
	// `settle.isAtRest` is deliberately NOT reactive: it is upstream's ref, and
	// making it a rune would re-run this effect on every scroll event — which is
	// the mid-flight repositioning the flag exists to prevent.
	$effect(() => {
		const index = selectedIndex;
		const node = scroller;
		if (!isActive || !settle.isAtRest) {
			return;
		}
		const size = itemBlockSize();
		if (node == null || size === 0) {
			return;
		}
		if (Math.round(node.scrollTop / size) !== index) {
			node.scrollTo({ top: index * size, behavior: 'auto' });
		}
		untrack(() => {
			activeIndex = index;
		});
	});

	// Highlight follows the finger. rAF-throttled: a scroll can fire far more
	// often than the display refreshes, and this only feeds a repaint.
	$effect(() => {
		const node = scroller;
		const count = options.length;
		if (node == null || !isActive) {
			return;
		}
		let frame: number | undefined;
		const onScroll = (): void => {
			if (frame != null) {
				return;
			}
			frame = requestAnimationFrame(() => {
				frame = undefined;
				const size = itemBlockSize();
				if (size === 0) {
					return;
				}
				activeIndex = Math.min(count - 1, Math.max(0, Math.round(node.scrollTop / size)));
			});
		};
		node.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			node.removeEventListener('scroll', onScroll);
			if (frame != null) {
				cancelAnimationFrame(frame);
				frame = undefined;
			}
		};
	});

	// Keep the finger. Inside a BottomSheet the sheet would otherwise read a
	// downward drag here as swipe-to-dismiss; see use-own-scroll-gesture. Gated
	// on isActive because the hidden panel keeps its layout box.
	useOwnScrollGesture(
		() => scroller,
		() => 'all',
		() => ({ isEnabled: isActive })
	);

	// A mouse cannot drag a scroll container, so without this the wheel ignores
	// the one gesture its shape invites. Touch is untouched — it pans natively,
	// with momentum this could not match. See use-pointer-drag-scroll.
	usePointerDragScroll(
		() => scroller,
		() => isActive
	);

	function moveTo(row: number | null): void {
		const option = row == null ? undefined : options[row];
		if (row == null || option == null || option.isDisabled) {
			return;
		}
		activeIndex = row;
		scrollToIndex(row, 'smooth');
		if (option.value !== value) {
			onChange(option.value);
		}
	}

	function moveBy(delta: number): void {
		moveTo(steppedIndex(options, activeIndex, delta));
	}

	function moveToEnd(end: 'first' | 'last'): void {
		moveTo(endIndex(options, end));
	}

	function activateRow(index: number): void {
		const option = options[index];
		if (option == null || option.isDisabled) {
			return;
		}
		activeIndex = index;
		scrollToIndex(index, 'smooth');
		if (option.value !== value) {
			onChange(option.value);
		}
	}

	function handleKeyDown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				moveBy(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveBy(-1);
				break;
			case 'PageDown':
				event.preventDefault();
				moveBy(10);
				break;
			case 'PageUp':
				event.preventDefault();
				moveBy(-10);
				break;
			case 'Home':
				event.preventDefault();
				moveToEnd('first');
				break;
			case 'End':
				event.preventDefault();
				moveToEnd('last');
				break;
			default:
				break;
		}
	}

	const columnAttrs = wheelColumnAttrs();
	const bandAttrs = wheelBandAttrs();
	const scrollerAttrs = wheelScrollerAttrs();
</script>

<div class={columnAttrs.class} style={columnAttrs.style}>
	<div aria-hidden="true" class={bandAttrs.class} style={bandAttrs.style}></div>
	<div
		bind:this={scroller}
		role="listbox"
		aria-label={label}
		aria-activedescendant={`${uid}-${options[activeIndex]?.value}`}
		tabindex="0"
		onkeydown={handleKeyDown}
		class={scrollerAttrs.class}
		style={scrollerAttrs.style}
	>
		{#each options as option, index (option.value)}
			{@const attrs = wheelItemAttrs(index === activeIndex, option.isDisabled === true)}
			{@const innerAttrs = wheelItemInnerAttrs(option.isDisabled === true)}
			<!--
				The listbox is ONE tab stop and tracks the active row with
				`aria-activedescendant`, which is the APG pattern and upstream's; giving
				each option a tabindex would put a hundred years of months in the tab
				order.
			-->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<div
				id={`${uid}-${option.value}`}
				role="option"
				aria-selected={option.value === value}
				aria-disabled={option.isDisabled || undefined}
				onclick={() => activateRow(index)}
				class={attrs.class}
				style={attrs.style}
			>
				<span class={innerAttrs.class} style={innerAttrs.style}>{option.label}</span>
			</div>
		{/each}
	</div>
</div>
