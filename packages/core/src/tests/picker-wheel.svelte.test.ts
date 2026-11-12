/** PORTS: DateInput/PickerWheel.test.tsx */

/**
 * Astryx's `DateInput/PickerWheel.test.tsx`, ported case for case.
 *
 * Runs in the **client** project, against real Chromium. Upstream's jsdom
 * environment is replaced by:
 *
 * - `vitest.useFakeTimers`, as upstream: the gesture arena's clock, the
 *   animator's clock and `document.timeline` (stubbed below) share it, so a
 *   case advances time explicitly.
 * - A recording stand-in for `Element.animate`, used by the cases that inspect
 *   a turn's curve, and no `animate` at all for the cases that upstream runs
 *   with jsdom's missing Web Animations (a motion then writes its end inline).
 * - `ontouchstart` declared on the window, as jsdom has it, so the gesture host
 *   reads the suite's synthetic Touch Events rather than waiting for pointer
 *   events.
 * - `render` from `vitest-browser-svelte`, whose `rerender` updates the same
 *   mounted component as React's re-render does. `act` has no counterpart: a
 *   `$state` write is visible to the next read, and the helpers flush with
 *   `flushSync`.
 * - Plain DOM queries rather than Testing Library's role queries. The suite
 *   never uses Playwright locators, so fake timers cannot stall an
 *   actionability poll.
 *
 * Two cases are translated rather than dropped:
 *
 * - `points the active row at a value set from outside in the same commit`
 *   uses `picker-wheel-commit-probe.svelte`. React's `Profiler.onRender`
 *   fires after the DOM commit; Svelte's `$effect` is its counterpart.
 * - `keeps the touch column's markup` asserts the same structure
 *   (`data-wheel*`, roles, aria, row order) instead of a literal snapshot:
 *   React's generated `_r_…` ids and StyleX's debug class names do not exist
 *   here, and a byte snapshot of the port's own ids/classes would pin the
 *   harness rather than the markup.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from 'vitest-browser-svelte';
import PickerWheel from '$lib/components/date-input/picker-wheel.svelte';
import type { WheelProps } from '$lib/components/date-input/wheel-options.js';
import { WHEEL_ROW_HEIGHT, type WheelOption } from '$lib/components/date-input/wheel-options.js';
import { bounceCurve, scaleFor } from '$lib/components/date-input/wheel-physics.js';
import { fontWeightVars } from '$lib/styles/tokens.stylex.js';
import { springs, timing } from '$lib/motion/uikit/index.js';
import PickerWheelOwned from './fixtures/picker-wheel-owned.svelte';
import PickerWheelProbe from './fixtures/picker-wheel-probe.svelte';
import PickerWheelCommitProbe from './fixtures/picker-wheel-commit-probe.svelte';

const ROW = WHEEL_ROW_HEIGHT;
/** The column is laid out 216 px tall, its band's centre 108 px down. */
const CENTRE = 108;

/**
 * How long a turn of `rows` rows from rest lasts on `springs.settle`, in ms.
 * A tap, a key or the program starts that motion.
 */
function turnMs(rows: number): number {
	return bounceCurve(0, 0, rows * ROW, scaleFor(ROW), springs.settle).duration * 1000;
}

/** Hours 0-23 with 09:00-17:00 bounds: 0-8 and 18-23 are disabled. */
const HOURS: WheelOption[] = Array.from({ length: 24 }, (_, hour) => ({
	value: hour,
	label: String(hour).padStart(2, '0'),
	isDisabled: hour < 9 || hour > 17
}));

const MINUTES: WheelOption[] = Array.from({ length: 60 }, (_, minute) => ({
	value: minute,
	label: String(minute).padStart(2, '0')
}));

/** The person's settings, through `matchMedia` as the component reads them. */
function stubMedia({
	reduced = false,
	coarse = true
}: { reduced?: boolean; coarse?: boolean } = {}) {
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query.includes('prefers-reduced-motion')
			? reduced
			: query.includes('pointer: coarse')
				? coarse
				: false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false
	}));
}

// --- A recording Web Animations stand-in ------------------------------------

interface RecordedAnimation {
	readonly element: Element;
	readonly keyframes: Keyframe[];
	readonly options: KeyframeAnimationOptions;
	cancelled: boolean;
	readonly ready: Promise<RecordedAnimation>;
	readonly finished: Promise<boolean>;
	readonly effect: { getTiming(): { duration: number } };
	readonly playState: 'idle' | 'running';
	readonly currentTime: number | null;
	startTime: number | null;
	cancel(): void;
}

const originalAnimate = Element.prototype.animate;
let animations: RecordedAnimation[] = [];

function recordingAnimation(
	this: Element,
	keyframes: Keyframe[],
	options?: KeyframeAnimationOptions
): Animation {
	let start: number | null = null;
	let resolveReady: (animation: RecordedAnimation) => void = () => {};
	let rejectReady: (error: Error) => void = () => {};
	const ready = new Promise<RecordedAnimation>((resolve, reject) => {
		resolveReady = resolve;
		rejectReady = reject;
	});
	const animation: RecordedAnimation = {
		element: this,
		keyframes,
		options: options ?? {},
		cancelled: false,
		ready,
		finished: new Promise<boolean>(() => {}),
		effect: {
			getTiming: () => ({ duration: Number(options?.duration ?? 0) })
		},
		get playState() {
			return animation.cancelled ? 'idle' : 'running';
		},
		currentTime: null,
		get startTime() {
			return start;
		},
		set startTime(value) {
			start = value;
			resolveReady(animation);
		},
		cancel() {
			animation.cancelled = true;
			rejectReady(new Error('AbortError'));
		}
	};
	animations.push(animation);
	return animation as unknown as Animation;
}

/** Installs the recording stand-in: the cases that inspect a turn's curve. */
function installRecordingAnimations(): void {
	Element.prototype.animate = recordingAnimation;
}

/** jsdom has no Web Animations: a motion writes its end inline instead. */
function installNoAnimations(): void {
	Object.defineProperty(Element.prototype, 'animate', {
		configurable: true,
		writable: true,
		value: undefined
	});
}

/** Each animation the wheel asked of its strip: its places and their times. */
function stripAnimations(): { places: number[]; times: number[] }[] {
	return animations
		.filter(
			(animation) =>
				animation.element.hasAttribute('data-wheel-strip') &&
				animation.keyframes.some((frame) => 'translate' in frame)
		)
		.map((animation) => {
			const span = Number(animation.options?.duration ?? 0);
			return {
				places: animation.keyframes.map((frame) => {
					const [, y = '0'] = String(frame.translate ?? '')
						.trim()
						.split(/\s+/);
					return Number.parseFloat(y) || 0;
				}),
				times: animation.keyframes.map((frame) => Number(frame.offset ?? 0) * span)
			};
		});
}

