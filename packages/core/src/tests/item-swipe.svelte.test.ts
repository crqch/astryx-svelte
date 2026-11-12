/** PORTS: Item/Item.test.tsx */
/** PORTS: Item/Item.swipeLayer.test.tsx */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { LinkComponentType } from '$lib/components/link/types.js';
import Item from '$lib/components/item/item.svelte';
import CustomLink from './fixtures/custom-link.svelte';

/**
 * Astryx's `Item/Item.test.tsx` `swipeActions` block and its companion
 * `Item/Item.swipeLayer.test.tsx`.
 *
 * The suites are split out of `item.svelte.test.ts` because the gesture needs
 * the browser project's real pointer delivery and fake clock. Upstream runs in
 * jsdom and hand-sets each panel's `offsetWidth`; here the row still lays out,
 * but the same test-time sizes keep the commit arithmetic deterministic — the
 * gesture reads `clientWidth`/`offsetWidth`, and those are the only numbers the
 * assertions depend on.
 *
 * Upstream's `swipeLayerLoaded(row)` helper waits for the lazily imported
 * module; `waitForPanel` is the same wait. The module is warmed once at the top
 * of this file so the later cases are synchronous after render, as upstream's
 * `beforeAll` warm row makes them.
 *
 * The link-root cases at the end are counterparts: upstream exercises the
 * `as`-component path through `DropdownMenu`'s link rows, not through `Item`'s
 * own suite. They are here because that is the seam this file's component
 * change adds.
 */

// Warm the lazily imported layer exactly as upstream's `beforeAll` warm row
// does; every row below then has its panels by the time `render` resolves.
await import('$lib/components/item/item-swipe-layer.svelte');

type Entry = {
	label: string;
	onActivate: () => void;
	hasRemoval?: boolean;
	isDisabled?: boolean;
	variant?: 'neutral' | 'accent' | 'destructive';
};

const travelOf = (row: HTMLElement): string => row.style.getPropertyValue('--_item-swipe-travel');
const panelOf = (row: HTMLElement, side: 'leading' | 'trailing'): HTMLElement | null =>
	row.querySelector(`[data-swipe-panel="${side}"]`);

/** jsdom lays nothing out; the browser lays out more than the arithmetic needs. */
function layOut(row: HTMLElement): void {
	Object.defineProperty(row, 'clientWidth', { configurable: true, value: 300 });
	for (const panel of row.querySelectorAll('[data-swipe-panel]')) {
		const entries = panel.firstElementChild as HTMLElement;
		Object.defineProperty(entries, 'offsetWidth', {
			configurable: true,
			value: 72 * entries.childElementCount
		});
	}
}

async function waitForPanel(row: HTMLElement): Promise<void> {
	await vi.waitFor(() => {
		if (row.querySelector('[data-swipe-panel]') == null && row.dataset.swipeExpected !== 'no') {
			throw new Error('the swipe layer has not mounted yet');
		}
	});
}

function useSwipeClock(): void {
	vi.useFakeTimers({
		toFake: [
			'setTimeout',
			'clearTimeout',
			'requestAnimationFrame',
			'cancelAnimationFrame',
			'Date',
			'performance'
		]
	});
}

afterEach(() => {
	vi.useRealTimers();
});

function pointer(
	element: Element,
	type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
	x: number,
	y = 10,
	{ pointerId = 7, pointerType = 'touch', isPrimary = true } = {}
): void {
	element.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			composed: true,
			clientX: x,
			clientY: y,
			isPrimary,
			pointerId,
			pointerType
		})
	);
}

/** The first finger down: the primary touch pointer, spaced out like a finger. */
async function touch(
	element: Element,
	type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
	x: number,
	y = 10
): Promise<void> {
	await vi.advanceTimersByTimeAsync(50);
	pointer(element, type, x, y);
}

/** A second finger: a touch pointer that is not the primary one. */
async function secondFinger(
	element: Element,
	type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
	x: number,
	y = 10
): Promise<void> {
	await vi.advanceTimersByTimeAsync(10);
	pointer(element, type, x, y, { pointerId: 8, isPrimary: false });
}

