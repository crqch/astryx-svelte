<script lang="ts" module>
	import type { WheelProps } from './wheel-options.js';

	export type { WheelOption, WheelProps, WheelHandle } from './wheel-options.js';

	export type PickerWheelProps = WheelProps;
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { scrollTypeOf } from '../../gestures/gesture-host.js';
	import { PanGestureRecognizer } from '../../gestures/pan-gesture-recognizer.js';
	import { TapGestureRecognizer } from '../../gestures/tap-gesture-recognizer.js';
	import { useGestureRecognizer } from '../../gestures/use-gesture-recognizer.svelte.js';
	import { lockSelection } from '../../gestures/selection-lock.js';
	import { rubberBandInverse } from '../../motion/rubber-band.js';
	import { resolveMotion } from '../../motion/resolve-motion.js';
	import { picker } from '../../motion/uikit/picker.js';
	import { registerScrollTable, scroll } from '../../motion/uikit/scroll.js';
	import { registerSpringsTable, springs } from '../../motion/uikit/springs.js';
	import { colorVars, fontWeightVars } from '../../styles/tokens.stylex.js';
	import {
		canSpinTo,
		endIndex,
		nearestEnabledIndex,
		steppedIndex,
		WHEEL_ROW_HEIGHT,
		type WheelOption
	} from './wheel-options.js';
	import {
		bounceCurve,
		dragOffset,
		nearestIndex,
		offsetBounds,
		planRelease,
		type WheelCurve,
		type WheelLayout
	} from './wheel-physics.js';
	import { createWheelStrip, type PlayOptions } from './wheel-strip.js';
	import { useOwnScrollGesture } from './use-own-scroll-gesture.svelte.js';
	import {
		pickerWheelBandAttrs,
		pickerWheelColumnAttrs,
		pickerWheelFadeAttrs,
		pickerWheelRowAttrs,
		pickerWheelStripAttrs
	} from './picker-wheel.stylex.js';

	/**
	 * Ported from Astryx's `DateInput/PickerWheel.tsx`: one UIPickerView column,
	 * the Wheel under a finger.
	 *
	 * It does not scroll natively. WebKit gives every scroll-snapping scroller
	 * the fast deceleration rate, and a scroller's momentum cannot be caught or
	 * measured. The strip moves on the gesture system and the shared animator.
	 *
	 * Internal to `DateInput`; not exported from the barrel, exactly as upstream
	 * keeps it out of `DateInput/index.ts`.
	 */
	let { label, options, value, onChange, isActive = true }: PickerWheelProps = $props();

	/** Row pitch, px: the touch column keeps the scrolling column's pitch. */
	const ROW_HEIGHT = WHEEL_ROW_HEIGHT;
	/** UIKit's picker measures scaled to that pitch (UIKit's row is 32 pt). */
	const UIKIT_SCALE = ROW_HEIGHT / picker.geometry.rowHeight;
	/** UIKit's rubber band dimension for the picker's table, at that pitch. */
	const RUBBER_BAND_DIMENSION = picker.geometry.rubberBandDimension * UIKIT_SCALE;

	// svelte-ignore state_referenced_locally
	const motion = createWheelStrip({ rowHeight: ROW_HEIGHT, rowCount: options.length });
	const layout = $derived<WheelLayout>({ rowHeight: ROW_HEIGHT, rowCount: options.length });
	const selectedIndex = $derived(
		Math.max(
			0,
			options.findIndex((option) => option.value === value)
		)
	);
	const uid = $props.id();

	let column = $state<HTMLDivElement | null>(null);
	/** The strip the animator moves, set by the template attachment. */
	let rows: HTMLDivElement | null = null;
	let drag: { start: number } | null = null;
	/** A finger landed on a moving wheel and stopped it. */
	let caught = false;

	// The row under the band is marked as the scrolling column marks it. At rest
	// that is the committed row, styled in render. While a finger drags the
	// wheel, the row reaching the band is painted directly, so marking it never
	// re-renders. A motion unmarks every row as it starts and marks the row it
	// stops or ends on.
	const painted = new Set<HTMLElement>();

	function paintRow(position: number | null): void {
		const container = rows;
		if (container == null || container.children.length === 0) {
			return;
		}
		const active =
			position == null ? null : ((container.children[position] as HTMLElement | undefined) ?? null);
		for (const row of painted) {
			row.style.removeProperty('color');
			row.style.removeProperty('font-weight');
		}
		painted.clear();
		const selected = options.findIndex((option) => option.value === value);
		if (container.children[selected] != null && container.children[selected] !== active) {
			// The committed row's own mark gives way while another row is under
			// the band.
			const row = container.children[selected] as HTMLElement;
			row.style.color = options[selected]?.isDisabled
				? colorVars['--color-text-disabled']
				: colorVars['--color-text-primary'];
			row.style.fontWeight = fontWeightVars['--font-weight-normal'];
			painted.add(row);
		}
		if (active == null || position == null) {
			return;
		}
		active.style.color = options[position]?.isDisabled
			? colorVars['--color-text-disabled']
			: colorVars['--color-text-accent'];
		active.style.fontWeight = fontWeightVars['--font-weight-semibold'];
		painted.add(active);
	}

	/**
	 * The motion tables the wheel resolves its springs from: the scroll bounce
	 * and the shared springs, registered right before a role is resolved.
	 */
	function registerWheelTables(): void {
		registerScrollTable();
		registerSpringsTable();
	}

	/**
	 * A turn onto `to` that a tap, a key or the program starts. The wheel's main
	 * interaction is a gesture, so every turn springs.
	 */
	function turnCurve(from: number, to: number): WheelCurve {
		registerWheelTables();
		return bounceCurve(from, 0, to, UIKIT_SCALE, resolveMotion(column, springs.settle));
	}

	// Every motion the wheel starts. Under Reduce Motion a transition lands
	// without travel: the animator cross-fades the strip onto its row. The
	// momentum that continues a throw is not a transition, so it plays as is.
	function move(curve: WheelCurve, playOptions: PlayOptions = {}): void {
		paintRow(null);
		// The mark comes back from the row the motion reports nearest when it
		// ends, even the row it began on.
		motion.forgetNearest();
		motion.play(curve, playOptions);
	}

	// The wheel came to rest at `offset`: commit, or turn on to the row the
	// rest rule names first.
	function arrive(offset: number): void {
		const row = nearestIndex(offset, layout);
		const committed = options.findIndex((option) => option.value === value);
		// A rest on the committed row is not a stop to correct. A committed value
		// outside the bounds stays until a person moves the wheel off it.
		let step = 0;
		if (row !== committed) {
			step = nearestEnabledIndex(options, row, Math.max(0, committed)) - row;
		}
		if (step !== 0) {
			const target = row + step;
			move(turnCurve(offset, target * ROW_HEIGHT), {
				onEnd: (outcome, end) => {
					if (outcome === 'arrived') {
						arrive(end);
					}
				}
			});
			return;
		}
		const option = options[row];
		if (option != null && !option.isDisabled && option.value !== value) {
			onChange(option.value);
		}
	}

	function onEnd(outcome: 'arrived' | 'stopped', offset: number): void {
		if (outcome === 'arrived') {
			arrive(offset);
		}
	}

	/** Attaches the moving strip, and lets it go as it detaches. */
	function attachStrip(strip: HTMLDivElement): () => void {
		rows = strip;
		motion.attach(strip);
		return () => {
			rows = null;
			motion.attach(null);
		};
	}

	// The motion's layout follows the rows.
	$effect(() => {
		motion.setLayout(layout);
	});

	// The band's mark follows the row the motion reports nearest the band.
	$effect(() => {
		motion.onNearestChange(paintRow);
		return () => motion.onNearestChange(null);
	});

	// At rest on the committed row, render's own mark takes over again.
	$effect(() => {
		void isActive;
		void options;
		if (
			motion.isMoving() ||
			drag != null ||
			nearestIndex(motion.offset(), layout) !== selectedIndex
		) {
			return;
		}
		for (const row of painted) {
			row.style.removeProperty('color');
			row.style.removeProperty('font-weight');
		}
		painted.clear();
	});

	// The motion's animations and timers end with the wheel.
	onDestroy(() => motion.dispose());

	// Park the committed row under the band when the wheel is shown, at once. A
	// value that changes from outside while the wheel is shown turns the wheel
	// onto its row instead. Never while a finger or a motion owns the wheel.
	let parked = false;
	let parkTurn: object | null = null;
	$effect(() => {
		const active = isActive;
		const selected = selectedIndex;
		if (!active) {
			parked = false;
			return;
		}
		if (drag != null || (motion.isMoving() && parkTurn == null)) {
			return;
		}
		const target = selected * ROW_HEIGHT;
		const shown = motion.isMoving() ? motion.stop() : motion.offset();
		const isAway = Math.abs(shown - target) > 0.01;
		if (isAway && parked) {
			// The turn's own end paints the band's row.
			const turn = {};
			parkTurn = turn;
			move(turnCurve(shown, target), {
				onEnd: () => {
					if (parkTurn === turn) {
						parkTurn = null;
					}
				}
			});
			return;
		}
		if (isAway) {
			motion.setOffset(target);
		}
		parked = true;
	});

	// A hidden wheel keeps no motion running and holds no drag.
	$effect(() => {
		if (!isActive) {
			drag = null;
			motion.stop();
		}
	});

	// A finger lands: a moving wheel stops where it is on screen.
	function onTouchDown(time: number): void {
		caught = motion.isMoving();
		if (caught) {
			motion.stop(time);
		}
	}

	function release(velocity: number): void {
		registerWheelTables();
		const plan = planRelease(
			motion.offset(),
			velocity,
			layout,
			resolveMotion(column, scroll.bounce)
		);
		move(plan.curve, {
			ticks: true,
			onEnd,
			touchRelease: true,
			momentum: plan.kind === 'coast' || plan.kind === 'edge'
		});
	}

	const pan = useGestureRecognizer(
		() => column,
		() =>
			new PanGestureRecognizer({
				name: 'wheel-pan',
				direction: 'vertical',
				// A trackpad's two-finger scroll drives the pan as a finger does.
				allowedScrollTypes: ['continuous'],
				// A held finger on the wheel never starts text selection or the
				// callout.
				selectionLock: lockSelection,
				shouldReceiveTouch: (_pan, touch) => {
					onTouchDown(touch.time);
					return true;
				}
			}),
		(recognizer) => {
			switch (recognizer.state) {
				case 'began': {
					const shown = motion.isMoving() ? motion.stop() : motion.offset();
					drag = { start: fingerOffset(shown, layout) };
					motion.resetDrag();
					motion.setOffset(dragOffset(drag.start - recognizer.translation().y, layout), {
						ticks: true
					});
					break;
				}
				case 'changed': {
					const current = drag;
					if (current == null) {
						break;
					}
					motion.setOffset(dragOffset(current.start - recognizer.translation().y, layout), {
						ticks: true
					});
					break;
				}
				case 'ended': {
					const current = drag;
					drag = null;
					// A scroll view's release velocity (the pan's last two, blended
					// as UIPickerView's); the rows move against the finger.
					release(current == null ? 0 : -recognizer.scrollVelocity().y);
					break;
				}
				case 'cancelled': {
					drag = null;
					release(0);
					break;
				}
				case 'possible':
				case 'failed':
					break;
			}
		},
		{ isEnabled: () => isActive }
	);

	// A touch that stopped a moving wheel and lifted without dragging: the
	// wheel eases onto the nearest row, as a release without velocity does.
	$effect(() => {
		return pan.addTransitionListener((_pan, _from, to) => {
			// The flag stays up until the next touch lands. The tap recognizer may
			// hear of this lift after the pan does, and must not read it as a tap
			// on a row.
			if (to === 'failed' && caught && !motion.isMoving()) {
				release(0);
			}
		});
	});

	useGestureRecognizer(
		() => column,
		() => new TapGestureRecognizer({ name: 'wheel-tap' }),
		(recognizer) => {
			if (recognizer.state !== 'ended' || caught) {
				return;
			}
			const node = column;
			if (node == null) {
				return;
			}
			const box = node.getBoundingClientRect();
			const { y } = recognizer.location();
			const offset = motion.offset();
			const target = rowAtPoint(y - (box.top + box.height / 2), offset, layout);
			if (target == null || target === nearestIndex(offset, layout)) {
				return;
			}
			move(turnCurve(offset, target * ROW_HEIGHT), { onEnd });
		},
		{ isEnabled: () => isActive }
	);

	// Keep the finger, and the pointer it lands with: inside a BottomSheet the
	// sheet would otherwise read a downward drag here as swipe-to-dismiss. This
	// wheel pans through the gesture system, which never cancels the pointer
	// the sheet armed on.
	useOwnScrollGesture(
		() => column,
		() => 'all',
		() => ({ isEnabled: isActive, isPointerKept: true })
	);

	// A spin turns only onto an enabled row. So its arrival commits that row,
	// and nothing turns on past it. It reports the row it was asked for.
	export function spinTo(index: number): Promise<boolean> {
		return new Promise((resolve) => {
			if (!canSpinTo(options, index)) {
				resolve(false);
				return;
			}
			const offset = motion.offset();
			move(turnCurve(offset, index * ROW_HEIGHT), {
				onEnd: (outcome, end) => {
					if (outcome === 'arrived') {
						arrive(end);
					}
					resolve(outcome === 'arrived');
				}
			});
		});
	}

	function turnToPosition(position: number, offset: number): void {
		const option = options[position];
		if (option.value !== value) {
			onChange(option.value);
		}
		move(turnCurve(offset, position * ROW_HEIGHT));
	}

	function moveBy(delta: number): void {
		if (options.length === 0 || delta === 0) {
			return;
		}
		// Keys step from the row the wheel is heading to, not the one it is
		// passing: two quick presses move two rows. A key with nowhere to go
		// leaves a turn in flight to finish on its row.
		const row = steppedIndex(options, nearestIndex(motion.target(), layout), delta);
		if (row == null) {
			return;
		}
		const offset = motion.isMoving() ? motion.stop() : motion.offset();
		turnToPosition(row, offset);
	}

	// A mouse wheel's notch turns the wheel one row, as an arrow key does, with
	// no coast. A ctrl-wheel stays the page's zoom, and a sideways scroll stays
	// the page's.
	$effect(() => {
		const node = column;
		const active = isActive;
		if (node == null || !active) {
			return;
		}
		const onWheel = (event: WheelEvent) => {
			if (
				event.defaultPrevented ||
				event.ctrlKey ||
				event.shiftKey ||
				event.deltaY === 0 ||
				Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
				scrollTypeOf(event) !== 'discrete'
			) {
				return;
			}
			event.preventDefault();
			moveBy(Math.sign(event.deltaY));
		};
		node.addEventListener('wheel', onWheel, { passive: false });
		return () => node.removeEventListener('wheel', onWheel);
	});

	// Home and End: the first and the last enabled row.
	function moveToEnd(end: 'first' | 'last'): void {
		const row = endIndex(options, end);
		if (row == null) {
			return;
		}
		const offset = motion.isMoving() ? motion.stop() : motion.offset();
		turnToPosition(row, offset);
	}

	// A click on a row commits it at once and turns the wheel there, as the
	// arrow keys do. A finger's tap is the tap recognizer's, and the click it
	// would produce is swallowed by the gesture system.
	function activateRow(row: number): void {
		const option = options[row];
		if (option == null || option.isDisabled) {
			return;
		}
		const offset = motion.isMoving() ? motion.stop() : motion.offset();
		if (option.value !== value) {
			onChange(option.value);
		}
		move(turnCurve(offset, row * ROW_HEIGHT));
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

	/** The row under a point `dy` px below the band's centre, or null past either end. */
	function rowAtPoint(dy: number, offset: number, currentLayout: WheelLayout): number | null {
		const position = Math.round((offset + dy) / currentLayout.rowHeight);
		if (position < 0 || position >= currentLayout.rowCount) {
			return null;
		}
		return position;
	}

	/**
	 * The finger's offset for a shown one. Past an end, it is the travel that
	 * the rubber band shows as `shown`. So a drag that starts in a bounce
	 * continues without a jump.
	 */
	function fingerOffset(shown: number, currentLayout: WheelLayout): number {
		const { min, max } = offsetBounds(currentLayout);
		const dimension = RUBBER_BAND_DIMENSION;
		if (shown < min) {
			return min + rubberBandInverse(shown - min, dimension);
		}
		if (shown > max) {
			return max + rubberBandInverse(shown - max, dimension);
		}
		return shown;
	}

	const columnAttrs = pickerWheelColumnAttrs();
	const fadeAttrs = pickerWheelFadeAttrs();
	const bandAttrs = pickerWheelBandAttrs();
	const stripAttrs = pickerWheelStripAttrs();
</script>

<div
	bind:this={column}
	role="listbox"
	aria-label={label}
	aria-activedescendant={`${uid}-${options[selectedIndex]?.value}`}
	tabindex="0"
	onkeydown={handleKeyDown}
	data-wheel=""
	class={columnAttrs.class}
	style={columnAttrs.style}
>
	<div data-wheel-fade="" class={fadeAttrs.class} style={fadeAttrs.style}>
		<div aria-hidden="true" class={bandAttrs.class} style={bandAttrs.style}></div>
		<div
			{@attach attachStrip}
			data-wheel-strip=""
			class={stripAttrs.class}
			style={stripAttrs.style}
		>
			{#each options as option, index (option.value)}
				{@const attrs = pickerWheelRowAttrs(
					index * ROW_HEIGHT,
					index === selectedIndex,
					option.isDisabled === true
				)}
				<!--
					The listbox is ONE tab stop and tracks the active row with
					`aria-activedescendant`, which is the APG pattern and upstream's.
					A finger's tap is the tap recognizer's; a click is the keyboard,
					assistive technology, a test, or a mouse.
				-->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_interactive_supports_focus -->
				<div
					id={`${uid}-${option.value}`}
					role="option"
					aria-selected={option.value === value}
					aria-disabled={option.isDisabled || undefined}
					onclick={() => activateRow(index)}
					data-wheel-row=""
					data-label={option.label}
					class={attrs.class}
					style={attrs.style}
				>
					{option.label}
				</div>
			{/each}
		</div>
	</div>
</div>
