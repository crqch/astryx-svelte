/** PORTS: SnapPaging/SnapPaging.test.tsx */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	attachSnapPaging,
	itemsSpan,
	makeSnapPaging,
	moveHeldSnapPaging,
	moveSnapPaging,
	nearestStop,
	snapPages,
	snapStops
} from '$lib/components/snap-paging/snap-paging-value.js';

/**
 * Astryx's `SnapPaging/SnapPaging.test.tsx`, the half that does not render a
 * Carousel: the value's stop arithmetic, the row's held geometry, and the
 * attach/move relay. The Carousel-facing cases (value stability, attaching
 * once, scroll calls, focus hand-back) live with the Carousel integration and
 * are listed in `port/status.md` until it lands.
 */

afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('the value and its stops', () => {
	it('nearestStop picks the nearest stop, and keeps the offset with no items', () => {
		expect(nearestStop([0, 103, 205], 120)).toBe(103);
		expect(nearestStop([], 42)).toBe(42);
	});

	describe('the end page', () => {
		// A row 299 px wide holds seven items 94.67 px wide and 8 px apart. The
		// fifth item's stop, 410.67, sits 1.33 px before the row's end.
		function row() {
			const element = document.createElement('div');
			// jsdom lays nothing out; a browser does. The row is its rect's width,
			// so the rect-to-layout scale is 1 here as it is there.
			Object.defineProperty(element, 'offsetWidth', { value: 299 });
			Object.defineProperty(element, 'clientWidth', { value: 299 });
			const box = { left: 0, right: 299, width: 299 } as DOMRect;
			element.getBoundingClientRect = () => box;
			for (let i = 0; i < 7; i++) {
				const item = document.createElement('div');
				const left = i * (94.67 + 8);
				item.getBoundingClientRect = () => ({ left, right: left + 94.67, width: 94.67 }) as DOMRect;
				element.append(item);
			}
			document.body.append(element);
			return element;
		}
		const rounded = (stops: number[]) => stops.map((stop) => Math.round(stop));

		it('a stop within half its preceding step of the end is the end page, which rests where the row ends', () => {
			expect(rounded(snapStops(row(), 0, 412))).toEqual([0, 103, 205, 308, 412]);
		});

		it('native snap skips that stop until the stop is further from the end than half its step', () => {
			const element = row();
			expect(snapPages(element, 0, 412).skipped).toEqual([element.children[4]]);
			const split = snapPages(element, 0, 471);
			expect(rounded(split.stops)).toEqual([0, 103, 205, 308, 411, 471]);
			expect(split.skipped).toEqual([]);
		});
	});

	describe("a held row's stops", () => {
		function heldRow(isRtl: boolean) {
			const element = document.createElement('div');
			element.style.direction = isRtl ? 'rtl' : 'ltr';
			Object.defineProperty(element, 'offsetWidth', { value: 300 });
			Object.defineProperty(element, 'clientWidth', { value: 300 });
			element.getBoundingClientRect = () => new DOMRect(0, 0, 300, 100);
			let clock = 0;
			const translate = () => (isRtl ? 1 : -1) * (30 + 0.3 * clock);
			const items = new Set<Element>();
			for (let i = 0; i < 7; i++) {
				const item = document.createElement('div');
				const start = i * (94.67 + 8);
				item.getBoundingClientRect = () => {
					clock += 1;
					const left = isRtl ? 300 - start - 94.67 : start;
					return new DOMRect(left + translate(), 0, 94.67, 100);
				};
				items.add(item);
				element.append(item);
			}
			const readStyle = window.getComputedStyle.bind(window);
			vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) =>
				items.has(target)
					? ({ translate: `${translate()}px` } as CSSStyleDeclaration)
					: readStyle(target, pseudo)
			);
			document.body.append(element);
			return element;
		}
		const layoutStops = [0, 1, 2, 3, 4].map((i) => i * (94.67 + 8));

		for (const isRtl of [false, true]) {
			it(`${isRtl ? 'right to left' : 'left to right'}, take each item's translate off its rect: rects read at different times give the layout's stops`, () => {
				const { stops } = snapPages(heldRow(isRtl), 0, 411, true);
				expect(stops.slice(0, 5)).toHaveLength(5);
				stops.slice(0, 5).forEach((stop, i) => {
					expect(stop).toBeCloseTo(layoutStops[i], 6);
				});
			});
		}

		it("a translate that moves between an item's rect and its own read is read again: the stops stay the layout's", () => {
			const element = document.createElement('div');
			Object.defineProperty(element, 'offsetWidth', { value: 300 });
			Object.defineProperty(element, 'clientWidth', { value: 300 });
			element.getBoundingClientRect = () => new DOMRect(0, 0, 300, 100);
			let translate = -30;
			let isMoved = false;
			const items = new Set<Element>();
			for (let i = 0; i < 7; i++) {
				const item = document.createElement('div');
				const start = i * (94.67 + 8);
				item.getBoundingClientRect = () => {
					const rect = new DOMRect(start + translate, 0, 94.67, 100);
					if (i === 3 && !isMoved) {
						isMoved = true;
						translate -= 1.27;
					}
					return rect;
				};
				items.add(item);
				element.append(item);
			}
			const readStyle = window.getComputedStyle.bind(window);
			vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) =>
				items.has(target)
					? ({ translate: `${translate}px` } as CSSStyleDeclaration)
					: readStyle(target, pseudo)
			);
			document.body.append(element);
			const { stops } = snapPages(element, 0, 411, true);
			expect(isMoved).toBe(true);
			stops.slice(0, 5).forEach((stop, i) => {
				expect(stop).toBeCloseTo(layoutStops[i], 6);
			});
		});
	});

	describe("a held row's span", () => {
		function movingRow(scale = 1) {
			const element = document.createElement('div');
			Object.defineProperty(element, 'offsetWidth', { value: 300 });
			element.getBoundingClientRect = () => new DOMRect(0, 0, 300 * scale, 100 * scale);
			let clock = 0;
			const translate = () => -280 - 0.3 * clock;
			const items = new Set<Element>();
			for (let i = 0; i < 7; i++) {
				const item = document.createElement('div');
				const left = i * (94.67 + 8);
				item.getBoundingClientRect = () => {
					clock += 1;
					return new DOMRect((left + translate()) * scale, 0, 94.67 * scale, 100 * scale);
				};
				items.add(item);
				element.append(item);
			}
			const readStyle = window.getComputedStyle.bind(window);
			vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) =>
				items.has(target)
					? ({ translate: `${translate()}px` } as CSSStyleDeclaration)
					: readStyle(target, pseudo)
			);
			document.body.append(element);
			return element;
		}
		const layoutSpan = 6 * (94.67 + 8) + 94.67;

		it('takes each item’s translate off its rect, so rects read at different times give the layout’s span', () => {
			expect(itemsSpan(movingRow(), true)).toBeCloseTo(layoutSpan, 6);
		});

		it('under a scaled row takes the scale off each rect before its translate', () => {
			expect(itemsSpan(movingRow(2), true)).toBeCloseTo(layoutSpan, 6);
		});

		it("reads an item again when its translate moves between its rect and its own read, so the span stays the layout's", () => {
			const element = document.createElement('div');
			Object.defineProperty(element, 'offsetWidth', { value: 300 });
			element.getBoundingClientRect = () => new DOMRect(0, 0, 300, 100);
			let translate = -280;
			let isMoved = false;
			const items = new Set<Element>();
			for (let i = 0; i < 7; i++) {
				const item = document.createElement('div');
				const left = i * (94.67 + 8);
				item.getBoundingClientRect = () => {
					const rect = new DOMRect(left + translate, 0, 94.67, 100);
					if (i === 6 && !isMoved) {
						isMoved = true;
						translate -= 1.27;
					}
					return rect;
				};
				items.add(item);
				element.append(item);
			}
			const readStyle = window.getComputedStyle.bind(window);
			vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) =>
				items.has(target)
					? ({ translate: `${translate}px` } as CSSStyleDeclaration)
					: readStyle(target, pseudo)
			);
			document.body.append(element);
			expect(itemsSpan(element, true)).toBeCloseTo(layoutSpan, 6);
			expect(isMoved).toBe(true);
		});

		it('at rest reads the rects as they are', () => {
			const element = movingRow();
			expect(Math.abs(itemsSpan(element) - layoutSpan)).toBeGreaterThan(1);
		});
	});

	it('relays attach, move and a held move through the value', () => {
		const moved: ((at: number, end: number) => number)[] = [];
		const held: ((at: number, end: number) => number)[] = [];
		let detached = 0;
		const value = makeSnapPaging(() => ({
			detach: () => {
				detached += 1;
			},
			move: (target) => moved.push(target),
			moveHeld: (target) => {
				held.push(target);
				return true;
			}
		}));
		const element = document.createElement('div');
		document.body.append(element);
		const detach = attachSnapPaging(value, element);
		const target = (at: number) => at + 1;
		expect(moveSnapPaging(element, target)).toBe(true);
		expect(moveHeldSnapPaging(element, target)).toBe(true);
		detach();
		expect(detached).toBe(1);
		expect(moved).toEqual([target]);
		expect(held).toEqual([target]);
		expect(moveSnapPaging(element, target)).toBe(false);
		expect(moveHeldSnapPaging(element, target)).toBe(false);
	});
});