/** A native touchmove, whose dispatch answers whether the row cancelled it. */
function touchMove(element: Element, x: number, y = 10): boolean {
	const event = new Event('touchmove', { bubbles: true, cancelable: true });
	Object.assign(event, { touches: [{ clientX: x, clientY: y }] });
	return element.dispatchEvent(event);
}

/** The time a settle takes, plus the frame before it. */
async function settled(): Promise<void> {
	await vi.advanceTimersByTimeAsync(250);
}

async function renderRow({
	leading = [{ label: 'Unread', onActivate: vi.fn() }],
	trailing,
	behavior,
	onClick = vi.fn()
}: {
	leading?: Entry[];
	trailing?: Entry[];
	behavior?: 'reveal' | 'commit';
	onClick?: () => void;
} = {}): Promise<{ row: HTMLElement; onClick: () => void }> {
	const screen = await render(Item, {
		props: {
			label: 'Conversation',
			onclick: onClick,
			'data-testid': 'row',
			swipeActions: { leading, trailing },
			swipeBehavior: behavior
		}
	});
	const row = screen.getByTestId('row').element() as HTMLElement;
	await waitForPanel(row);
	layOut(row);
	useSwipeClock();
	return { row, onClick };
}

describe('Item and the swipe layer', () => {
	it('renders a row without swipe actions with no swipe layer at all', async () => {
		const screen = await render(Item, { props: { as: 'li', label: 'Archive' } });
		const row = screen.container.firstElementChild as HTMLElement;
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(row.querySelector('[data-swipe-panel]')).toBeNull();
		expect(row.childElementCount).toBe(1);
	});

	it('renders the swipe layer into the root of a row with swipe actions', async () => {
		const screen = await render(Item, {
			props: {
				label: 'Inbox',
				'data-testid': 'row',
				swipeActions: { trailing: [{ label: 'Archive', onActivate: () => {} }] }
			}
		});
		const row = screen.getByTestId('row').element() as HTMLElement;
		await waitForPanel(row);
		const panel = panelOf(row, 'trailing');
		expect(panel).not.toBeNull();
		// The layer adds nothing but the panel: the root is still the content
		// followed by the out-of-flow panel, with no wrapper for either.
		expect(panel?.parentElement).toBe(row);
		expect(row.childElementCount).toBe(2);
	});
});

