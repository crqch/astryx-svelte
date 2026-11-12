/** PORTS: SnapPaging/SnapPaging.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import {
	isSnapPaging,
	makeSnapPaging,
	type HeldRow,
	type HeldRowListener,
	type SnapPagingAttachment
} from '$lib/components/snap-paging/snap-paging-value.js';
import SnapPagingCarouselProbe from './fixtures/snap-paging-carousel-probe.svelte';
import SnapPagingValueProbe from './fixtures/snap-paging-value-probe.svelte';

/**
 * Astryx's `SnapPaging/SnapPaging.test.tsx`, the Carousel-facing half.
 *
 * The other half — the value's stop arithmetic and held-row geometry — lives in
 * `snap-paging-value.svelte.test.ts`. This file proves the hook in the
 * data-driven Carousel: the value is stable, attaching is once-only, dropping
 * the value or unmounting removes every listener, edge presses and `scrollTo`
 * go through the paging, and the nav buttons follow a held row.
 */

const attachment = (detach = () => {}): SnapPagingAttachment => ({
	detach,
	move: () => {},
	moveHeld: () => false
});

/** The touch-action the gesture host derived for `element`, '' for none. */
const touchAction = (element: HTMLElement) =>
	element.getAttribute('data-astryx-touch-action') ?? '';

const isDisabled = (button: Element) => button.getAttribute('aria-disabled') === 'true';

function scroller(container: HTMLElement): HTMLElement {
	const region = container.querySelector('[role="region"][aria-label="Items"]');
	const found = region?.querySelector('.astryx-carousel-scroller');
	if (!(found instanceof HTMLElement)) throw new Error('expected a carousel scroller');
	return found;
}

function navButton(container: HTMLElement, label: string): HTMLElement {
	const found = [...container.querySelectorAll('button')].find(
		(button) => button.getAttribute('aria-label') === label
	);
	if (!(found instanceof HTMLElement)) throw new Error(`expected a ${label} button`);
	return found;
}

beforeEach(() => {
	// jsdom defines `ontouchstart`; a desktop browser does not. The gesture
	// host's touch-action mark needs no touch support, but attachPaging's
	// listeners are the same either way.
	Object.defineProperty(window, 'ontouchstart', { configurable: true, value: null });
});

