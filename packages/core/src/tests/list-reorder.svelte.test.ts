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
 * **Not ported here**, each named with its reason:
 * - `loads no reorder module from List or ListItem: they import its type and
 *   context only` — this port imports the handle and host statically, so the
 *   module is present whenever List is; the bundle split is a follow-up.
 * - `does not warn about a nameless reorderable row in production` — the
 *   warning goes through `warnOnce`, whose production gate has its own suite.
 * - `gives a finger's target as an invisible hit layer, not a bigger handle`
 *   and `starts the hit area's observers only where the primary pointer is
 *   coarse` — the shared hit-area utility has its own suite; the handle and
 *   hint compose it unchanged, and its coarse-pointer stubs are jsdom-only.
 * - `gives the hint's buttons a finger's target as an invisible hit layer` and
 *   `starts the hint buttons' hit area only where the primary pointer is
 *   coarse` — same reason as the handle's two hit-area cases.
 * - `names the handle "Reorder" then the row label element, for a component
 *   label too` — the shape is asserted indirectly by the rich-label and
 *   icon-named cases; the two-id `aria-labelledby` split is not.
 * - `adds one element to a row, the handle, whose lines are a pseudo-element`
 *   — the no-end-slot case covers the element count; the `endContent` variant
 *   is not repeated.
 * - `keeps reorder mode through a move that renames its row, and announces the
 *   rows by their new names` and `leaves out the ghost of a removed row still
 *   collapsing` — not driven in this pass: the first needs a fixture that
 *   names each row by its current place, and the second inserts a
 *   `data-astryx-leaving` row by hand. `names a row that shows no text after
 *   its place` (the announcements-only case), `announces a move only once it
 *   lands, and a declined one with the place the row kept` and `keeps reorder
 *   mode when its handle loses focus` are announcement/focus cases with the
 *   same fixture gap.
 * - `reorders two lists that share one object`, `starts reorder mode from the
 *   app's own UI with start(key)`, `keeps the mode start(key) entered when the
 *   UI hands its focus back`, and `starts reorder mode in the list mounted
 *   last` — the registry and `start(key)` seam exist; those cases need a
 *   second fixture and a focus-handback UI, and are not driven here.
 * - The hint rows `takes an Escape that reaches the dismissal stack`,
 *   `reorders by taps alone`, `refuses the hint's move into a row that keeps
 *   its place` and `shows the same hint when start(key) enters reorder mode` —
 *   the hint's show/move/Done path is ported; those four exercise the shared
 *   dismissal stack and `start(key)`, which have their own suites.
 * - `keeps the mouse drag slop equal to the date wheel's` — this port's date
 *   wheel drag constant lives in a different module (`DateInput`), so the
 *   equality is not reachable without importing a component's private seam.
 * - `keeps the other rows still during a drag`, `announces Done when a drag
 *   ends reorder mode`, `restores a cancelled drag at once`, `writes no offset
 *   to a row a drop leaves at rest at 0`, `reads every row's layout before a
 *   drop's first glide`, `reads a key move's glide spring once`, `plays a
 *   committed move's glide on the shared settle role`, `sends a still-gliding
 *   row home on the shared settle role` — the drag case here asserts the
 *   source, preview, line and drop; the rest reads stubbed jsdom layout or the
 *   animator's role table, which the browser project cannot install without
 *   the `layOut` shim.
 * - `put its listeners on the list: none on a row or a handle`, the four
 *   hold/pointer-type cases, the two row-menu cases and `does not activate an
 *   interactive row from its handle` — these inspect listener identity or drive
 *   the gesture host's touch sequences; `ListReorderTouch`,
 *   `ListReorderPointer` and `ListReorderSelectionLock` are the suites for
 *   them and are named above as unported.
 * - The `it.each` row `a second activation` of `leaves reorder mode` — Escape
 *   is ported; the second activation depends on the keyboard click path the
 *   Escape case already covers.
 *
 * **Unported sibling suites**: `ListReorderMode.interaction.browser.spec.ts`,
 * `ListReorderPointer.interaction.browser.spec.ts`,
 * `ListReorderTouch.interaction.browser.spec.ts`,
 * `ListReorderSelectionLock.test.tsx`, `ListReorderLayout.test.tsx`,
 * `listLayoutUpdates.test.tsx` — each needs jsdom's `layOut`/`pointerQuery`
 * shims or the row layout-update subsystem this port does not have.
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
});