describe('swipeActions', () => {
	it('is served on a role-less row and a listitem, and not on a row whose role forbids interactive descendants', async () => {
		const actions = { leading: [{ label: 'Unread', onActivate: vi.fn() }] };
		const plain = await render(Item, {
			props: { label: 'A', 'data-testid': 'row', swipeActions: actions }
		});
		const plainRow = plain.container.querySelector('[data-testid="row"]') as HTMLElement;
		await vi.waitFor(() => expect(panelOf(plainRow, 'leading')).not.toBeNull());

		const listItem = await render(Item, {
			props: { as: 'li', label: 'A', 'data-testid': 'row', swipeActions: actions }
		});
		const listRow = listItem.container.querySelector('[data-testid="row"]') as HTMLElement;
		await vi.waitFor(() => expect(panelOf(listRow, 'leading')).not.toBeNull());

		for (const role of ['option', 'menuitem', 'menuitemcheckbox', 'menuitemradio']) {
			const screen = await render(Item, {
				props: { role, label: 'A', 'data-testid': 'row', swipeActions: actions }
			});
			const row = screen.container.querySelector('[data-testid="row"]') as HTMLElement;
			expect(panelOf(row, 'leading')).toBeNull();
		}
	});

	it('is not served on a row that is the enlarged target of a nested control, nor on a disabled row', async () => {
		const actions = { leading: [{ label: 'Unread', onActivate: vi.fn() }] };
		const delegating = await render(Item, {
			props: {
				label: 'A',
				'data-testid': 'row',
				interactiveRef: () => null,
				swipeActions: actions
			}
		});
		const delegateRow = delegating.container.querySelector('[data-testid="row"]') as HTMLElement;
		expect(panelOf(delegateRow, 'leading')).toBeNull();

		const disabled = await render(Item, {
			props: { label: 'A', 'data-testid': 'row', isDisabled: true, swipeActions: actions }
		});
		const disabledRow = disabled.container.querySelector('[data-testid="row"]') as HTMLElement;
		expect(panelOf(disabledRow, 'leading')).toBeNull();
	});

	it('adds no element to a row without swipe actions, and no wrapper to one with them', async () => {
		const beforeScreen = await render(Item, {
			props: { as: 'li', label: 'A', 'data-testid': 'row' }
		});
		const before = beforeScreen.container.querySelector('[data-testid="row"]') as HTMLElement;
		const beforeCount = before.childElementCount;

		const afterScreen = await render(Item, {
			props: {
				as: 'li',
				label: 'A',
				'data-testid': 'row',
				swipeActions: { trailing: [{ label: 'Archive', onActivate: vi.fn() }] }
			}
		});
		const row = afterScreen.container.querySelector('[data-testid="row"]') as HTMLElement;
		await waitForPanel(row);
		expect(row.tagName).toBe('LI');
		expect(row.childElementCount).toBe(beforeCount + 1);
		expect(panelOf(row, 'trailing')).toBe(row.lastElementChild);
		expect(panelOf(row, 'leading')).toBeNull();
	});

	it('keeps the panel out of the accessibility tree and the tab order at rest, with no pixel of it painted', async () => {
		const { row } = await renderRow();
		const panel = panelOf(row, 'leading') as HTMLElement;
		expect(panel).toHaveAttribute('inert');
		expect(document.body.querySelector('[data-swipe-panel] button')).toBeInTheDocument();
		const style = getComputedStyle(panel);
		expect(style.padding).toBe('0px');
		expect(style.width).toBe('0px');
		expect(travelOf(row)).toBe('');
	});

	it('claims a sideways drag, writes the travel on the root, and tells the browser the row owns the drag', async () => {
		const { row } = await renderRow();
		await touch(row, 'pointerdown', 10);
		// Before the axis is decided the scroller may still take the gesture:
		// the default stands (true once nothing prevented it).
		expect(touchMove(row, 14)).toBe(true);
		await touch(row, 'pointermove', 14);
		expect(touchMove(row, 14)).toBe(true);
		expect(travelOf(row)).toBe('');
		// Past the lock and more horizontal than vertical: the row's. Every
		// further touchmove is cancelled.
		await touch(row, 'pointermove', 22, 18);
		expect(touchMove(row, 22, 18)).toBe(false);
		await vi.advanceTimersByTimeAsync(20);
		expect(travelOf(row)).toBe('12px');
		expect(row.style.getPropertyValue('--_item-swipe-dir')).toBe('1');
		expect(row.style.getPropertyValue('--_item-swipe-duration')).toBe('0s');
		await touch(row, 'pointermove', 50, 20);
		await vi.advanceTimersByTimeAsync(20);
		expect(travelOf(row)).toBe('40px');
		await touch(row, 'pointerup', 50, 20);
		await settled();
	});

	it('leaves a mostly vertical drag to the scroller and never cancels its touchmove', async () => {
		const { row } = await renderRow();
		await touch(row, 'pointerdown', 10, 10);
		await touch(row, 'pointermove', 14, 40);
		expect(touchMove(row, 14, 40)).toBe(true);
		await touch(row, 'pointermove', 120, 200);
		expect(travelOf(row)).toBe('');
		await touch(row, 'pointerup', 120, 200);
	});

	it('ignores a mouse', async () => {
		const { row } = await renderRow();
		pointer(row, 'pointerdown', 10, 10, { pointerId: 1, pointerType: 'mouse' });
		pointer(row, 'pointermove', 60, 10, { pointerId: 1, pointerType: 'mouse' });
		await vi.advanceTimersByTimeAsync(20);
		expect(travelOf(row)).toBe('');
		pointer(row, 'pointerup', 60, 10, { pointerId: 1, pointerType: 'mouse' });
	});

	it('does not move toward a side without entries', async () => {
		const { row } = await renderRow({ leading: [{ label: 'Unread', onActivate: vi.fn() }] });
		await touch(row, 'pointerdown', 200);
		await touch(row, 'pointermove', 150);
		await vi.advanceTimersByTimeAsync(20);
		expect(travelOf(row)).toBe('');
		await touch(row, 'pointerup', 150);
	});
});