// One fake clock serves the whole file. The gesture system is one per document
// and keeps its own timeline, so time must never run backwards between tests.
beforeAll(() => {
	vi.useFakeTimers({
		toFake: [
			'setTimeout',
			'clearTimeout',
			'performance',
			'Date',
			'requestAnimationFrame',
			'cancelAnimationFrame'
		]
	});
});

beforeEach(() => {
	stubMedia();
	vi.stubGlobal('ontouchstart', null);
	animations = [];
	// The wheel strip reads `document.timeline`, which a browser drives on its
	// own clock; give it the fake one the animator and the gesture arena use.
	Object.defineProperty(document, 'timeline', {
		configurable: true,
		value: {
			get currentTime() {
				return performance.now();
			}
		}
	});
	// The default, as in upstream's finger, keyboard, mouse and wheel blocks:
	// jsdom runs no Web Animations, so a motion shows its end until it rests.
	installNoAnimations();
});

afterEach(() => {
	// Let every motion and gesture timer of the test run out.
	flushSync(() => vi.advanceTimersByTime(10_000));
	Element.prototype.animate = originalAnimate;
	Reflect.deleteProperty(document, 'timeline');
	vi.unstubAllGlobals();
});

afterAll(() => {
	vi.useRealTimers();
});

/** A wheel whose owner commits each change, as a field does. */
async function renderOwnedWheel(options: WheelOption[], initial: number) {
	const onChange = vi.fn();
	const screen = await render(PickerWheelOwned, {
		props: { options, initial, onChange }
	});
	return { screen, column: columnOf(screen.container), onChange };
}

async function renderWheel(props: Partial<WheelProps> = {}) {
	const onChange = vi.fn();
	const screen = await render(PickerWheel, {
		props: { label: 'Hour', options: HOURS, value: 10, onChange, ...props }
	});
	const column = columnOf(screen.container);
	column.getBoundingClientRect = () =>
		({
			top: 0,
			bottom: 216,
			left: 0,
			right: 120,
			width: 120,
			height: 216,
			x: 0,
			y: 0,
			toJSON() {}
		}) as DOMRect;
	const option = (label: string): HTMLElement => optionOf(column, label);
	return { ...screen, onChange, column, option };
}

function columnOf(container: HTMLElement): HTMLElement {
	const column = container.querySelector('[role="listbox"]');
	if (!(column instanceof HTMLElement)) {
		throw new Error('no listbox');
	}
	return column;
}

function optionOf(column: HTMLElement, label: string): HTMLElement {
	const option = [...column.querySelectorAll<HTMLElement>('[role="option"]')].find(
		(element) => element.textContent?.trim() === label
	);
	if (option == null) {
		throw new Error(`no option ${label}`);
	}
	return option;
}

/** Advances the fake clock, flushing the Svelte updates its timers made. */
function advance(ms: number): void {
	flushSync(() => {
		vi.advanceTimersByTime(ms);
	});
}

/**
 * Advances the clock with the promise callbacks between its timers run: the
 * animator dates a Reduce Motion landing from its start promise.
 */
async function advanceAsync(ms: number): Promise<void> {
	await vi.advanceTimersByTimeAsync(ms);
	flushSync();
	await Promise.resolve();
}

/** Each finger gets its own identifier, as a new contact does. */
let nextFinger = 1;
let finger = 0;

/** One touch event at the fake clock's time. */
function touch(type: 'touchstart' | 'touchmove' | 'touchend', target: Element, y: number): void {
	if (type === 'touchstart') {
		finger = nextFinger++;
	}
	const event = new Event(type, { bubbles: true, cancelable: true });
	const entry = { identifier: finger, clientX: 60, clientY: y, target };
	Object.defineProperty(event, 'changedTouches', { value: [entry] });
	Object.defineProperty(event, 'touches', {
		value: type === 'touchend' ? [] : [entry]
	});
	Object.defineProperty(event, 'timeStamp', { value: performance.now() });
	flushSync(() => {
		target.dispatchEvent(event);
	});
}

/**
 * A finger that lands at `from`, moves to `to` in `steps` events `interval` ms
 * apart, optionally holds still, and lifts.
 */
function drag(
	target: Element,
	from: number,
	to: number,
	{ steps = 10, interval = 16, hold = 0 } = {}
): void {
	touch('touchstart', target, from);
	for (let i = 1; i <= steps; i++) {
		advance(interval);
		touch('touchmove', target, from + ((to - from) * i) / steps);
	}
	if (hold > 0) {
		advance(hold);
	}
	touch('touchend', target, to);
}

/**
 * How far below the band's centre a row is drawn: its place along the strip,
 * and the strip's translation (the `translate` the animator writes).
 */
function distanceOf(element: Element): number {
	const row = element as HTMLElement;
	const strip = row.parentElement!;
	const index = Array.prototype.indexOf.call(strip.children, row);
	const [, y = '0'] = strip.style.getPropertyValue('translate').trim().split(/\s+/);
	return index * ROW + (Number.parseFloat(y) || 0);
}

/** Whether a row carries the band's mark: painted, or styled in render and not overridden. */
function isMarked(row: HTMLElement): boolean {
	if (row.style.fontWeight !== '') {
		return row.style.fontWeight === fontWeightVars['--font-weight-semibold'];
	}
	return row.className.includes('rowActive');
}

function keyDown(element: Element, key: string): void {
	flushSync(() => {
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	});
}

function click(element: Element): void {
	flushSync(() => {
		(element as HTMLElement).click();
	});
}

