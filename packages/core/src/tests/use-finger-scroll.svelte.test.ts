/** PORTS: gestures/__tests__/useFingerScroll.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getGestureHost } from '$lib/gestures/gesture-host.js';
import { isFingerScroll } from '$lib/gestures/finger-scroll.js';
import FingerScrollProbe from './fixtures/finger-scroll-probe.svelte';
import { coarsePrimaryPointer, pointerQuery } from './gestures/pointer-query.js';

/**
 * Astryx's `gestures/__tests__/useFingerScroll.test.tsx`, all fifteen
 * declarations. This port's hook takes a getter instead of a ref, so the probe
 * binds its own element and the "moves to another node" cases pass the node in.
 */

function touch(type: string, target: Element, down: boolean): void {
	const event = new Event(type, { bubbles: true, cancelable: true });
	const entry = { identifier: 1, clientX: 5, clientY: 5, target };
	Object.defineProperty(event, 'changedTouches', { value: [entry] });
	Object.defineProperty(event, 'touches', { value: down ? [entry] : [] });
	target.dispatchEvent(event);
}

function part(container: HTMLElement, id: string): HTMLElement {
	const found = container.querySelector(`[data-testid="${id}"]`);
	if (!(found instanceof HTMLElement)) throw new Error(`expected ${id}`);
	return found;
}

/** A scroller the test keeps in the page while the hook moves off it. */
function scroller(): { element: HTMLElement; row: HTMLElement } {
	const element = document.createElement('div');
	const row = document.createElement('p');
	element.append(row);
	document.body.append(element);
	return { element, row };
}

/** A finger scrolling `element` from `row`, left resting. */
function fingerScroll(element: Element, row: Element): void {
	touch('touchstart', row, true);
	element.dispatchEvent(new Event('scroll'));
}

/** The finger lifted and the scroll ended. */
function lift(element: Element, row: Element): void {
	touch('touchend', row, false);
	element.dispatchEvent(new Event('scrollend'));
}

const ends: { count: number; readAtEnd: boolean[] } = { count: 0, readAtEnd: [] };

let restorePointer: () => void;

beforeEach(() => {
	Object.defineProperty(window, 'ontouchstart', { configurable: true, value: null });
	restorePointer = coarsePrimaryPointer();
});

afterEach(() => {
	restorePointer();
	delete (window as { ontouchstart?: unknown }).ontouchstart;
	document.body.replaceChildren();
	ends.count = 0;
	ends.readAtEnd = [];
});

async function renderProbe(
	props: {
		kind?: 'list' | 'section' | 'page';
		watchers?: number;
		external?: Element | null;
	} = {},
	withEnd = false
) {
	let screen: Awaited<ReturnType<typeof render>>;
	const onEnd = withEnd
		? () => {
				ends.count += 1;
				ends.readAtEnd.push(screen.component.getRead()());
			}
		: undefined;
	screen = await render(FingerScrollProbe, { props: { ...props, onEnd } });
	return screen;
}