describe('a pinch', () => {
	it('lets the touch go when a second finger lands on the row before the axis is decided, and cancels nothing', async () => {
		const { row } = await renderRow();
		await touch(row, 'pointerdown', 100);
		await secondFinger(row, 'pointerdown', 60);
		await touch(row, 'pointermove', 130);
		await secondFinger(row, 'pointermove', 30);
		await touch(row, 'pointermove', 160);
		expect(touchMove(row, 160)).toBe(true);
		await vi.advanceTimersByTimeAsync(20);
		expect(travelOf(row)).toBe('');
		await touch(row, 'pointercancel', 160);
		await secondFinger(row, 'pointercancel', 0);
		await settled();
		expect(travelOf(row)).toBe('');
	});

	it('lets the touch go when the second finger lands off the row', async () => {
		const { row } = await renderRow();
		await touch(row, 'pointerdown', 100);
		await secondFinger(document.body, 'pointerdown', 60, 200);
		await touch(row, 'pointermove', 130);
		await touch(row, 'pointermove', 160);
		expect(touchMove(row, 160)).toBe(true);
		await vi.advanceTimersByTimeAsync(20);
		expect(travelOf(row)).toBe('');
		await touch(row, 'pointercancel', 160);
	});

	it('never starts a drag from a finger that is not the first one down', async () => {
		const { row } = await renderRow();
		await secondFinger(row, 'pointerdown', 100);
		await secondFinger(row, 'pointermove', 130);
		await secondFinger(row, 'pointermove', 160);
		expect(touchMove(row, 160)).toBe(true);
		await vi.advanceTimersByTimeAsync(20);
		expect(travelOf(row)).toBe('');
		await secondFinger(row, 'pointerup', 160);
	});

	it('keeps a drag the row already owns when a second finger lands', async () => {
		const { row } = await renderRow();
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 30);
		await touch(row, 'pointermove', 45);
		await vi.advanceTimersByTimeAsync(20);
		expect(travelOf(row)).toBe('35px');
		await secondFinger(row, 'pointerdown', 200);
		await touch(row, 'pointermove', 60);
		expect(touchMove(row, 60)).toBe(false);
		await vi.advanceTimersByTimeAsync(20);
		expect(travelOf(row)).toBe('50px');
		await touch(row, 'pointerup', 60);
		await secondFinger(row, 'pointerup', 200);
		await settled();
		expect(travelOf(row)).toBe('72px');
	});

	it('stops listening to the document once the axis is decided or the touch ends', async () => {
		const add = vi.spyOn(document, 'addEventListener');
		const remove = vi.spyOn(document, 'removeEventListener');
		try {
			const { row } = await renderRow();
			const watching = (): number =>
				add.mock.calls.filter(([type]) => type === 'pointerdown').length -
				remove.mock.calls.filter(([type]) => type === 'pointerdown').length;
			const before = watching();
			await touch(row, 'pointerdown', 10);
			expect(watching()).toBe(before + 1);
			await touch(row, 'pointermove', 40);
			expect(watching()).toBe(before);
			await touch(row, 'pointerup', 40);
			await settled();
			await touch(row, 'pointerdown', 10);
			expect(watching()).toBe(before + 1);
			await touch(row, 'pointerup', 12);
			expect(watching()).toBe(before);
		} finally {
			add.mockRestore();
			remove.mockRestore();
		}
	});
});