afterEach(() => {
	delete (window as { ontouchstart?: unknown }).ontouchstart;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('useSnapPaging', () => {
	it('returns one value for the component’s life, which only Carousel reads', async () => {
		const screen = await render(SnapPagingValueProbe, { props: { pages: 'view' } });
		const first = screen.component.getValue();
		expect(isSnapPaging(first)).toBe(true);
		await screen.rerender({ pages: 'item' });
		expect(screen.component.getValue()).toBe(first);
		expect(isSnapPaging({})).toBe(false);
	});

	it('is the entry’s only export: no create… equivalent feeds anything else', async () => {
		const entry = await import('$lib/components/snap-paging/index.js');
		expect(Object.keys(entry)).toEqual(['useSnapPaging']);
	});
});

describe('Carousel with hasSnap', () => {
	it('hands its scroll area to the hook’s value under every pointer, a fine one included', async () => {
		const value = (await import('$lib/components/snap-paging/snap-paging.js')).useSnapPaging();
		const screen = await render(SnapPagingCarouselProbe, { props: { hasSnap: value } });
		const element = scroller(screen.container);
		await vi.waitFor(() => expect(touchAction(element)).toBe('pan-y pinch-zoom'));
		screen.unmount();
	});

	it('removes every listener it added to the scroll area when Carousel drops the value or unmounts', async () => {
		const log: { isAdd: boolean; target: EventTarget; type: string; listener: unknown }[] = [];
		const realAdd = EventTarget.prototype.addEventListener;
		const realRemove = EventTarget.prototype.removeEventListener;
		const add = vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function (
			this: EventTarget,
			type,
			listener,
			opts
		) {
			log.push({ isAdd: true, target: this, type, listener });
			realAdd.call(this, type, listener, opts);
		});
		const remove = vi
			.spyOn(EventTarget.prototype, 'removeEventListener')
			.mockImplementation(function (this: EventTarget, type, listener, opts) {
				log.push({ isAdd: false, target: this, type, listener });
				realRemove.call(this, type, listener, opts);
			});
		try {
			const value = (await import('$lib/components/snap-paging/snap-paging.js')).useSnapPaging();
			const screen = await render(SnapPagingCarouselProbe, { props: { hasSnap: true } });
			const element = scroller(screen.container);
			const live = (since: number) => {
				const ids = new Map<unknown, number>();
				const keyOf = (type: string, listener: unknown) => {
					if (!ids.has(listener)) ids.set(listener, ids.size);
					return `${type}|${ids.get(listener)}`;
				};
				const keys = new Set<string>();
				for (const entry of log.slice(since)) {
					if (entry.target !== element) continue;
					const key = keyOf(entry.type, entry.listener);
					if (entry.isAdd) keys.add(key);
					else keys.delete(key);
				}
				return [...keys];
			};
			let since = log.length;
			await screen.rerender({ hasSnap: value });
			await vi.waitFor(() => expect(touchAction(element)).toBe('pan-y pinch-zoom'));
			expect(live(since).length).toBeGreaterThan(0);
			await screen.rerender({ hasSnap: true });
			await vi.waitFor(() => expect(touchAction(element)).toBe(''));
			expect(live(since)).toEqual([]);
			since = log.length;
			await screen.rerender({ hasSnap: value });
			await vi.waitFor(() => expect(live(since).length).toBeGreaterThan(0));
			screen.unmount();
			expect(live(since)).toEqual([]);
		} finally {
			add.mockRestore();
			remove.mockRestore();
		}
	});

	it('runs no gesture code with hasSnap alone', async () => {
		const screen = await render(SnapPagingCarouselProbe, { props: { hasSnap: true } });
		expect(touchAction(scroller(screen.container))).toBe('');
	});

	it('snaps alike with hasSnap and with a paging value, and not without either', async () => {
		const value = makeSnapPaging(() => attachment());
		const classes = async (hasSnap?: boolean | typeof value) => {
			const screen = await render(SnapPagingCarouselProbe, { props: { hasSnap } });
			const className = scroller(screen.container).className;
			screen.unmount();
			return className;
		};
		const snapped = await classes(true);
		expect(await classes(value)).toBe(snapped);
		expect(await classes(false)).not.toBe(snapped);
		expect(await classes(undefined)).toBe(await classes(false));
	});

	it('attaches once: a new paging value on a later render attaches nothing again', async () => {
		const attached: string[] = [];
		const first = makeSnapPaging(() => {
			attached.push('first');
			return attachment(() => attached.push('first detached'));
		});
		const second = makeSnapPaging(() => {
			attached.push('second');
			return attachment(() => attached.push('second detached'));
		});
		const screen = await render(SnapPagingCarouselProbe, { props: { hasSnap: first } });
		await vi.waitFor(() => expect(attached).toEqual(['first']));
		await screen.rerender({ hasSnap: second });
		expect(attached).toEqual(['first']);
		screen.unmount();
		expect(attached).toEqual(['first', 'first detached']);
	});

	describe('a scroll call under snap paging', () => {
		function valueRecordingMoves(moves: ((at: number, end: number) => number)[]) {
			return makeSnapPaging(() => ({
				...attachment(),
				move: (target) => {
					moves.push(target);
				}
			}));
		}

		it('moves the row at rest through the paging, not with a native smooth scroll', async () => {
			const moves: ((at: number, end: number) => number)[] = [];
			const value = valueRecordingMoves(moves);
			const screen = await render(SnapPagingCarouselProbe, {
				props: { hasSnap: value, count: 3 }
			});
			const row = scroller(screen.container);
			const scrollTo = vi.fn();
			const scrollBy = vi.fn();
			row.scrollTo = scrollTo;
			row.scrollBy = scrollBy;
			screen.component.getCarousel()?.scrollNext();
			screen.component.getCarousel()?.scrollPrev();
			expect(moves).toHaveLength(2);
			expect(scrollTo).not.toHaveBeenCalled();
			expect(scrollBy).not.toHaveBeenCalled();
		});

		it('moves the row through the paging for a scroll to an item', async () => {
			const moves: ((at: number, end: number) => number)[] = [];
			const value = valueRecordingMoves(moves);
			const screen = await render(SnapPagingCarouselProbe, {
				props: { hasSnap: value, count: 3 }
			});
			const row = scroller(screen.container);
			const scrollTo = vi.fn();
			const scrollBy = vi.fn();
			row.scrollTo = scrollTo;
			row.scrollBy = scrollBy;
			screen.component.getCarousel()?.scrollTo(2);
			expect(moves).toHaveLength(1);
			expect(scrollTo).not.toHaveBeenCalled();
			expect(scrollBy).not.toHaveBeenCalled();
		});

		it('moves a scroll to an item onto its snap stop, inside the scroll padding', async () => {
			const moves: ((at: number, end: number) => number)[] = [];
			const value = valueRecordingMoves(moves);
			const screen = await render(SnapPagingCarouselProbe, {
				props: { hasSnap: value, count: 3 }
			});
			const row = scroller(screen.container);
			row.style.setProperty('scroll-padding-left', '16px');
			row.getBoundingClientRect = () => new DOMRect(0, 0, 300, 100);
			Object.defineProperty(row, 'offsetWidth', { configurable: true, value: 300 });
			Object.defineProperty(row, 'clientWidth', { configurable: true, value: 300 });
			Array.from(row.children).forEach((child, i) => {
				(child as HTMLElement).getBoundingClientRect = () => new DOMRect(i * 100, 0, 100, 100);
			});
			screen.component.getCarousel()?.scrollTo(2);
			expect(moves[0](0, 500)).toBe(184);
		});
	});

	describe('the edge buttons follow a held row as shown', () => {
		async function renderHeld() {
			let listener: HeldRowListener | undefined;
			const value = makeSnapPaging((_element, onHeld) => {
				listener = onHeld;
				return attachment();
			});
			const screen = await render(SnapPagingCarouselProbe, {
				props: { hasSnap: value, count: 3 }
			});
			await vi.waitFor(() => expect(listener).toBeTypeOf('function'));
			return {
				screen,
				report: async (held: HeldRow | null) => {
					listener?.(held);
					await tick();
				},
				start: navButton(screen.container, 'Scroll left'),
				end: navButton(screen.container, 'Scroll right')
			};
		}

		it('enables and disables each button as the held row leaves or reaches its edge, before the hand-back', async () => {
			const { report, start, end } = await renderHeld();
			expect([isDisabled(start), isDisabled(end)]).toEqual([true, true]);
			await report({ offset: 0, travel: 600 });
			expect([isDisabled(start), isDisabled(end)]).toEqual([true, false]);
			await report({ offset: 300, travel: 600 });
			expect([isDisabled(start), isDisabled(end)]).toEqual([false, false]);
			await report({ offset: 599.5, travel: 600 });
			expect([isDisabled(start), isDisabled(end)]).toEqual([false, true]);
		});

		it('keeps the held edges for one frame after the hand-back, then reads the scroll offset again', async () => {
			const { report, start } = await renderHeld();
			await report({ offset: 300, travel: 600 });
			await report({ offset: 300, travel: 600 });
			await report(null);
			expect(isDisabled(start)).toBe(false);
			await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
			await tick();
			expect(isDisabled(start)).toBe(true);
		});

		it('hands focus to the scroll area once, when the held row reaches the edge of the focused button', async () => {
			const { screen, report, end } = await renderHeld();
			await report({ offset: 300, travel: 600 });
			end.focus();
			await tick();
			const row = scroller(screen.container);
			const focus = vi.spyOn(row, 'focus');
			await report({ offset: 600, travel: 600 });
			expect(focus).toHaveBeenCalledTimes(1);
			expect(document.activeElement).toBe(row);
			await report({ offset: 600, travel: 600 });
			expect(focus).toHaveBeenCalledTimes(1);
		});
	});
});
