/** PORTS: List/__tests__/ListReorder.test.tsx */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ListReorderFixture from './fixtures/list-reorder-fixture.svelte';
import { __resetDevWarnings } from '$lib/utils/dev-warning.js';

/**
 * Astryx's `List/__tests__/ListReorder.test.tsx`, ported to the browser project.
 *
 * The suite proves the reorder session and handle: a row with an `itemKey`
 * gets a named handle described by the list's instructions; a rejected row
 * and a row without a key keep their place; a click turns on reorder mode and
 * the arrows move the row, report its key and place, refuse a fixed
 * neighbour, and keep the moves on Escape; a disabled handle stays focusable;
 * a mouse drag draws the preview and insertion line and drops once. The
 * handle's geometry and paint are covered by the CSS oracle.
 *
 * **Not ported here**, with their reason:
 * - `ListReorderMode.interaction.browser.spec.ts` (the full reorder-mode
 *   keyboard and hint suite), `ListReorderPointer.interaction.browser.spec.ts`,
 *   `ListReorderTouch.interaction.browser.spec.ts` and
 *   `ListReorderSelectionLock.test.tsx`: each drives the gesture host or a
 *   real touch sequence with jsdom-only shims (`pointerQuery`, stubbed
 *   `offsetTop`), which this port's browser project does not have.
 * - `ListReorderLayout.test.tsx` and `listLayoutUpdates.test.tsx`: the row
 *   layout-update subsystem those tests cover is not ported (`port/debts.md`).
 * - The lazy-loading cases ("loads no reorder module from List or ListItem")
 *   and the production-warning case: this port imports the handle and host
 *   statically, and its dev-warning gate is covered by the utility's own
 *   source rather than by re-importing components under a stubbed env.
 * - The jsdom layout helpers (`layOut`) become real browser layout here, so
 *   the exact `--astryx-reorder-line-y`/preview offsets are asserted only as
 *   a shape (a px value), not as upstream's stubbed 131px.
 */

const handleOf = (label: string) =>
	page.getByRole('button', { name: `Reorder ${label}`, exact: true }).element() as HTMLElement;

const handleCount = (label: string) =>
	page.getByRole('button', { name: `Reorder ${label}`, exact: true }).elements().length;

const POINTER = {
	pointerId: 1,
	pointerType: 'mouse',
	button: 0,
	bubbles: true,
	cancelable: true
} as const;

/** A mouse pointer event dispatched at `target`, as the port's gesture tests do. */
function pointer(
	target: Element,
	type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
	x: number,
	y: number,
	buttons = 1
): void {
	target.dispatchEvent(new PointerEvent(type, { ...POINTER, clientX: x, clientY: y, buttons }));
}

const labels = () =>
	Array.from(document.querySelectorAll('li:not([data-astryx-leaving])')).map((row) =>
		(row.textContent ?? '').replace(/\s+/g, ' ').trim()
	);

const liveText = () => document.body.textContent ?? '';

afterEach(() => {
	__resetDevWarnings();
});