describe('reveal (the default)', () => {
	it('springs back when released short of half the panel, on the settle clock', async () => {
		const { row } = await renderRow();
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 30);
		await touch(row, 'pointermove', 40);
		await touch(row, 'pointerup', 40);
		expect(row.style.getPropertyValue('--_item-swipe-duration')).toBe('200ms');
		expect(travelOf(row)).toBe('0px');
		await settled();
		expect(travelOf(row)).toBe('');
		expect(row.style.getPropertyValue('--_item-swipe-dir')).toBe('');
		expect(panelOf(row, 'leading')).toHaveAttribute('inert');
	});

	it('rests open past half the panel, with every entry a real button, and fires a tapped entry', async () => {
		const onActivate = vi.fn();
		const { row, onClick } = await renderRow({ leading: [{ label: 'Unread', onActivate }] });
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 30);
		await touch(row, 'pointermove', 45);
		await touch(row, 'pointermove', 60);
		await touch(row, 'pointerup', 60);
		await settled();
		expect(travelOf(row)).toBe('72px');
		const panel = panelOf(row, 'leading') as HTMLElement;
		expect(panel).not.toHaveAttribute('inert');
		const button = panel.querySelector('button') as HTMLButtonElement;
		expect(button).toBeVisible();
		button.click();
		expect(onActivate).toHaveBeenCalledTimes(1);
		await settled();
		expect(travelOf(row)).toBe('');
		expect(panel).toHaveAttribute('inert');
		expect(onClick).not.toHaveBeenCalled();
	});

	it('keeps a disabled entry focusable but inert on an open row', async () => {
		const onActivate = vi.fn();
		const { row, onClick } = await renderRow({
			leading: [{ label: 'Unread', onActivate, isDisabled: true }]
		});
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 30);
		await touch(row, 'pointermove', 45);
		await touch(row, 'pointermove', 60);
		await touch(row, 'pointerup', 60);
		await settled();
		expect(travelOf(row)).toBe('72px');
		const button = (panelOf(row, 'leading') as HTMLElement).querySelector(
			'button'
		) as HTMLButtonElement;
		expect(button).toHaveAttribute('aria-disabled', 'true');
		expect(button).not.toHaveAttribute('disabled');
		button.focus();
		expect(document.activeElement).toBe(button);
		button.click();
		await settled();
		expect(onActivate).not.toHaveBeenCalled();
		expect(travelOf(row)).toBe('72px');
		expect(onClick).not.toHaveBeenCalled();
	});

	it('holds the row out after a tapped entry with hasRemoval', async () => {
		const onActivate = vi.fn();
		const { row } = await renderRow({
			leading: [],
			trailing: [{ label: 'Archive', onActivate, hasRemoval: true }]
		});
		await touch(row, 'pointerdown', 200);
		await touch(row, 'pointermove', 180);
		await touch(row, 'pointermove', 160);
		await touch(row, 'pointermove', 140);
		await touch(row, 'pointerup', 140);
		await settled();
		expect(travelOf(row)).toBe('-72px');
		(panelOf(row, 'trailing') as HTMLElement).querySelector('button')?.click();
		expect(onActivate).toHaveBeenCalledTimes(1);
		await settled();
		expect(travelOf(row)).toBe('-324px');
		await settled();
		expect(travelOf(row)).toBe('-324px');
	});

	it('closes a resting row on a pointer outside it, and on Escape with focus inside', async () => {
		const { row } = await renderRow();
		const open = async (): Promise<void> => {
			await touch(row, 'pointerdown', 10);
			await touch(row, 'pointermove', 30);
			await touch(row, 'pointermove', 45);
			await touch(row, 'pointermove', 60);
			await touch(row, 'pointerup', 60);
			await settled();
			expect(travelOf(row)).toBe('72px');
		};
		await open();
		pointer(document.body, 'pointerdown', 0, 0, { pointerId: 9 });
		await settled();
		expect(travelOf(row)).toBe('');
		await open();
		const button = (panelOf(row, 'leading') as HTMLElement).querySelector(
			'button'
		) as HTMLButtonElement;
		button.focus();
		button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settled();
		expect(travelOf(row)).toBe('');
		// Focus lands on the row's own content, not on a now-inert button.
		const rowButton = row.querySelector(':scope > button') as HTMLButtonElement;
		expect(document.activeElement).toBe(rowButton);
	});

	it('fires the outermost entry and no other on a drag past the commit point, then springs back', async () => {
		const inner = vi.fn();
		const outer = vi.fn();
		const { row } = await renderRow({
			leading: [
				{ label: 'Unread', onActivate: inner },
				{ label: 'Pin', onActivate: outer }
			]
		});
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 40);
		await touch(row, 'pointermove', 210);
		await touch(row, 'pointerup', 210);
		expect(outer).not.toHaveBeenCalled();
		expect(travelOf(row)).toBe('324px');
		await settled();
		expect(outer).toHaveBeenCalledTimes(1);
		expect(inner).not.toHaveBeenCalled();
		await settled();
		expect(travelOf(row)).toBe('');
	});

	it('commits on a fling short of the commit point', async () => {
		const onActivate = vi.fn();
		const { row } = await renderRow({ leading: [{ label: 'Unread', onActivate }] });
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 30);
		await touch(row, 'pointermove', 80);
		await touch(row, 'pointerup', 80);
		await settled();
		expect(onActivate).toHaveBeenCalledTimes(1);
	});

	it('lays the entries outermost last: at the leading edge the row of entries runs in reverse', async () => {
		const { row } = await renderRow({
			leading: [
				{ label: 'Unread', onActivate: vi.fn() },
				{ label: 'Pin', onActivate: vi.fn() }
			],
			trailing: [
				{ label: 'Archive', onActivate: vi.fn() },
				{ label: 'Delete', onActivate: vi.fn(), variant: 'destructive' }
			]
		});
		const leading = panelOf(row, 'leading')?.firstElementChild as HTMLElement;
		const trailing = panelOf(row, 'trailing')?.firstElementChild as HTMLElement;
		expect(getComputedStyle(leading).flexDirection).toBe('row-reverse');
		expect(getComputedStyle(trailing).flexDirection).toBe('row');
		// The panel wears its outermost entry's colour, so a slide-out fills the
		// row with it.
		const outerVariant = (panelOf(row, 'trailing') as HTMLElement).className;
		const deleteVariant = (trailing.lastElementChild as HTMLElement).className;
		expect(outerVariant.split(' ').some((c) => deleteVariant.includes(c))).toBe(true);
	});
});