describe('useFingerScroll', () => {
	it('is internal: the package root exports neither the hook nor the watch', async () => {
		// This port has no gestures barrel; the package root is the public entry.
		const gestures: Record<string, unknown> = await import('$lib/index.js');
		expect(gestures).not.toHaveProperty('useFingerScroll');
		expect(gestures).not.toHaveProperty('isFingerScroll');
		expect(gestures).not.toHaveProperty('watchFingerScrolls');
	});

	it("reads a finger's scroll until the scroller's scrollend, and the program's as false", async () => {
		const screen = await renderProbe();
		const list = part(screen.container, 'list');
		const read = screen.component.getRead();
		list.dispatchEvent(new Event('scroll'));
		expect(read()).toBe(false);
		touch('touchstart', part(screen.container, 'row'), true);
		list.dispatchEvent(new Event('scroll'));
		expect(read()).toBe(true);
		touch('touchend', part(screen.container, 'row'), false);
		list.dispatchEvent(new Event('scroll'));
		expect(read()).toBe(true);
		list.dispatchEvent(new Event('scrollend'));
		expect(read()).toBe(false);
	});

	it("reads a time inside a finger's scroll as the finger's after it ends, and a program scroll right after as the program's", async () => {
		const now = vi.spyOn(window.performance, 'now').mockReturnValue(100);
		try {
			const screen = await renderProbe();
			const list = part(screen.container, 'list');
			const row = part(screen.container, 'row');
			const read = screen.component.getRead();
			touch('touchstart', row, true);
			now.mockReturnValue(120);
			list.dispatchEvent(new Event('scroll'));
			now.mockReturnValue(150);
			touch('touchend', row, false);
			now.mockReturnValue(200);
			list.dispatchEvent(new Event('scrollend'));
			expect(read()).toBe(false);
			expect(read(99)).toBe(false);
			expect(read(130)).toBe(true);
			expect(read(200)).toBe(true);
			now.mockReturnValue(210);
			list.dispatchEvent(new Event('scroll'));
			expect(read()).toBe(false);
			expect(read(216)).toBe(false);
		} finally {
			now.mockRestore();
		}
	});

	it("keeps a scroll that ended under the resting finger the finger's at any time up to the lift", async () => {
		const now = vi.spyOn(window.performance, 'now').mockReturnValue(100);
		try {
			const screen = await renderProbe();
			const list = part(screen.container, 'list');
			const row = part(screen.container, 'row');
			const read = screen.component.getRead();
			touch('touchstart', row, true);
			now.mockReturnValue(110);
			list.dispatchEvent(new Event('scroll'));
			now.mockReturnValue(120);
			list.dispatchEvent(new Event('scrollend'));
			expect(read(115)).toBe(true);
			now.mockReturnValue(300);
			touch('touchend', row, false);
			expect(read()).toBe(false);
			expect(read(250)).toBe(true);
			expect(read(301)).toBe(false);
		} finally {
			now.mockRestore();
		}
	});

	it("reads a scroll the program drives with no finger as the program's at any time", async () => {
		const now = vi.spyOn(window.performance, 'now').mockReturnValue(100);
		try {
			const screen = await renderProbe();
			const read = screen.component.getRead();
			part(screen.container, 'list').dispatchEvent(new Event('scroll'));
			expect(read(100)).toBe(false);
			expect(read(50)).toBe(false);
		} finally {
			now.mockRestore();
		}
	});

	it("reads a recognizer's own scroll as the program's, even with a finger resting inside", async () => {
		const screen = await renderProbe();
		const list = part(screen.container, 'list');
		const read = screen.component.getRead();
		touch('touchstart', part(screen.container, 'row'), true);
		getGestureHost(document).ownScroll(list);
		list.dispatchEvent(new Event('scroll'));
		expect(read()).toBe(false);
		touch('touchend', part(screen.container, 'row'), false);
	});

	it('reads the page’s own scroll through the document', async () => {
		const screen = await renderProbe({ kind: 'page' });
		const read = screen.component.getRead();
		touch('touchstart', part(screen.container, 'row'), true);
		document.dispatchEvent(new Event('scroll'));
		expect(read()).toBe(true);
		touch('touchend', part(screen.container, 'row'), false);
		document.dispatchEvent(new Event('scrollend'));
		expect(read()).toBe(false);
	});

	it("follows the ref's node, and stops watching on unmount", async () => {
		const screen = await renderProbe();
		await screen.rerender({ kind: 'section' });
		const list = part(screen.container, 'list');
		const read = screen.component.getRead();
		expect(list.tagName).toBe('SECTION');
		touch('touchstart', part(screen.container, 'row'), true);
		list.dispatchEvent(new Event('scroll'));
		expect(read()).toBe(true);
		touch('touchend', part(screen.container, 'row'), false);
		list.dispatchEvent(new Event('scrollend'));
		screen.unmount();
		expect(read()).toBe(false);
	});

	it('lets go of the node it stops following, and of its last one at unmount', async () => {
		const first = scroller();
		const second = scroller();
		const host = getGestureHost(document);
		try {
			const screen = await renderProbe({ external: first.element });
			fingerScroll(first.element, first.row);
			expect(screen.component.getRead()()).toBe(true);
			lift(first.element, first.row);

			await screen.rerender({ external: second.element });
			// The first scroller is no longer watched: its finger scroll counts
			// for nothing.
			fingerScroll(first.element, first.row);
			expect(isFingerScroll(host, first.element)).toBe(false);
			lift(first.element, first.row);
			fingerScroll(second.element, second.row);
			expect(screen.component.getRead()()).toBe(true);
			lift(second.element, second.row);

			const reader = screen.component.getRead();
			screen.unmount();
			fingerScroll(second.element, second.row);
			expect(isFingerScroll(host, second.element)).toBe(false);
			expect(reader()).toBe(false);
			lift(second.element, second.row);
		} finally {
			first.element.remove();
			second.element.remove();
		}
	});

	describe('onEnd', () => {
		beforeEach(() => {
			ends.count = 0;
			ends.readAtEnd = [];
		});

		it("runs once at the scroller's scrollend after the lift, with the reader already false", async () => {
			const screen = await renderProbe({}, true);
			const list = part(screen.container, 'list');
			const row = part(screen.container, 'row');
			fingerScroll(list, row);
			touch('touchend', row, false);
			list.dispatchEvent(new Event('scroll'));
			expect(ends.count).toBe(0);
			list.dispatchEvent(new Event('scrollend'));
			expect(ends.count).toBe(1);
			expect(ends.readAtEnd).toEqual([false]);
			list.dispatchEvent(new Event('scrollend'));
			expect(ends.count).toBe(1);
		});

		it('runs at the lift when the scroll ended under a resting finger', async () => {
			const screen = await renderProbe({}, true);
			const list = part(screen.container, 'list');
			const row = part(screen.container, 'row');
			fingerScroll(list, row);
			list.dispatchEvent(new Event('scrollend'));
			expect(ends.count).toBe(0);
			touch('touchend', row, false);
			expect(ends.count).toBe(1);
		});

		it('runs after the quiet fallback where the browser fires no scrollend', async () => {
			let owner: object | null = window;
			while (owner != null && !Object.hasOwn(owner, 'onscrollend')) {
				owner = Object.getPrototypeOf(owner) as object | null;
			}
			const slot =
				owner == null ? undefined : Object.getOwnPropertyDescriptor(owner, 'onscrollend');
			if (owner != null && slot?.configurable) {
				delete (owner as Record<string, unknown>).onscrollend;
			}
			vi.useFakeTimers();
			try {
				if ('onscrollend' in window) {
					// A browser whose handler slot cannot be removed always
					// reports `scrollend` support; the fallback is unreachable.
					return;
				}
				const screen = await renderProbe({}, true);
				const list = part(screen.container, 'list');
				const row = part(screen.container, 'row');
				fingerScroll(list, row);
				touch('touchend', row, false);
				vi.advanceTimersByTime(149);
				expect(ends.count).toBe(0);
				vi.advanceTimersByTime(1);
				expect(ends.count).toBe(1);
				expect(ends.readAtEnd).toEqual([false]);
			} finally {
				vi.useRealTimers();
				if (owner != null && slot != null) {
					Object.defineProperty(owner, 'onscrollend', slot);
				}
			}
		});

		it('runs when the primary pointer stops being coarse mid-scroll', async () => {
			restorePointer();
			const pointer = pointerQuery(true);
			restorePointer = pointer.restore;
			const screen = await renderProbe({}, true);
			const list = part(screen.container, 'list');
			fingerScroll(list, part(screen.container, 'row'));
			pointer.set(false);
			expect(ends.count).toBe(1);
			expect(ends.readAtEnd).toEqual([false]);
			touch('touchend', part(screen.container, 'row'), false);
		});

		it('gives two watchers of one scroller one call each per finger scroll', async () => {
			const screen = await renderProbe({ watchers: 2 }, true);
			const list = part(screen.container, 'list');
			const row = part(screen.container, 'row');
			fingerScroll(list, row);
			lift(list, row);
			expect(ends.count).toBe(2);
			fingerScroll(list, row);
			lift(list, row);
			expect(ends.count).toBe(4);
		});

		it('does not run on unmount, even mid-scroll', async () => {
			const screen = await renderProbe({}, true);
			const row = part(screen.container, 'row');
			fingerScroll(part(screen.container, 'list'), row);
			screen.unmount();
			expect(ends.count).toBe(0);
			touch('touchend', row, false);
			expect(ends.count).toBe(0);
		});
	});
});