describe('PickerWheel — at rest', () => {
	it('is a listbox with one option per row, each label once', async () => {
		const { column } = await renderWheel();
		expect(column.querySelectorAll('[role="option"]')).toHaveLength(24);
		// Each option is drawn once, as its own row.
		const labels = [...column.querySelectorAll('[role="option"]')].map(
			(element) => element.textContent
		);
		expect(labels.filter((label) => label === '10')).toHaveLength(1);
		expect(column).toHaveAttribute('tabindex', '0');
	});

	it('parks the committed row under the band, the others above and below it', async () => {
		const { option, column } = await renderWheel();
		expect(distanceOf(option('10'))).toBeCloseTo(0, 4);
		expect(distanceOf(option('11'))).toBeCloseTo(ROW, 2);
		expect(distanceOf(option('09'))).toBeCloseTo(-ROW, 2);
		expect(column.getAttribute('aria-activedescendant')).toBe(option('10').id);
	});

	it('points the active row at a value set from outside in the same commit', async () => {
		// One entry per commit: the active descendant the listbox shows then.
		const commits: (string | null)[] = [];
		const screen = await render(PickerWheelCommitProbe, {
			props: {
				options: HOURS,
				value: 10,
				onCommit: (activeDescendant: string | null) => commits.push(activeDescendant)
			}
		});
		commits.length = 0;
		await screen.rerender({ value: 12 });
		expect(commits).toEqual([optionOf(columnOf(screen.container), '12').id]);
	});

	describe('a value changed from outside while it is shown', () => {
		beforeEach(() => {
			installRecordingAnimations();
		});

		it('turns the wheel onto its row, as a bound clamping the time (component:DateInput FR14)', async () => {
			const { rerender, option, onChange } = await renderWheel();
			advance(2000);
			animations.length = 0;
			await rerender({ value: 14 });
			// From 10 onto 14 through the rows between: a turn, never a jump.
			const strips = stripAnimations();
			expect(strips).toHaveLength(1);
			const [turn] = strips;
			expect(turn.places[0]).toBeCloseTo(-10 * ROW, 1);
			expect(turn.places[turn.places.length - 1]).toBeCloseTo(-14 * ROW, 1);
			expect(
				turn.places.filter((y) => y < -10 * ROW - 1 && y > -14 * ROW + 1).length
			).toBeGreaterThanOrEqual(4);
			advance(2000);
			expect(distanceOf(option('14'))).toBeCloseTo(0, 1);
			expect(isMarked(option('14'))).toBe(true);
			expect(onChange).not.toHaveBeenCalled();
		});

		it('turns on from where the wheel is drawn when the value changes again during that turn', async () => {
			const { rerender, option, onChange } = await renderWheel();
			advance(2000);
			animations.length = 0;
			await rerender({ value: 14 });
			advance(Math.round(turnMs(4) / 2));
			await rerender({ value: 16 });
			const strips = stripAnimations();
			expect(strips).toHaveLength(2);
			const [, second] = strips;
			// The second turn starts between 10 and 14, where the first has it
			// drawn, and ends on 16.
			expect(second.places[0]).toBeLessThan(-10 * ROW - 1);
			expect(second.places[0]).toBeGreaterThan(-14 * ROW + 1);
			expect(second.places[second.places.length - 1]).toBeCloseTo(-16 * ROW, 1);
			advance(2000);
			expect(distanceOf(option('16'))).toBeCloseTo(0, 1);
			expect(onChange).not.toHaveBeenCalled();
		});
	});

	it('opening on a value outside the bounds commits nothing', async () => {
		const { onChange, column, option } = await renderWheel({ value: 8 });
		advance(2000);
		expect(onChange).not.toHaveBeenCalled();
		expect(column.getAttribute('aria-activedescendant')).toBe(option('08').id);
	});

	it('rests back on a committed value outside the bounds and commits nothing', async () => {
		// component:DateInput FR13: a wheel resting on its committed row commits
		// nothing, even outside the bounds, as the scrolling column keeps it.
		const { column, option, onChange } = await renderWheel({ value: 8 });
		advance(2000);
		// One gesture: up a row onto 09 (enabled), back down onto 08, held
		// still, lifted.
		const away = 10 + ROW;
		touch('touchstart', column, 100);
		for (let i = 1; i <= 15; i++) {
			advance(40);
			touch('touchmove', column, 100 - (away * i) / 15);
		}
		for (let i = 1; i <= 15; i++) {
			advance(40);
			touch('touchmove', column, 100 - away + (away * i) / 15);
		}
		advance(300);
		touch('touchend', column, 100);
		advance(2000);
		expect(onChange).not.toHaveBeenCalled();
		expect(distanceOf(option('08'))).toBeCloseTo(0, 4);
		// Back on the row it left, the band's mark is back on it too.
		expect(isMarked(option('08'))).toBe(true);
	});

	it('parks a value set while it is hidden at once when it is shown again', async () => {
		const { rerender, option, onChange } = await renderWheel();
		await rerender({ value: 10, isActive: false });
		await rerender({ value: 14, isActive: false });
		await rerender({ value: 14, isActive: true });
		expect(distanceOf(option('14'))).toBeCloseTo(0, 4);
		expect(onChange).not.toHaveBeenCalled();
	});
});