describe('commit', () => {
	it('slides out and fires on a release past the commit point; nothing rests', async () => {
		const onActivate = vi.fn();
		const { row } = await renderRow({
			behavior: 'commit',
			leading: [{ label: 'Unread', onActivate }]
		});
		const panel = panelOf(row, 'leading') as HTMLElement;
		expect(panel).toHaveAttribute('aria-hidden', 'true');
		expect(panel.querySelector('button')).toBeNull();
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 40);
		await touch(row, 'pointermove', 160);
		await touch(row, 'pointerup', 160);
		expect(travelOf(row)).toBe('324px');
		await settled();
		expect(onActivate).toHaveBeenCalledTimes(1);
		await settled();
		expect(travelOf(row)).toBe('');
		expect(panel).toHaveAttribute('aria-hidden', 'true');
	});

	it('springs back from any release short of the commit point, even past the panel', async () => {
		const onActivate = vi.fn();
		const { row } = await renderRow({
			behavior: 'commit',
			leading: [{ label: 'Unread', onActivate }]
		});
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 40);
		await touch(row, 'pointermove', 65);
		await touch(row, 'pointermove', 90);
		await touch(row, 'pointermove', 100);
		await touch(row, 'pointerup', 100);
		await settled();
		expect(onActivate).not.toHaveBeenCalled();
		expect(travelOf(row)).toBe('');
	});

	it('holds out after a committed entry with hasRemoval', async () => {
		const onActivate = vi.fn();
		const { row } = await renderRow({
			behavior: 'commit',
			leading: [{ label: 'Archive', onActivate, hasRemoval: true }]
		});
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 40);
		await touch(row, 'pointermove', 160);
		await touch(row, 'pointerup', 160);
		await settled();
		expect(onActivate).toHaveBeenCalledTimes(1);
		await settled();
		expect(travelOf(row)).toBe('324px');
	});

	it('warns in development when a committing side has more than one entry', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			await renderRow({
				behavior: 'commit',
				leading: [
					{ label: 'Unread', onActivate: vi.fn() },
					{ label: 'Pin', onActivate: vi.fn() }
				]
			});
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('swipeBehavior="commit"'));
		} finally {
			warn.mockRestore();
		}
	});
});

