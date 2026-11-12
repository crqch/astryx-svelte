/** PORTS: DateInput/MonthScroller.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import MonthScroller from '$lib/components/date-input/month-scroller.svelte';
import { createMonthModel } from '$lib/components/date-input/month-geometry.js';
import { fakeAnimate, type FakeAnimation } from './fake-web-animation.js';

/**
 * Astryx's `DateInput/MonthScroller.test.tsx`, all seven declarations.
 *
 * The React suite calls an imperative handle; this component exposes
 * `scrollToMonth` on its instance, which `bind:this`/`render().component`
 * reaches. The React `act` wrapper becomes `tick()` plus the fake animation's
 * own settled promise.
 */

/**
 * A touch screen with Reduced Motion on: the policy's combined query
 * (motion/reduced-motion.ts) and the coarse pointer both match.
 */
function stubReducedMotionTouch(): void {
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query.includes('prefers-reduced-motion: reduce') || /pointer:\s*coarse/.test(query),
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false
	}));
}

class FakeResizeObserver {
	constructor(private callback: ResizeObserverCallback) {}
	observe() {
		this.callback([], this as unknown as ResizeObserver);
	}
	unobserve() {}
	disconnect() {}
}

describe('MonthScroller under Reduced Motion on a touch screen', () => {
	const scrollTo = vi.fn();
	// The dips' animations, in order. A fade-out ends only when a test ends it.
	let animations: FakeAnimation[] = [];

	/** The newest dip's fade-out ends: its step lands. */
	async function endFadeOut(): Promise<void> {
		animations[animations.length - 1].finish();
		await tick();
		await Promise.resolve();
		await tick();
	}

	beforeEach(() => {
		stubReducedMotionTouch();
		vi.stubGlobal('ResizeObserver', FakeResizeObserver);
		vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
		vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
		Element.prototype.scrollTo = scrollTo as unknown as Element['scrollTo'];
		const fake = fakeAnimate();
		Element.prototype.animate = fake.animate;
		animations = fake.animations;
		scrollTo.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	async function renderScroller({
		onVisibleMonthChange = () => {}
	}: { onVisibleMonthChange?: (monthIndex: number) => void } = {}) {
		const screen = await render(MonthScroller, {
			props: {
				monthModel: createMonthModel('gregory'),
				minMonthIndex: 0,
				maxMonthIndex: 23,
				initialMonthIndex: 9,
				onVisibleMonthChange,
				selectedDate: null,
				today: { year: 2026, month: 10, day: 15 },
				isDateDisabled: () => false,
				weekStartsOn: 0,
				onSelect: () => {}
			}
		});
		await tick();
		await tick();
		scrollTo.mockClear();
		return screen;
	}

	it('lets a second step within the dip replace the first: only its scroll lands', async () => {
		const screen = await renderScroller();
		screen.component.scrollToMonth(10);
		const first = animations[0];
		screen.component.scrollToMonth(11);
		expect(first.cancel).toHaveBeenCalled();
		// The replaced dip's fade-out ending lands nothing.
		first.finish();
		await tick();
		await Promise.resolve();
		expect(scrollTo).not.toHaveBeenCalled();
		await endFadeOut();
		expect(scrollTo).toHaveBeenCalledTimes(1);
	});

	it('lands a step to another month before its fade-in starts', async () => {
		const screen = await renderScroller();
		const order: string[] = [];
		scrollTo.mockImplementation(() => {
			order.push('scroll');
		});
		const fake = fakeAnimate();
		Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
			order.push('animate');
			return fake.animate.apply(this, args);
		};
		screen.component.scrollToMonth(10);
		expect(order).toEqual(['animate']);
		fake.animations[0].finish();
		await tick();
		await Promise.resolve();
		await tick();
		expect(order).toEqual(['animate', 'scroll', 'animate']);
	});

	it('lands a step only when its fade-out ends, however late its frame comes', async () => {
		const screen = await renderScroller();
		screen.component.scrollToMonth(10);
		await new Promise((resolve) => setTimeout(resolve, 80));
		expect(scrollTo).not.toHaveBeenCalled();
		await endFadeOut();
		expect(scrollTo).toHaveBeenCalledTimes(1);
	});

	it('keeps a jump to a distant month made within the dip: the dip does not land after it', async () => {
		const screen = await renderScroller();
		screen.component.scrollToMonth(10);
		const dip = animations[0];
		// Eleven months on: beyond the mounted window, so it jumps at once.
		screen.component.scrollToMonth(20);
		dip.finish();
		await tick();
		await Promise.resolve();
		expect(scrollTo.mock.calls.map(([options]) => (options as ScrollToOptions).left)).toEqual([
			20 * 300
		]);
	});

	it('keeps a step at once made within the dip: the dip does not land after it', async () => {
		const screen = await renderScroller();
		screen.component.scrollToMonth(10);
		const dip = animations[0];
		screen.component.scrollToMonth(8, 'auto');
		dip.finish();
		await tick();
		await Promise.resolve();
		expect(scrollTo.mock.calls.map(([options]) => (options as ScrollToOptions).left)).toEqual([
			8 * 300
		]);
	});

	it('reports a trackpad scroll after a step lands, even with an earlier steer that never arrived', async () => {
		const onVisibleMonthChange = vi.fn();
		const screen = await renderScroller({ onVisibleMonthChange });
		const scroller = screen.container.querySelector<HTMLElement>('[data-scroller="months"]');
		if (scroller == null) {
			throw new Error('no scroller');
		}
		// The re-assert when the wheels close: a steer to the month already in
		// view, whose scroll never arrives.
		screen.component.scrollToMonth(9, 'auto');
		// A step lands at its dip's middle.
		screen.component.scrollToMonth(10);
		await endFadeOut();
		// A trackpad scroll on to the next month: no touch ends the steer.
		scroller.scrollLeft = 11 * 300;
		scroller.dispatchEvent(new Event('scroll'));
		await new Promise((resolve) => setTimeout(resolve, 80));
		expect(onVisibleMonthChange).toHaveBeenLastCalledWith(11);
	});

	it('scrolls nothing once unmounted within the dip', async () => {
		const screen = await renderScroller();
		screen.component.scrollToMonth(10);
		screen.unmount();
		expect(animations[0].cancel).toHaveBeenCalled();
		await endFadeOut();
		expect(scrollTo).not.toHaveBeenCalled();
	});
});