describe('PickerWheel — a finger', () => {
	it('turns text selection off while a finger holds it (spec:AST-094 FR41)', async () => {
		const { column, option } = await renderWheel();
		const refuses = () => {
			const event = new Event('selectstart', { bubbles: true, cancelable: true });
			option('10').dispatchEvent(event);
			return event.defaultPrevented;
		};
		expect(refuses()).toBe(false);
		touch('touchstart', column, CENTRE);
		expect(refuses()).toBe(true);
		expect(column.style.getPropertyValue('user-select')).toBe('');
		advance(300);
		touch('touchend', column, CENTRE);
		expect(refuses()).toBe(false);
	});

	it('marks no row while a fling coasts, then the row it rests on', async () => {
		const { column, onChange } = await renderWheel({
			options: MINUTES,
			value: 10,
			label: 'Minute'
		});
		const marked = () =>
			[...column.querySelectorAll<HTMLElement>('[role="option"]')]
				.filter(isMarked)
				.map((row) => row.textContent);
		expect(marked()).toEqual(['10']);
		drag(column, 180, 60, { steps: 6, interval: 16 });
		// The coast plays (no animations here, but no row is marked).
		expect(marked()).toEqual([]);
		advance(4000);
		expect(onChange).toHaveBeenCalledTimes(1);
		const rested = String(onChange.mock.calls[0][0]).padStart(2, '0');
		expect(marked()).toEqual([rested]);
	});

	it('marks no row while the wheel snaps or turns, then the row it rests on', async () => {
		const { column } = await renderWheel();
		const marked = () =>
			[...column.querySelectorAll<HTMLElement>('[role="option"]')]
				.filter(isMarked)
				.map((row) => row.textContent);
		// A slow release snaps onto 11.
		drag(column, 150, 100, { steps: 25, interval: 40, hold: 300 });
		expect(marked()).toEqual([]);
		advance(1000);
		expect(marked()).toEqual(['11']);
		// A key turns the wheel on to 12.
		keyDown(column, 'ArrowDown');
		expect(marked()).toEqual([]);
		advance(1000);
		expect(marked()).toEqual(['12']);
	});

	it('drags the rows with it, without committing until the wheel rests', async () => {
		const { column, option, onChange } = await renderWheel();
		touch('touchstart', column, 150);
		for (let i = 1; i <= 8; i++) {
			advance(16);
			touch('touchmove', column, 150 - i * 6);
		}
		// 48 px of travel, 10 of it the pan's hysteresis: 38 px up.
		expect(distanceOf(option('10'))).toBeCloseTo(-38, 1);
		expect(onChange).not.toHaveBeenCalled();
		touch('touchend', column, 102);
		advance(2000);
	});

	it('eases onto the nearest row after a slow release and commits it there', async () => {
		const { column, onChange } = await renderWheel();
		// 10 px of hysteresis + 40 px: 1.25 rows, held still, lifted.
		drag(column, 150, 100, { steps: 25, interval: 40, hold: 300 });
		expect(onChange).not.toHaveBeenCalled();
		advance(1000);
		expect(onChange).toHaveBeenCalledWith(11);
	});

	it('keeps the band’s mark on the committed row after a nudge that eases back onto it', async () => {
		const { column, option, onChange } = await renderWheel();
		expect(isMarked(option('10'))).toBe(true);
		// 10 px of hysteresis + a third of a row, held still, lifted.
		drag(column, 150, 150 - (10 + ROW / 3), {
			steps: 10,
			interval: 40,
			hold: 300
		});
		advance(2000);
		expect(onChange).not.toHaveBeenCalled();
		expect(distanceOf(option('10'))).toBeCloseTo(0, 4);
		expect(isMarked(option('10'))).toBe(true);
	});

	it('turns on to the minimum after resting below it, and commits that', async () => {
		const { column, option, onChange } = await renderWheel();
		// Down 3 rows (+10 px of hysteresis): the wheel rests on 07, disabled.
		drag(column, 60, 60 + 10 + 3 * ROW, { steps: 30, interval: 40, hold: 300 });
		advance(100);
		expect(onChange).not.toHaveBeenCalled();
		advance(2000);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith(9);
		expect(distanceOf(option('09'))).toBeCloseTo(0, 4);
	});

	it('flings across several rows before committing', async () => {
		const { column, onChange } = await renderWheel({
			options: MINUTES,
			value: 10,
			label: 'Minute'
		});
		drag(column, 180, 60, { steps: 6, interval: 16 });
		advance(200);
		expect(onChange).not.toHaveBeenCalled();
		advance(4000);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange.mock.calls[0][0]).toBeGreaterThan(15);
	});

	it('rubber-bands past the last row and returns to it', async () => {
		const { column, option, onChange } = await renderWheel({ value: 17 });
		// Up far past hour 23.
		drag(column, 200, 20, { steps: 30, interval: 30, hold: 300 });
		advance(3000);
		// It rests on 23 (disabled), then turns back onto 17.
		advance(2000);
		expect(onChange).not.toHaveBeenCalledWith(23);
		expect(distanceOf(option('17'))).toBeCloseTo(0, 4);
	});

	it('is held where it shows by a finger that catches it in its rubber band, then follows that finger (spec:AST-094 FR6)', async () => {
		const { column, option } = await renderWheel({
			options: MINUTES,
			value: 59,
			label: 'Minute'
		});
		/** The wheel's offset, from where its last row is drawn. */
		const offsetOf = () => 59 * ROW - distanceOf(option('59'));
		// Up past the last row (10 px of hysteresis and 180 more), held, lifted:
		// the wheel starts back out of its rubber band.
		drag(column, 200, 10, { steps: 30, interval: 30, hold: 300 });
		// A finger lands while the return is still far out: the wheel stops
		// there, drawn where it was.
		advance(16);
		touch('touchstart', column, 150);
		advance(16);
		const caught = offsetOf();
		expect(caught - 59 * ROW).toBeGreaterThan(40);
		// The hysteresis, then 6 px more up: the band gives a little of it, never
		// a jump.
		touch('touchmove', column, 140);
		advance(16);
		touch('touchmove', column, 134);
		advance(16);
		const moved = offsetOf() - caught;
		expect(moved).toBeGreaterThan(0.5);
		expect(moved).toBeLessThan(6);
		touch('touchend', column, 134);
		advance(2000);
	});

	it('is stopped where it is by a finger that lands on it, and commits nothing', async () => {
		const { column, option, onChange } = await renderWheel({
			options: MINUTES,
			value: 10,
			label: 'Minute'
		});
		drag(column, 180, 60, { steps: 6, interval: 16 });
		advance(150);
		// No animations: a motion shows its end inline.
		const heading = distanceOf(option('10'));
		touch('touchstart', column, 100);
		const caught = distanceOf(option('10'));
		// Stopped where it was on screen, well short of where it was heading,
		// and held there.
		expect(Math.abs(caught - heading)).toBeGreaterThan(ROW);
		advance(50);
		expect(Math.abs(distanceOf(option('10')) - caught)).toBeLessThan(1);
		touch('touchend', column, 100);
		// A catch is not a tap: no turn onto the touched row, only the snap.
		advance(1000);
		expect(onChange).toHaveBeenCalledTimes(1);
		const rested = onChange.mock.calls[0][0] as number;
		expect(Math.abs(distanceOf(option(String(rested).padStart(2, '0'))))).toBe(0);
	});

	it('turns onto a tapped row and commits it on arrival', async () => {
		const { column, onChange } = await renderWheel();
		const below = CENTRE + ROW;
		touch('touchstart', column, below);
		advance(60);
		touch('touchend', column, below);
		expect(onChange).not.toHaveBeenCalled();
		advance(turnMs(1) + 10);
		expect(onChange).toHaveBeenCalledWith(11);
	});

	it('a finger’s tap turns once: its lift is cancelled, so the browser sends no click', async () => {
		// spec:AST-094 FR19: the tap recognizer owns a finger's tap, and the
		// row's click handler is left to keys, assistive technology and a mouse.
		const { column, onChange } = await renderWheel();
		const below = CENTRE + ROW;
		touch('touchstart', column, below);
		advance(60);
		const lift = new Event('touchend', { bubbles: true, cancelable: true });
		const entry = { identifier: finger, clientX: 60, clientY: below, target: column };
		Object.defineProperty(lift, 'changedTouches', { value: [entry] });
		Object.defineProperty(lift, 'touches', { value: [] });
		Object.defineProperty(lift, 'timeStamp', { value: performance.now() });
		flushSync(() => {
			column.dispatchEvent(lift);
		});
		expect(lift.defaultPrevented).toBe(true);
		advance(turnMs(1) + 10);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith(11);
	});

	it('does nothing for a tap on the band’s row', async () => {
		const { column, onChange } = await renderWheel();
		touch('touchstart', column, CENTRE);
		advance(60);
		touch('touchend', column, CENTRE);
		advance(500);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('drops a drag it is hidden in, and parks the committed row when shown again', async () => {
		const { column, onChange, option, rerender } = await renderWheel();
		// A finger drags the rows two rows up; the wheel is hidden before it lifts.
		touch('touchstart', column, 150);
		for (let i = 1; i <= 6; i++) {
			advance(16);
			touch('touchmove', column, 150 - 12 * i);
		}
		expect(distanceOf(option('10'))).not.toBeCloseTo(0, 2);
		await rerender({ isActive: false });
		touch('touchend', column, 78);
		advance(1000);
		await rerender({ isActive: true });
		advance(100);
		expect(onChange).not.toHaveBeenCalled();
		expect(distanceOf(option('10'))).toBeCloseTo(0, 4);
	});

	it('ignores fingers while hidden', async () => {
		const { column, option, onChange } = await renderWheel({ isActive: false });
		const before = option('10').style.transform;
		drag(column, 150, 60, { steps: 10, interval: 16 });
		advance(3000);
		expect(onChange).not.toHaveBeenCalled();
		expect(option('10').style.transform).toBe(before);
	});
});

describe('PickerWheel — keyboard and clicks', () => {
	it('commits each arrow key at once, stepping from the row it is heading to', async () => {
		const { column, onChange } = await renderWheel();
		keyDown(column, 'ArrowDown');
		expect(onChange).toHaveBeenLastCalledWith(11);
		keyDown(column, 'ArrowDown');
		expect(onChange).toHaveBeenLastCalledWith(12);
	});

	it('skips disabled rows and stops at the bounds', async () => {
		const { column, onChange } = await renderWheel({ value: 9 });
		keyDown(column, 'ArrowUp');
		expect(onChange).not.toHaveBeenCalled();
		keyDown(column, 'End');
		expect(onChange).toHaveBeenLastCalledWith(17);
	});

	it('at a 12:00–17:00 bound, moves a key to the next enabled row and stops at the last one', async () => {
		const bound = HOURS.map((option) => ({
			...option,
			isDisabled: option.value < 12 || option.value > 17
		}));
		const { column, onChange } = await renderOwnedWheel(bound, 17);
		// No enabled row lies below 17: these keys commit nothing.
		for (const key of ['ArrowDown', 'PageDown', 'End']) {
			keyDown(column, key);
		}
		expect(onChange).not.toHaveBeenCalled();
		// PageUp's target, 7, is past the bound: the key stops at 12.
		keyDown(column, 'PageUp');
		expect(onChange).toHaveBeenLastCalledWith(12);
		keyDown(column, 'ArrowUp');
		keyDown(column, 'Home');
		expect(onChange).toHaveBeenCalledTimes(1);
		keyDown(column, 'End');
		expect(onChange).toHaveBeenLastCalledWith(17);
	});

	it('at a 12:00–17:00 bound on a 12-hour hour wheel, steps in time order: nothing after 5 PM, and 1 PM after 12 PM', async () => {
		// The PM hours as the 12-hour wheel lists them, 1 to 12, each standing for
		// its full hour: 12 (noon) comes before 1. Noon to 5 PM are in the bound.
		const pmHours = Array.from({ length: 12 }, (_, index) => {
			const hour = index + 1;
			const hour24 = hour === 12 ? 12 : hour + 12;
			return {
				value: hour,
				label: String(hour),
				order: hour24,
				isDisabled: hour24 > 17
			};
		});
		const { column, onChange } = await renderOwnedWheel(pmHours, 5);
		for (const key of ['ArrowDown', 'PageDown', 'End']) {
			keyDown(column, key);
		}
		expect(onChange).not.toHaveBeenCalled();
		keyDown(column, 'Home');
		expect(onChange).toHaveBeenLastCalledWith(12);
		keyDown(column, 'ArrowDown');
		expect(onChange).toHaveBeenLastCalledWith(1);
		keyDown(column, 'ArrowUp');
		expect(onChange).toHaveBeenLastCalledWith(12);
	});

	it('lets a turn onto the last allowed row finish when a key during it has nowhere to go', async () => {
		const bound = HOURS.map((option) => ({
			...option,
			isDisabled: option.value < 12 || option.value > 17
		}));
		const { column, onChange } = await renderOwnedWheel(bound, 16);
		keyDown(column, 'ArrowDown');
		expect(onChange).toHaveBeenLastCalledWith(17);
		// Mid-turn, a second ArrowDown finds no allowed row past 17.
		advance(100);
		keyDown(column, 'ArrowDown');
		advance(1000);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(distanceOf(optionOf(column, '17'))).toBeCloseTo(0, 4);
	});

	it('moves a key from a row outside the bounds onto the first enabled row in its direction', async () => {
		const bound = HOURS.map((option) => ({
			...option,
			isDisabled: option.value < 12 || option.value > 17
		}));
		const { column, onChange } = await renderOwnedWheel(bound, 20);
		keyDown(column, 'ArrowDown');
		expect(onChange).not.toHaveBeenCalled();
		keyDown(column, 'ArrowUp');
		expect(onChange).toHaveBeenLastCalledWith(17);
	});

	it('keeps the band’s mark on the last row when a key has nowhere further to go', async () => {
		const { column, option, onChange } = await renderWheel({
			options: MINUTES,
			value: 59,
			label: 'Minute'
		});
		keyDown(column, 'ArrowDown');
		advance(1000);
		expect(onChange).not.toHaveBeenCalled();
		expect(distanceOf(option('59'))).toBeCloseTo(0, 4);
		expect(isMarked(option('59'))).toBe(true);
	});

	it('takes Home and End to the first and last enabled rows, even mid-coast', async () => {
		const { column, onChange } = await renderWheel({
			options: MINUTES,
			value: 10,
			label: 'Minute'
		});
		drag(column, 180, 60, { steps: 6, interval: 16 });
		advance(200);
		// Still coasting, towards a row well past 10.
		expect(onChange).not.toHaveBeenCalled();
		keyDown(column, 'Home');
		expect(onChange).toHaveBeenLastCalledWith(0);
		keyDown(column, 'End');
		expect(onChange).toHaveBeenLastCalledWith(59);
	});

	it('commits a clicked row at once and never a disabled one', async () => {
		const { option, onChange } = await renderWheel();
		click(option('07'));
		expect(onChange).not.toHaveBeenCalled();
		click(option('13'));
		expect(onChange).toHaveBeenCalledWith(13);
	});
});

describe('PickerWheel — a mouse', () => {
	/** One mouse pointer event at the fake clock's time. */
	function mouse(
		type: 'pointerdown' | 'pointermove' | 'pointerup',
		target: Element,
		y: number,
		{ button = 0, buttons = 1 }: { button?: number; buttons?: number } = {}
	): void {
		const event = new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			composed: true,
			pointerId: 41,
			pointerType: 'mouse',
			isPrimary: true,
			clientX: 60,
			clientY: y,
			button,
			buttons
		});
		Object.defineProperty(event, 'timeStamp', { value: performance.now() });
		flushSync(() => {
			target.dispatchEvent(event);
		});
	}

	/**
	 * A slow drag up by `distance` px with `button` held, then a release. The
	 * drag stays well under the release velocity floor, so the wheel rests where
	 * it is let go.
	 */
	function mouseDrag(target: Element, distance: number, button = 0): void {
		const buttons = button === 0 ? 1 : 2;
		mouse('pointerdown', target, 150, { button, buttons });
		for (let i = 1; i <= 25; i++) {
			advance(40);
			mouse('pointermove', target, 150 - (distance * i) / 25, {
				button: -1,
				buttons
			});
		}
		advance(300);
		mouse('pointerup', target, 150 - distance, { button, buttons: 0 });
	}

	it('turns with a primary-button drag and commits where it rests', async () => {
		// A mouse on a touch device (a tablet's trackpad): the primary pointer
		// stays coarse.
		expect(window.matchMedia('(pointer: coarse)').matches).toBe(true);
		const { column, onChange } = await renderWheel();
		// 10 px of hysteresis + 40 px: 1.25 rows.
		mouseDrag(column, 50);
		advance(1000);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith(11);
	});

	it('does nothing for a secondary-button drag', async () => {
		expect(window.matchMedia('(pointer: coarse)').matches).toBe(true);
		const { column, onChange } = await renderWheel();
		mouseDrag(column, 50, 2);
		advance(2000);
		expect(onChange).not.toHaveBeenCalled();
	});
});