describe('swipe primary', () => {
	it('swallows the click the browser synthesizes after a drag, so the primary does not fire', async () => {
		const onClick = vi.fn();
		const { row } = await renderRow({ onClick });
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 30);
		await touch(row, 'pointermove', 40);
		await touch(row, 'pointerup', 40);
		const primary = row.querySelector(':scope > button') as HTMLButtonElement;
		primary.click();
		expect(onClick).not.toHaveBeenCalled();
		await settled();
		await vi.advanceTimersByTimeAsync(500);
		primary.click();
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('reads the direction logically under RTL: leading is toward the inline end, and the sign rides the root', async () => {
		const onActivate = vi.fn();
		const screen = await render(Item, {
			props: {
				label: 'Conversation',
				onclick: vi.fn(),
				'data-testid': 'row',
				swipeActions: { leading: [{ label: 'Unread', onActivate }] }
			}
		});
		const row = screen.getByTestId('row').element() as HTMLElement;
		row.setAttribute('dir', 'rtl');
		await waitForPanel(row);
		layOut(row);
		useSwipeClock();
		await touch(row, 'pointerdown', 200);
		await touch(row, 'pointermove', 180);
		await touch(row, 'pointermove', 160);
		await touch(row, 'pointermove', 140);
		await vi.advanceTimersByTimeAsync(20);
		expect(row.style.getPropertyValue('--_item-swipe-dir')).toBe('-1');
		expect(travelOf(row)).toBe('-60px');
		await touch(row, 'pointerup', 140);
		await settled();
		expect(travelOf(row)).toBe('-72px');
		// Rightward from a closed row is toward the inline start: no trailing
		// entries, so it is not claimed.
		pointer(document.body, 'pointerdown', 0, 0, { pointerId: 9 });
		await settled();
		await touch(row, 'pointerdown', 10);
		await touch(row, 'pointermove', 60);
		await vi.advanceTimersByTimeAsync(20);
		expect(travelOf(row)).toBe('');
		await touch(row, 'pointerup', 60);
	});
});

describe('Item link root', () => {
	it('renders the caller component as the row root and carries href, target and rel on it', async () => {
		const screen = await render(Item, {
			props: {
				as: CustomLink as LinkComponentType,
				label: 'Link row',
				href: '/inbox',
				target: '_blank',
				rel: 'sponsored',
				role: 'menuitem',
				'data-testid': 'row'
			}
		});
		const row = screen.getByTestId('row').element() as HTMLElement;
		expect(row.tagName).toBe('A');
		expect(row).toHaveAttribute('data-custom-link');
		expect(row).toHaveAttribute('href', '/inbox');
		expect(row).toHaveAttribute('target', '_blank');
		expect(row).toHaveAttribute('rel', 'sponsored noopener noreferrer');
		expect(row).toHaveAttribute('role', 'menuitem');
		// The root is the link, so no invisible anchor and no tab-stop-adding
		// button is rendered inside it.
		expect(row.querySelector('a')).toBeNull();
		expect(row.querySelector('button')).toBeNull();
	});

	it('keeps a disabled link root in the tree but gives it no destination', async () => {
		const screen = await render(Item, {
			props: {
				as: CustomLink as LinkComponentType,
				label: 'Link row',
				href: '/inbox',
				target: '_blank',
				rel: 'sponsored',
				role: 'menuitem',
				isDisabled: true,
				'data-testid': 'row'
			}
		});
		const row = screen.getByTestId('row').element() as HTMLElement;
		expect(row.tagName).toBe('A');
		expect(row).not.toHaveAttribute('href');
		expect(row).not.toHaveAttribute('target');
		expect(row).not.toHaveAttribute('rel');
		expect(row).toHaveAttribute('aria-disabled', 'true');
	});

	it('renders a component root without href through the same seam', async () => {
		const screen = await render(Item, {
			props: {
				as: CustomLink as LinkComponentType,
				label: 'Component row',
				role: 'listitem',
				'data-testid': 'row'
			}
		});
		const row = screen.getByTestId('row').element() as HTMLElement;
		expect(row.tagName).toBe('A');
		expect(row).not.toHaveAttribute('href');
		expect(row).toHaveAttribute('role', 'listitem');
	});
});