describe('List reorderable', () => {
	it('adds no handle and no listener without reorderable', async () => {
		const screen = await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent'], reorder: false }
		});
		expect(screen.container.querySelectorAll('[data-astryx-list-reorder]')).toHaveLength(0);
		expect(screen.getByRole('listitem').elements()).toHaveLength(2);
	});

	it('gives each row with an item key a handle named after it and described by the instructions', async () => {
		const screen = await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent', 'Drafts'] }
		});
		const handle = handleOf('Inbox');
		expect(handle).not.toBeNull();
		expect(handle).toHaveAttribute('type', 'button');
		expect(handle).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByRole('button', { name: /^Reorder / }).elements()).toHaveLength(3);

		const description = document.getElementById(handle?.getAttribute('aria-describedby') ?? '');
		expect(description).not.toBeNull();
		expect(description).toHaveAttribute('hidden');
		expect(description).toHaveTextContent(
			'Drag to move this item, or press Space or Enter, then the arrow keys to move it one place at a time. Press Escape when you are done.'
		);
		// The instructions sit outside the list.
		expect(description?.closest('ul')).toBeNull();
		expect(screen.getByRole('list').element().children).toHaveLength(3);
	});

	it('names the handle of a row with a rich label after its text', async () => {
		await render(ListReorderFixture, {
			props: { initial: ['Sent'], label: 'rich' }
		});
		await expect
			.element(page.getByRole('button', { name: 'Reorder Sent mail', exact: true }))
			.toBeInTheDocument();
	});

	it('names the handle of a row that shows an icon after the icon name', async () => {
		await render(ListReorderFixture, {
			props: { initial: ['Star'], label: 'icon-named' }
		});
		await expect
			.element(page.getByRole('button', { name: 'Reorder Starred', exact: true }))
			.toBeInTheDocument();
	});

	it("names the handle after the row's own aria-label or aria-labelledby when its caller gave one", async () => {
		const byLabel = await render(ListReorderFixture, {
			props: { initial: ['Account'], ariaLabel: 'Account' }
		});
		await expect
			.element(page.getByRole('button', { name: 'Reorder Account', exact: true }))
			.toBeInTheDocument();
		byLabel.unmount();

		await render(ListReorderFixture, {
			props: {
				initial: ['B'],
				ariaLabelledBy: 'row-name',
				externalName: 'Billing address'
			}
		});
		await expect
			.element(page.getByRole('button', { name: 'Reorder Billing address', exact: true }))
			.toBeInTheDocument();
	});

	it('names a row that shows no text after its place, and warns in development', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			await render(ListReorderFixture, {
				props: { initial: ['Dot'], label: 'icon' }
			});
			await expect
				.element(page.getByRole('button', { name: 'Reorder item 1', exact: true }))
				.toBeInTheDocument();
			await vi.waitFor(() => {
				expect(
					warn.mock.calls.filter(([message]) =>
						String(message).includes('A reorderable row has no accessible name')
					)
				).toHaveLength(1);
			});
		} finally {
			warn.mockRestore();
		}
	});

	it('adds only the handle to a row without end content: no end-slot wrapper', async () => {
		const plain = await render(ListReorderFixture, {
			props: { initial: ['Inbox'], reorder: false }
		});
		const plainCount = plain.container.querySelector('li')?.querySelectorAll('*').length ?? 0;
		plain.unmount();

		const screen = await render(ListReorderFixture, {
			props: { initial: ['Inbox'] }
		});
		const row = screen.container.querySelector('li') as HTMLElement;
		expect(row.querySelectorAll('*').length).toBe(plainCount + 1);
		const handle = handleOf('Inbox');
		// The handle is the row's own child, after the label.
		expect(handle?.parentElement).toBe(row);
		// Its lines are a pseudo-element: the handle holds no element or text.
		expect(handle?.children).toHaveLength(0);
		expect(handle?.textContent).toBe('');
	});

	it('keeps a row the object rejects in place: no handle', async () => {
		const screen = await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Trash'], fixed: ['Trash'] }
		});
		expect(handleCount('Trash')).toBe(0);
		expect(handleCount('Inbox')).toBe(1);
		// Nothing was added to the rejected row.
		const row = Array.from(screen.container.querySelectorAll('li')).find((li) =>
			li.textContent?.includes('Trash')
		);
		expect(row?.querySelector('[data-astryx-list-reorder]')).toBeNull();
	});

	it('keeps a row without an item key in place, and warns in development when no row has one', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			const withKey = await render(ListReorderFixture, {
				props: { initial: ['Inbox'] }
			});
			expect(withKey.container.querySelectorAll('[data-astryx-list-reorder]')).toHaveLength(1);
			withKey.unmount();

			await render(ListReorderFixture, {
				props: { initial: ['Sent', 'Drafts'], keyless: true, hasFilter: false }
			});
			expect(document.querySelectorAll('[data-astryx-list-reorder]')).toHaveLength(0);
			await vi.waitFor(() => {
				expect(
					warn.mock.calls.filter(([message]) => String(message).includes('`itemKey`'))
				).toHaveLength(1);
			});
		} finally {
			warn.mockRestore();
		}
	});

	it('marks a row with its item key', async () => {
		const screen = await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent'] }
		});
		const rows = Array.from(screen.container.querySelectorAll('li'));
		expect(rows[0]).toHaveAttribute('data-astryx-item-key', 'Inbox');
		expect(rows[1]).toHaveAttribute('data-astryx-item-key', 'Sent');
	});

	it('turns reorder mode on with a click, and the arrows move the row', async () => {
		const onReorder = vi.fn();
		await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent', 'Drafts'], onReorder }
		});
		const handle = handleOf('Sent') as HTMLElement;
		await userEvent.click(handle);
		await expect
			.element(page.getByRole('button', { name: 'Reorder Sent', exact: true }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: 'Reorder Sent', exact: true }))
			.toHaveFocus();
		await userEvent.keyboard('{ArrowUp}');
		expect(onReorder).toHaveBeenCalledWith({ key: 'Sent', to: 0 });
		await expect.poll(labels).toEqual(['Sent', 'Inbox', 'Drafts']);
	});

	it('moves nothing with the arrows outside reorder mode', async () => {
		const onReorder = vi.fn();
		await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent', 'Drafts'], onReorder }
		});
		const handle = handleOf('Inbox') as HTMLElement;
		handle.focus();
		await userEvent.keyboard('{ArrowDown}{ArrowUp}');
		expect(onReorder).not.toHaveBeenCalled();
		expect(labels()).toEqual(['Inbox', 'Sent', 'Drafts']);
	});

	it('leaves reorder mode with Escape, keeping its moves', async () => {
		const onReorder = vi.fn();
		await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent', 'Drafts'], onReorder }
		});
		const handle = handleOf('Inbox') as HTMLElement;
		handle.focus();
		await userEvent.keyboard(' {ArrowDown}{ArrowDown}');
		await userEvent.keyboard('{Escape}');
		expect(handle).toHaveAttribute('aria-pressed', 'false');
		expect(handle).toHaveFocus();
		expect(onReorder).toHaveBeenCalledTimes(2);
		await expect.poll(labels).toEqual(['Sent', 'Drafts', 'Inbox']);
		await vi.waitFor(() => expect(liveText()).toContain('Done, Inbox at position 3 of 3'));
		// Out of the mode, the arrows move nothing.
		await userEvent.keyboard('{ArrowUp}');
		expect(onReorder).toHaveBeenCalledTimes(2);
	});

	it("marks the row's place with the insertion line for the whole mode", async () => {
		await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent', 'Drafts'] }
		});
		const list = document.querySelector('ul') as HTMLElement;
		const handle = handleOf('Inbox') as HTMLElement;
		handle.focus();
		await userEvent.keyboard(' ');
		expect(list).toHaveAttribute('data-astryx-reorder-line');
		// From the start of the mode, before a move: the line sits on the first
		// row's top edge, at the list's top (thickness 2, centred).
		expect(list.style.getPropertyValue('--astryx-reorder-line-y')).toBe('-1px');
		await userEvent.keyboard('{ArrowDown}');
		expect(list).toHaveAttribute('data-astryx-reorder-line');
		expect(list.style.getPropertyValue('--astryx-reorder-line-y')).toMatch(/px$/);
		expect(list.children).toHaveLength(3);
		await userEvent.keyboard('{Escape}');
		expect(list).not.toHaveAttribute('data-astryx-reorder-line');
		expect(list.style.getPropertyValue('--astryx-reorder-line-y')).toBe('');
	});

	it('refuses a move into a row the object rejects at either end, announcing it, and passes one in the middle', async () => {
		const onReorder = vi.fn();
		await render(ListReorderFixture, {
			props: {
				initial: ['Pinned', 'Inbox', 'Sent', 'Locked', 'Drafts', 'Trash'],
				fixed: ['Pinned', 'Locked', 'Trash'],
				onReorder
			}
		});
		const handle = handleOf('Inbox') as HTMLElement;
		handle.focus();
		await userEvent.keyboard(' {ArrowUp}');
		expect(onReorder).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(liveText()).toContain("Can't move past Pinned"));
		// Down past Sent, past Locked (in the middle), past Drafts.
		await userEvent.keyboard('{ArrowDown}{ArrowDown}');
		expect(onReorder).toHaveBeenLastCalledWith({ key: 'Inbox', to: 3 });
		await vi.waitFor(() =>
			expect(liveText()).toContain('Inbox, position 4 of 6, after Locked, before Drafts')
		);
		await userEvent.keyboard('{ArrowDown}{ArrowDown}');
		expect(onReorder).toHaveBeenCalledTimes(3);
		expect(onReorder).toHaveBeenLastCalledWith({ key: 'Inbox', to: 4 });
		await expect.poll(labels).toEqual(['Pinned', 'Sent', 'Locked', 'Drafts', 'Inbox', 'Trash']);
		await vi.waitFor(() => expect(liveText()).toContain("Can't move past Trash"));
	});

	it('ignores arrows with a modifier: they are shortcuts', async () => {
		const onReorder = vi.fn();
		await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent'], onReorder }
		});
		const handle = handleOf('Inbox') as HTMLElement;
		await userEvent.click(handle);
		handle.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true })
		);
		handle.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowDown', metaKey: true, bubbles: true })
		);
		expect(onReorder).not.toHaveBeenCalled();
		expect(labels()).toEqual(['Inbox', 'Sent']);
	});

	it("keeps a disabled row's handle focusable but moves nothing", async () => {
		const onReorder = vi.fn();
		await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent'], isDisabled: ['Sent'], onReorder }
		});
		const handle = handleOf('Sent') as HTMLElement;
		expect(handle).toHaveAttribute('aria-disabled', 'true');
		handle.focus();
		expect(handle).toHaveFocus();
		await userEvent.keyboard(' {ArrowUp}{ArrowDown}');
		expect(onReorder).not.toHaveBeenCalled();
		expect(handle).toHaveAttribute('aria-pressed', 'false');
	});

	it('reports the item key as given, a string or a number', async () => {
		const onReorder = vi.fn();
		await render(ListReorderFixture, {
			props: { initial: [10, 20], onReorder }
		});
		const handles = Array.from(
			document.querySelectorAll<HTMLElement>('[data-astryx-list-reorder]')
		);
		expect(handles).toHaveLength(2);
		handles[1].focus();
		await userEvent.keyboard(' {ArrowUp}');
		expect(onReorder).toHaveBeenCalledWith({ key: 20, to: 0 });
	});

	it('shows a hint with the moves and Done while a row is in reorder mode', async () => {
		const onReorder = vi.fn();
		await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent'], onReorder }
		});
		const handle = handleOf('Inbox') as HTMLElement;
		await userEvent.click(handle);
		await expect
			.element(page.getByRole('button', { name: 'Move down', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Move up', exact: true }))
			.toBeInTheDocument();
		await userEvent.click(page.getByRole('button', { name: 'Move down', exact: true }));
		expect(onReorder).toHaveBeenCalledWith({ key: 'Inbox', to: 1 });
		// The focus stays on the handle.
		expect(handle).toHaveFocus();
		await userEvent.click(page.getByRole('button', { name: 'Done', exact: true }));
		expect(handle).toHaveAttribute('aria-pressed', 'false');
	});

	it('drags with a mouse past the slop: the source dims, a preview follows, and the drop reports once', async () => {
		const onReorder = vi.fn();
		await render(ListReorderFixture, {
			props: { initial: ['A', 'B', 'C'], onReorder }
		});
		const list = document.querySelector('ul') as HTMLElement;
		const handle = handleOf('A');
		const box = handle.getBoundingClientRect();
		const rows = Array.from(list.querySelectorAll('li'));
		const lastBox = rows[2].getBoundingClientRect();
		const x = box.left + box.width / 2;
		const y = box.top + box.height / 2;

		pointer(handle, 'pointerdown', x, y);
		// Under the slop: nothing is picked up.
		pointer(handle, 'pointermove', x, y + 1);
		expect(list).not.toHaveAttribute('data-astryx-reordering');
		// Past it, then down over the last row's lower edge.
		pointer(handle, 'pointermove', x, y + 10);
		expect(list).toHaveAttribute('data-astryx-reordering');
		pointer(handle, 'pointermove', x, lastBox.bottom + 4);
		await vi.waitFor(() => expect(liveText()).toContain('Picked up, position 1 of 3'));

		const source = rows[0];
		expect(source).toHaveAttribute('data-astryx-reorder-source');
		const preview = list.querySelector<HTMLElement>('[data-astryx-reorder-preview]');
		expect(preview).not.toBeNull();
		expect(preview).toHaveAttribute('aria-hidden', 'true');
		expect(preview?.textContent).toBe(source.textContent);
		expect(preview?.style.boxShadow).toBe('none');
		expect(preview?.nextElementSibling).toBe(source);
		expect(source.style.counterIncrement).toBe('none');
		expect(list).toHaveAttribute('data-astryx-reorder-line');
		expect(list.style.getPropertyValue('--astryx-reorder-line-y')).toMatch(/px$/);

		pointer(handle, 'pointerup', x, lastBox.bottom + 4, 0);
		expect(onReorder).toHaveBeenCalledTimes(1);
		expect(onReorder).toHaveBeenCalledWith({ key: 'A', to: 2 });
		await expect.poll(labels).toEqual(['B', 'C', 'A']);
		expect(list.querySelector('[data-astryx-reorder-preview]')).toBeNull();
		expect(list).not.toHaveAttribute('data-astryx-reorder-line');
		expect(list).not.toHaveAttribute('data-astryx-reordering');
		expect(source).not.toHaveAttribute('data-astryx-reorder-source');
		// The drag's own click leaves reorder mode off.
		handle.click();
		expect(handle).toHaveAttribute('aria-pressed', 'false');
	});

	it('keeps reorder mode when the object is made anew, and calls the latest onReorder', async () => {
		const onReorder = vi.fn();
		await render(ListReorderFixture, {
			props: { initial: ['Inbox', 'Sent'], remake: true, onReorder }
		});
		const handle = handleOf('Inbox');
		await userEvent.click(handle);
		expect(handle).toHaveAttribute('aria-pressed', 'true');
		await userEvent.keyboard('{ArrowDown}');
		expect(onReorder).toHaveBeenCalledWith({ key: 'Inbox', to: 1 });
		await expect.poll(labels).toEqual(['Sent', 'Inbox']);
		// The new object did not replace the session: the mode is still on.
		expect(handle).toHaveAttribute('aria-pressed', 'true');
		await userEvent.keyboard('{ArrowUp}');
		expect(onReorder).toHaveBeenLastCalledWith({ key: 'Inbox', to: 0 });
	});

	it("a click without a drag toggles reorder mode, and a drag's own click does not", async () => {
		await render(ListReorderFixture, {
			props: { initial: ['A', 'B'] }
		});
		const handle = handleOf('A') as HTMLElement;
		await userEvent.click(handle);
		expect(handle).toHaveAttribute('aria-pressed', 'true');
		await userEvent.click(handle);
		expect(handle).toHaveAttribute('aria-pressed', 'false');
	});
});