describe('PickerWheel — a scroll wheel and a trackpad', () => {
	/**
	 * One wheel event over the column at the fake clock's time; returns whether
	 * it was cancelled. `legacy` is the `wheelDeltaX`/`wheelDeltaY` that Chromium
	 * and WebKit send. A mouse wheel's notch is 120 a step, and a trackpad's
	 * precise delta is three times its own.
	 */
	function wheel(
		target: Element,
		init: {
			dx?: number;
			dy?: number;
			mode?: number;
			ctrl?: boolean;
			legacy?: { x: number; y: number };
		}
	): boolean {
		const event = new WheelEvent('wheel', {
			bubbles: true,
			cancelable: true,
			composed: true,
			clientX: 60,
			clientY: CENTRE,
			deltaX: init.dx ?? 0,
			deltaY: init.dy ?? 0,
			deltaMode: init.mode ?? 0,
			ctrlKey: init.ctrl ?? false
		});
		Object.defineProperty(event, 'timeStamp', { value: performance.now() });
		if (init.legacy != null) {
			Object.defineProperty(event, 'wheelDeltaX', { value: init.legacy.x });
			Object.defineProperty(event, 'wheelDeltaY', { value: init.legacy.y });
		}
		flushSync(() => {
			target.dispatchEvent(event);
		});
		return event.defaultPrevented;
	}
	/** A mouse wheel's notch down, as Chromium sends one. */
	const notch = (target: Element) => wheel(target, { dy: 100, legacy: { x: 0, y: -120 } });
	/** A trackpad's precise delta down, as Chromium and WebKit send one. */
	const trackpad = (target: Element, dy: number) =>
		wheel(target, { dy, legacy: { x: 0, y: -3 * dy } });

	it('turns one row for a mouse wheel’s notch, as an arrow key does, with no coast (component:DateInput FR15)', async () => {
		const { column, option, onChange } = await renderWheel();
		expect(notch(column)).toBe(true);
		// As an arrow key: the next row commits at once.
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenLastCalledWith(11);
		advance(2000);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(distanceOf(option('11'))).toBeCloseTo(0, 1);
	});

	it('turns three rows for three notches, one each', async () => {
		const { column, option, onChange } = await renderWheel();
		for (let i = 0; i < 3; i++) {
			expect(notch(column)).toBe(true);
			advance(40);
		}
		expect(onChange.mock.calls).toEqual([[11], [12], [13]]);
		advance(2000);
		expect(distanceOf(option('13'))).toBeCloseTo(0, 1);
	});

	it('turns one row for a line-mode notch, as Firefox sends', async () => {
		const { column, onChange } = await renderWheel();
		expect(wheel(column, { dy: 3, mode: 1 })).toBe(true);
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenLastCalledWith(11);
	});

	it('leaves a ctrl-wheel, a trackpad pinch, to the page (spec:AST-094 FR10, FR43)', async () => {
		const { column, onChange } = await renderWheel();
		expect(wheel(column, { dy: 100, ctrl: true, legacy: { x: 0, y: -120 } })).toBe(false);
		advance(1000);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('leaves a sideways scroll to the page', async () => {
		const { column, onChange } = await renderWheel();
		expect(wheel(column, { dx: 100, legacy: { x: -120, y: 0 } })).toBe(false);
		advance(1000);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('follows a trackpad’s fingers, coasts on at their lift and rests on a row, as a finger’s flick does (component:DateInput FR15)', async () => {
		const { column, option, onChange } = await renderWheel({
			options: MINUTES,
			value: 10,
			label: 'Minute'
		});
		/** The wheel's offset, from where minute 10 is drawn. */
		const offsetOf = () => 10 * ROW - distanceOf(option('10'));
		// The fingers: 12 px a frame for 12 frames.
		for (let i = 0; i < 12; i++) {
			expect(trackpad(column, 12)).toBe(true);
			advance(16);
		}
		const atLift = offsetOf();
		// The rows followed the fingers' travel.
		expect(atLift).toBeGreaterThan(10 * ROW + 60);
		expect(onChange).not.toHaveBeenCalled();
		// The momentum the platform sends after the lift: a shrinking run.
		for (const dy of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
			trackpad(column, dy);
			advance(16);
		}
		advance(3000);
		// It coasted on past the fingers' travel at UIKit's deceleration, much
		// farther than the platform's momentum. That momentum (66 px) never moves
		// it. It rests on a row there, committed once.
		expect(onChange).toHaveBeenCalledTimes(1);
		const [[rested]] = onChange.mock.calls as [[number]];
		expect(rested * ROW - atLift).toBeGreaterThan(5 * ROW);
		expect(distanceOf(option(String(rested).padStart(2, '0')))).toBeCloseTo(0, 1);
	});

	it('rests on the nearest row after a slow trackpad drag that stops, without coasting', async () => {
		const { column, option, onChange } = await renderWheel({
			options: MINUTES,
			value: 10,
			label: 'Minute'
		});
		const offsetOf = () => 10 * ROW - distanceOf(option('10'));
		// 2 px a frame for 20 frames, then the fingers stop on the pad.
		for (let i = 0; i < 20; i++) {
			trackpad(column, 2);
			advance(16);
		}
		const stopped = offsetOf();
		advance(3000);
		expect(onChange).toHaveBeenCalledTimes(1);
		const [[rested]] = onChange.mock.calls as [[number]];
		expect(Math.abs(rested * ROW - stopped)).toBeLessThanOrEqual(ROW / 2 + 1);
	});
});

describe('PickerWheel — a turn that a tap, a key or the program starts', () => {
	beforeEach(() => {
		installRecordingAnimations();
	});

	/** The strip goes from `from` to `to` on `springs.settle`, from rest. */
	function expectSpring(
		strip: { places: number[]; times: number[] },
		from: number,
		to: number
	): void {
		const spring = bounceCurve(from, 0, to, scaleFor(ROW), springs.settle);
		expect(strip.places[0]).toBeCloseTo(from, 1);
		let inside = 0;
		strip.times.forEach((t, i) => {
			// The strip draws whole pixels.
			expect(Math.abs(strip.places[i] - spring.value(t / 1000))).toBeLessThan(0.5);
			if (t > 0 && t < spring.duration * 1000) {
				inside++;
			}
		});
		expect(inside).toBeGreaterThanOrEqual(4);
	}

	function tap(column: HTMLElement, y: number): void {
		touch('touchstart', column, y);
		advance(60);
		touch('touchend', column, y);
	}

	it('turns onto a tapped row on the settle spring, from rest, and commits it on arrival', async () => {
		const { column, onChange } = await renderWheel();
		tap(column, CENTRE + ROW);
		const strips = stripAnimations();
		expect(strips).toHaveLength(1);
		expectSpring(strips[0], -10 * ROW, -11 * ROW);
		advance(turnMs(1) - 10);
		expect(onChange).not.toHaveBeenCalled();
		advance(20);
		expect(onChange).toHaveBeenCalledWith(11);
	});

	it('keeps the spring whatever the theme’s duration and easing tokens', async () => {
		// The wheel's main interaction is a gesture, so its turns spring
		// (spec:AST-094 FR45): the tokens of a tap-first motion do not time it.
		const { column } = await renderWheel();
		column.style.setProperty('--duration-medium', '0ms');
		column.style.setProperty('--ease-move', 'linear');
		tap(column, CENTRE + ROW);
		const strips = stripAnimations();
		expect(strips).toHaveLength(1);
		expectSpring(strips[0], -10 * ROW, -11 * ROW);
	});

	it('turns onto a value set from outside on the same spring (component:DateInput FR14)', async () => {
		const { rerender, onChange } = await renderWheel();
		advance(2000);
		animations.length = 0;
		await rerender({ value: 14 });
		const strips = stripAnimations();
		expect(strips).toHaveLength(1);
		expectSpring(strips[0], -10 * ROW, -14 * ROW);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('turns onto a key’s row on the same spring', async () => {
		const { column } = await renderWheel();
		keyDown(column, 'ArrowDown');
		const strips = stripAnimations();
		expect(strips).toHaveLength(1);
		expectSpring(strips[0], -10 * ROW, -11 * ROW);
	});

	it('keeps a fling’s measured coast', async () => {
		const { column } = await renderWheel({
			options: MINUTES,
			value: 10,
			label: 'Minute'
		});
		drag(column, 180, 60, { steps: 6, interval: 16 });
		const strips = stripAnimations();
		expect(strips.length).toBeGreaterThanOrEqual(1);
		const coast = strips[strips.length - 1];
		// A coast decelerates over seconds, far past the spring's turn.
		expect(coast.times.at(-1)).toBeGreaterThan(turnMs(15));
		advance(4000);
	});
});

describe('PickerWheel — under reduced motion', () => {
	const FADE_MS = timing.reducedMotionCrossFadeMs;

	beforeEach(() => {
		stubMedia({ reduced: true });
		installRecordingAnimations();
	});

	/**
	 * Nothing travels on the animator's Reduce Motion cross-fade
	 * (design:reduced-motion DR2). The strip's opacity dips out over half the
	 * fade, and its rows land on their row while it is transparent. No animation
	 * moves the strip.
	 */
	function expectFadesOnly(): void {
		expect(animations.length).toBeGreaterThan(0);
		for (const { keyframes } of animations) {
			const properties = new Set(
				keyframes.flatMap((frame) =>
					Object.keys(frame).filter((key) => key !== 'offset' && key !== 'easing')
				)
			);
			expect([...properties]).toEqual(['opacity']);
		}
		const [dip] = animations;
		const out = dip.keyframes.find((frame) => Number(frame.opacity) === 0);
		expect(out).toBeDefined();
		expect(Number(out?.offset) * Number(dip.options.duration)).toBeCloseTo(FADE_MS / 2, 0);
	}

	it('coasts a fling as momentum, its rows flat, then commits it', async () => {
		// design:reduced-motion DR2: the momentum that continues a throw is
		// direct movement, not a transition, so it plays.
		const { column, onChange } = await renderWheel({
			options: MINUTES,
			value: 10,
			label: 'Minute'
		});
		drag(column, 180, 60, { steps: 6, interval: 16 });
		expect(animations.length).toBeGreaterThan(0);
		for (const { keyframes, options } of animations) {
			expect(options.duration).toBeGreaterThan(FADE_MS);
			// The strip travels, and nothing fades.
			expect(keyframes.some((frame) => 'translate' in frame)).toBe(true);
			expect(keyframes.some((frame) => 'opacity' in frame)).toBe(false);
		}
		expect(onChange).not.toHaveBeenCalled();
		advance(4000);
		expect(onChange).toHaveBeenCalledTimes(1);
		// The row the fling projects, as without the preference.
		expect(onChange.mock.calls[0][0]).toBeGreaterThan(15);
	});

	it('fades a slow release onto its row', async () => {
		// A release that snaps is a transition the wheel starts: it cross-fades.
		const { column, onChange } = await renderWheel();
		drag(column, 60, 60 + 10 + 1.4 * ROW, { steps: 20, interval: 40, hold: 300 });
		expectFadesOnly();
		advance(FADE_MS);
		expect(onChange).toHaveBeenLastCalledWith(9);
	});

	it('fades for a spin', async () => {
		const onChange = vi.fn();
		const screen = await render(PickerWheelProbe, {
			props: { options: HOURS, value: 10, onChange }
		});
		let arrived: boolean | undefined;
		void screen.component.spinTo(15).then((value: boolean) => {
			arrived = value;
		});
		// The frame that commits the cross-fade dates its own end, so the
		// browser's start lands one frame inside the fade. Upstream's jsdom stub
		// starts synchronously; allow that frame.
		await advanceAsync(FADE_MS + 32);
		expect(arrived).toBe(true);
		expect(onChange).toHaveBeenLastCalledWith(15);
		expectFadesOnly();
	});

	it('fades for a tap and a key', async () => {
		const { column, onChange } = await renderWheel();
		const below = CENTRE + ROW;
		touch('touchstart', column, below);
		advance(60);
		touch('touchend', column, below);
		// One frame for the cross-fade's own start, as in the spin case.
		await advanceAsync(FADE_MS + 32);
		expect(onChange).toHaveBeenLastCalledWith(11);
		// A key steps from the row the wheel rests on (the tap's 11).
		keyDown(column, 'ArrowDown');
		expect(onChange).toHaveBeenLastCalledWith(12);
		await advanceAsync(FADE_MS + 32);
		expectFadesOnly();
	});
});

describe('PickerWheel — mechanics for its owners', () => {
	it('spins to a row on request and commits it there', async () => {
		const onChange = vi.fn();
		const screen = await render(PickerWheelProbe, {
			props: { options: HOURS, value: 10, onChange }
		});
		let arrived: boolean | undefined;
		void screen.component.spinTo(15).then((value: boolean) => {
			arrived = value;
		});
		advance(turnMs(5) + 10);
		await Promise.resolve();
		expect(arrived).toBe(true);
		expect(onChange).toHaveBeenCalledWith(15);
	});

	it('turns nothing and reports false for a spin onto a disabled row or outside the rows', async () => {
		// As the scrolling column answers.
		const onChange = vi.fn();
		const screen = await render(PickerWheelProbe, {
			props: { options: HOURS, value: 10, onChange }
		});
		for (const index of [3, 24, -1]) {
			let arrived: boolean | undefined;
			void screen.component.spinTo(index).then((value: boolean) => {
				arrived = value;
			});
			await Promise.resolve();
			expect(arrived, `spinTo(${index})`).toBe(false);
		}
		advance(1000);
		expect(onChange).not.toHaveBeenCalled();
		expect(distanceOf(optionOf(columnOf(screen.container), '10'))).toBeCloseTo(0, 4);
	});

	it('reports false for a spin still turning when the wheel goes away', async () => {
		const screen = await render(PickerWheelProbe, {
			props: { options: HOURS, value: 10, onChange: vi.fn() }
		});
		const spin = screen.component.spinTo(15);
		advance(100);
		await screen.unmount();
		await expect(spin).resolves.toBe(false);
	});

	it('reports a spin a finger interrupted', async () => {
		const screen = await render(PickerWheelProbe, {
			props: { options: HOURS, value: 10, onChange: vi.fn() }
		});
		const column = columnOf(screen.container);
		column.getBoundingClientRect = () =>
			({
				top: 0,
				height: 216,
				width: 120,
				left: 0,
				right: 120,
				bottom: 216,
				x: 0,
				y: 0
			}) as DOMRect;
		let arrived: boolean | undefined;
		void screen.component.spinTo(15).then((value: boolean) => {
			arrived = value;
		});
		advance(100);
		touch('touchstart', column, 100);
		await Promise.resolve();
		expect(arrived).toBe(false);
	});

	it('keeps a spin going when its owner re-renders the rows mid-turn', async () => {
		const onChange = vi.fn();
		const screen = await render(PickerWheelProbe, {
			props: { options: MINUTES, value: 15, onChange, label: 'Minute' }
		});
		let arrived: boolean | undefined;
		void screen.component.spinTo(30).then((value: boolean) => {
			arrived = value;
		});
		advance(100);
		// The owner commits a time on its bound: the minutes before 30 are
		// disabled now. The same row nodes come back, so the turn goes on.
		await screen.rerender({
			options: MINUTES.map((option) => ({ ...option, isDisabled: option.value < 30 })),
			value: 30
		});
		// Just past the turn's end: a turn the re-render started again would
		// still be running.
		advance(turnMs(15) - 100 + 10);
		await Promise.resolve();
		expect(arrived).toBe(true);
	});

	it('keeps a finger that lands on it from an enclosing sheet', async () => {
		// A sheet arms its pull-down on its body's pointerdown.
		const onPointerDown = vi.fn();
		const onChange = vi.fn();
		const screen = await render(PickerWheelProbe, {
			props: { options: MINUTES, value: 10, onChange }
		});
		screen.container.addEventListener('pointerdown', onPointerDown);
		const column = columnOf(screen.container);
		flushSync(() => {
			column.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					cancelable: true,
					pointerId: 7,
					pointerType: 'touch',
					isPrimary: true,
					button: 0
				})
			);
		});
		expect(onPointerDown).not.toHaveBeenCalled();
	});

	it('keeps coasting when its owner hands it a copy of the same rows', async () => {
		const { column, rerender, onChange } = await renderWheel({
			options: MINUTES,
			value: 10,
			label: 'Minute'
		});
		drag(column, 180, 60, { steps: 6, interval: 16 });
		advance(200);
		await rerender({ options: MINUTES.map((option) => ({ ...option })) });
		advance(4000);
		// It came to rest on a row and committed it, as without the re-render.
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange.mock.calls[0][0]).toBeGreaterThan(15);
	});
});

describe('PickerWheel — markup', () => {
	it('fades its rows on a layer inside the column, so the focus ring the column draws stays whole', async () => {
		const { column } = await renderWheel();
		const fade = column.querySelector('[data-wheel-fade]');
		expect(fade).not.toBeNull();
		expect(fade?.parentElement).toBe(column);
		expect(fade?.querySelector('[data-wheel-strip]')).not.toBeNull();
	});

	it('keeps the touch column’s markup', async () => {
		const { column } = await renderWheel();
		// A structural snapshot rather than upstream's literal one: the ids
		// Svelte generates and the debug class names differ by construction.
		expect(column.getAttribute('data-wheel')).toBe('');
		expect(column.getAttribute('role')).toBe('listbox');
		expect(column.getAttribute('aria-label')).toBe('Hour');
		expect(column.getAttribute('aria-activedescendant')).toBe(optionOf(column, '10').id);
		expect(column.getAttribute('tabindex')).toBe('0');
		const fade = column.firstElementChild as HTMLElement;
		expect(fade.getAttribute('data-wheel-fade')).toBe('');
		const band = fade.firstElementChild as HTMLElement;
		expect(band.getAttribute('aria-hidden')).toBe('true');
		const strip = fade.lastElementChild as HTMLElement;
		expect(strip.getAttribute('data-wheel-strip')).toBe('');
		const rows = [...strip.children] as HTMLElement[];
		expect(rows).toHaveLength(24);
		expect(rows.map((row) => row.getAttribute('data-label'))).toEqual(
			HOURS.map((option) => option.label)
		);
		expect(rows.every((row) => row.getAttribute('role') === 'option')).toBe(true);
		expect(rows.every((row) => row.getAttribute('data-wheel-row') === '')).toBe(true);
		expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual(
			HOURS.map((option) => String(option.value === 10))
		);
	});
});
