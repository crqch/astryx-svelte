/** PORTS: Typeahead/BaseTypeahead.menu.test.tsx */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import BaseTypeaheadFixture from './fixtures/base-typeahead-menu-fixture.svelte';
import TypeaheadFixture from './fixtures/typeahead-menu-fixture.svelte';
import TokenizerFixture from './fixtures/tokenizer-menu-fixture.svelte';
import type { SearchSource, SearchableItem } from '$lib/components/typeahead/types.js';
import { __resetDevWarnings } from '$lib/utils/dev-warning.js';
import { __resetLiveRegionsForTest } from '$lib/hooks/use-announce.js';

/**
 * Astryx's `Typeahead/BaseTypeahead.menu.test.tsx`, ported case for case where
 * the Svelte seams allow it. Upstream declares 29 cases; 16 are ported here and
 * 13 are named below with their reason.
 *
 * ## The ported cases
 *
 * - `listbox role`: information around the result list; the dev warning for a
 *   control outside it.
 * - `dialog role`: opens from the handle; Escape focus return; focus return
 *   when the opener is gone; outside press; opens only from the handle; stays
 *   open on an emptied input or blur.
 * - `switching role`: a pick that switches the menu to a dialog keeps the same
 *   layer open.
 * - `closing a dialog that a pick opened`: Escape and `close()` leave the list
 *   closed; an outside press does the same.
 * - `a pick that calls open() and stays a listbox`: reloads focus entries; a
 *   field without them closes with focus in the input.
 * - `forwarding`: `Typeahead` forwards the menu and the handle; `Tokenizer`
 *   forwards the menu, the handle and `onOpenChange`.
 *
 * ## The 13 unported cases, in upstream's order
 *
 * 1. `close() after an await does not reopen the list` — the dialog render
 *    needs an awaited Save button. The synchronous `close()` case covers the
 *    same state transition; the await defers no BaseTypeahead work, only the
 *    caller's promise.
 * 2. `closing a dialog a pick opened in a Typeahead with a value returns focus
 *    to the token` (`it.each`, three rows) — needs upstream's
 *    `BaseTypeaheadFocusContext` (`inputReturnTarget` / `menuFocusReturn`),
 *    which this port has not adopted. The base returns focus to its opener and
 *    falls back to the input instead.
 * 3. `Escape returns focus to a Tokenizer token whose button opened the dialog`
 *    — same missing focus context: the token's button is the opener when it
 *    holds focus, but a button that is already gone has no input-return target.
 * 4. `Escape returns focus to a token whose click did not focus it, as in
 *    Safari` (`it.each`, two rows) — upstream records the pressed control
 *    through `pressedOpener`; no such context exists here.
 * 5. `a press on a token released outside the field records no opener for a
 *    later dialog` — same `pressedOpener` seam.
 * 6. `a token click that stops propagation records no opener for a later
 *    dialog` — same `pressedOpener` seam.
 * 7. `a click on a custom token's own control leaves focus on it` — Tokenizer
 *    token focus behaviour, not the menu or handle; the Tokenizer suite owns
 *    it.
 * 8. `when the press is released outside the field` (custom token control) —
 *    same Tokenizer focus behaviour.
 * 9. `when the click stops propagation` (custom token control) — same Tokenizer
 *    focus behaviour.
 * 10. `when the click completes` (`endContent`) — same Tokenizer focus
 *    behaviour.
 * 11. `when the press is released outside the field` (`endContent`) — same
 *    Tokenizer focus behaviour.
 * 12. `when the click stops propagation` (`endContent`) — same Tokenizer focus
 *    behaviour.
 * 13. `a press on a token released outside the field still lets Tab land on the
 *    input` — same pressed-opener seam.
 *
 * (`it.each` counts once in the case delta, as upstream's declaration does;
 * its extra rows are named in the reason rather than counted.)
 *
 * Runs in the **client (real Chromium)** project, so upstream's
 * `showPopover`/`:popover-open` stubs are gone — Chromium implements the real
 * thing. `fireEvent.change` becomes `setQuery`, and `act()` has no counterpart.
 */

const fruits: SearchSource<SearchableItem> = {
	search: (query: string) =>
		[
			{ id: 'apple', label: 'Apple' },
			{ id: 'apricot', label: 'Apricot' },
			{ id: 'see-all', label: 'See all results' }
		].filter((item) =>
			item.id === 'see-all' ? true : item.label.toLowerCase().includes(query.toLowerCase())
		),
	bootstrap: () => []
};

const focusEntries: SearchSource<SearchableItem> = {
	...fruits,
	bootstrap: () => [{ id: 'banana', label: 'Banana' }]
};

function setQuery(input: HTMLInputElement, value: string): void {
	const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
	setter?.call(input, value);
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

function comboboxIn(container: HTMLElement): HTMLInputElement {
	const el = container.querySelector('input[role="combobox"]');
	if (!(el instanceof HTMLInputElement)) throw new Error('expected a role="combobox" input');
	return el;
}

function optionsIn(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
}

function optionNamed(container: HTMLElement, text: string): HTMLElement {
	const el = optionsIn(container).find((option) => option.textContent?.trim() === text);
	if (!el) throw new Error(`no option named "${text}"`);
	return el;
}

function dialogIn(container: HTMLElement): HTMLElement | null {
	return container.querySelector<HTMLElement>('[role="dialog"]');
}

function isLayerOpen(element: HTMLElement): boolean {
	return element.closest<HTMLElement>('[popover]')?.matches(':popover-open') ?? false;
}

function buttonIn(container: HTMLElement, name: string): HTMLButtonElement {
	const el = Array.from(container.querySelectorAll('button')).find(
		(button) => button.textContent?.trim() === name
	);
	if (!(el instanceof HTMLButtonElement)) throw new Error(`no button named "${name}"`);
	return el;
}

async function openDialogFromPick(source: SearchSource<SearchableItem> = fruits) {
	const user = userEvent.setup();
	const screen = await render(BaseTypeaheadFixture, {
		props: { variant: 'field-picker' as const, searchSource: source }
	});
	const input = comboboxIn(screen.container);
	input.focus();
	await user.type(input, 'apr');
	await vi.waitFor(() => {
		expect(input).toHaveAttribute('aria-expanded', 'true');
	});
	await user.keyboard('{Enter}');
	const dialog = await vi.waitFor(() => {
		const next = dialogIn(screen.container);
		expect(next).not.toBeNull();
		return next!;
	});
	await vi.waitFor(() => {
		expect(dialog.contains(document.activeElement)).toBe(true);
	});
	return { user, screen, input, dialog };
}

afterEach(() => {
	__resetLiveRegionsForTest();
	__resetDevWarnings();
	vi.restoreAllMocks();
});

describe('BaseTypeahead menu', () => {
	describe('listbox role', () => {
		it('shows information around the result list, and the list stays the only listbox', async () => {
			const user = userEvent.setup();
			const screen = await render(BaseTypeaheadFixture, {
				props: { variant: 'listbox-header' as const, searchSource: fruits }
			});

			const input = comboboxIn(screen.container);
			input.focus();
			await user.type(input, 'ap');
			await vi.waitFor(() => {
				expect(input).toHaveAttribute('aria-expanded', 'true');
			});

			const listboxes = screen.container.querySelectorAll('[role="listbox"]');
			expect(listboxes).toHaveLength(1);
			const listbox = listboxes[0] as HTMLElement;
			const header = Array.from(screen.container.querySelectorAll('div')).find(
				(element) => element.textContent === 'Results for ap'
			);
			expect(header).toBeDefined();
			expect(listbox.contains(header!)).toBe(false);
			expect(header!.closest('[role]')).not.toBe(listbox);
			expect(input).toHaveAttribute('aria-controls', listbox.id);

			// The arrow keys reach every result, "See all results" included.
			await user.keyboard('{ArrowDown}{ArrowDown}');
			const active = await vi.waitFor(() => {
				const id = input.getAttribute('aria-activedescendant') ?? '';
				const element = document.getElementById(id);
				expect(element).not.toBeNull();
				return element!;
			});
			expect(active).toHaveTextContent('See all results');
			expect(listbox.contains(active)).toBe(true);
		});

		it('warns in development when a control sits outside the result list', async () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const user = userEvent.setup();
			const screen = await render(BaseTypeaheadFixture, {
				props: { variant: 'listbox-control' as const, searchSource: fruits }
			});

			const input = comboboxIn(screen.container);
			input.focus();
			await user.type(input, 'ap');
			await vi.waitFor(() => {
				expect(screen.container.querySelector('[role="listbox"]')).not.toBeNull();
			});
			await vi.waitFor(() => {
				expect(
					warn.mock.calls.some((call) => call.join(' ').includes('outside the result list'))
				).toBe(true);
			});
		});
	});

	describe('dialog role', () => {
		it('opens a named dialog from the handle and moves focus into it', async () => {
			const user = userEvent.setup();
			const onOpenChange = vi.fn();
			const screen = await render(BaseTypeaheadFixture, {
				props: { variant: 'editor' as const, searchSource: fruits, onOpenChange }
			});

			await user.click(buttonIn(screen.container, 'Status: is Open'));
			const dialog = await vi.waitFor(() => {
				const next = dialogIn(screen.container);
				expect(next).not.toBeNull();
				return next!;
			});
			expect(dialog.getAttribute('aria-label')).toBe('Status');
			expect(isLayerOpen(dialog)).toBe(true);
			expect(onOpenChange).toHaveBeenLastCalledWith(true);

			const input = comboboxIn(screen.container);
			expect(input).toHaveAttribute('aria-haspopup', 'dialog');
			expect(input).toHaveAttribute('aria-expanded', 'true');
			const controlled = document.getElementById(input.getAttribute('aria-controls') ?? '');
			expect(controlled?.contains(dialog)).toBe(true);
			expect(input).not.toHaveAttribute('aria-activedescendant');
			await vi.waitFor(() => {
				expect(dialog.contains(document.activeElement)).toBe(true);
			});
		});

		it('returns focus on Escape to the element focused when it opened', async () => {
			const user = userEvent.setup();
			const screen = await render(BaseTypeaheadFixture, {
				props: { variant: 'editor' as const, searchSource: fruits }
			});
			const opener = buttonIn(screen.container, 'Status: is Open');

			opener.focus();
			await user.keyboard('{Enter}');
			const dialog = await vi.waitFor(() => {
				const next = dialogIn(screen.container);
				expect(next).not.toBeNull();
				return next!;
			});
			await vi.waitFor(() => {
				expect(dialog.contains(document.activeElement)).toBe(true);
			});
			await user.keyboard('{Escape}');

			await vi.waitFor(() => expect(opener).toHaveFocus());
			expect(isLayerOpen(dialog)).toBe(false);
		});

		it('returns focus to the input when the opener is gone', async () => {
			const user = userEvent.setup();
			const screen = await render(BaseTypeaheadFixture, {
				props: { variant: 'editor' as const, searchSource: fruits, removeOpener: true }
			});

			buttonIn(screen.container, 'Status: is Open').focus();
			await user.keyboard('{Enter}');
			const dialog = await vi.waitFor(() => {
				const next = dialogIn(screen.container);
				expect(next).not.toBeNull();
				return next!;
			});
			await vi.waitFor(() => {
				expect(dialog.contains(document.activeElement)).toBe(true);
			});
			await user.click(buttonIn(screen.container, 'Cancel'));

			await vi.waitFor(() => expect(comboboxIn(screen.container)).toHaveFocus());
		});

		it('closes on a press outside the field and the dialog, and keeps a press inside', async () => {
			const user = userEvent.setup();
			const screen = await render(BaseTypeaheadFixture, {
				props: { variant: 'editor' as const, searchSource: fruits }
			});
			await user.click(buttonIn(screen.container, 'Status: is Open'));
			const dialog = await vi.waitFor(() => {
				const next = dialogIn(screen.container);
				expect(next).not.toBeNull();
				return next!;
			});
			await vi.waitFor(() => expect(isLayerOpen(dialog)).toBe(true));

			const value = dialog.querySelector<HTMLInputElement>('input[aria-label="Value"]');
			await user.click(value!);
			expect(isLayerOpen(dialog)).toBe(true);

			await user.click(buttonIn(screen.container, 'Elsewhere'));
			await vi.waitFor(() => expect(isLayerOpen(dialog)).toBe(false));
		});

		it('opens only from the handle: typing, focus and ArrowDown leave it closed', async () => {
			const user = userEvent.setup();
			const onOpenChange = vi.fn();
			const screen = await render(BaseTypeaheadFixture, {
				props: {
					variant: 'editor' as const,
					searchSource: fruits,
					hasEntriesOnFocus: true,
					onOpenChange
				}
			});
			const input = comboboxIn(screen.container);
			await user.click(input);
			await user.type(input, 'ap');
			await user.keyboard('{ArrowDown}');

			expect(input).toHaveValue('ap');
			expect(input).toHaveFocus();
			expect(input).toHaveAttribute('aria-expanded', 'false');
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it('stays open when the input is emptied or loses focus', async () => {
			const screen = await render(BaseTypeaheadFixture, {
				props: { variant: 'editor' as const, searchSource: fruits }
			});
			const input = comboboxIn(screen.container);
			input.focus();
			setQuery(input, 'a');
			screen.component.open();
			const dialog = await vi.waitFor(() => {
				const next = dialogIn(screen.container);
				expect(next).not.toBeNull();
				return next!;
			});
			await vi.waitFor(() => expect(isLayerOpen(dialog)).toBe(true));

			input.focus();
			setQuery(input, '');
			expect(isLayerOpen(dialog)).toBe(true);
			buttonIn(screen.container, 'Elsewhere').focus();
			expect(isLayerOpen(dialog)).toBe(true);

			screen.component.close();
			expect(isLayerOpen(dialog)).toBe(false);
		});
	});

	describe('switching role', () => {
		it('keeps the menu open when a pick switches it to a dialog', async () => {
			const user = userEvent.setup();
			const onOpenChange = vi.fn();
			const screen = await render(BaseTypeaheadFixture, {
				props: { variant: 'field-picker' as const, searchSource: fruits, onOpenChange }
			});
			const input = comboboxIn(screen.container);
			input.focus();
			await user.type(input, 'apr');
			const listbox = await vi.waitFor(() => {
				const next = screen.container.querySelector<HTMLElement>('[role="listbox"]');
				expect(next).not.toBeNull();
				return next!;
			});
			const layer = listbox.closest('[popover]');
			expect(onOpenChange).toHaveBeenLastCalledWith(true);
			onOpenChange.mockClear();

			await user.keyboard('{Enter}');

			const dialog = await vi.waitFor(() => {
				const next = dialogIn(screen.container);
				expect(next).not.toBeNull();
				return next!;
			});
			expect(dialog.getAttribute('aria-label')).toBe('Apricot');
			// The same layer, never hidden between the list and the dialog.
			expect(dialog.closest('[popover]')).toBe(layer);
			expect(isLayerOpen(dialog)).toBe(true);
			expect(onOpenChange).not.toHaveBeenCalled();
			await vi.waitFor(() => {
				expect(dialog.contains(document.activeElement)).toBe(true);
			});
		});
	});

	describe('closing a dialog that a pick opened', () => {
		it('Escape closes it in one press and does not reopen the list', async () => {
			const { user, input, dialog } = await openDialogFromPick();
			await user.keyboard('{Escape}');
			await vi.waitFor(() => expect(input).toHaveFocus());
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(input).toHaveAttribute('aria-expanded', 'false');
			expect(isLayerOpen(dialog)).toBe(false);
		});

		it('close() does not reopen the list', async () => {
			const { user, screen, input, dialog } = await openDialogFromPick();
			await user.click(buttonIn(screen.container, 'Cancel'));
			await vi.waitFor(() => expect(input).toHaveFocus());
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(input).toHaveAttribute('aria-expanded', 'false');
			expect(isLayerOpen(dialog)).toBe(false);
		});

		it('a press outside closes it and leaves the list closed', async () => {
			const { user, input, dialog } = await openDialogFromPick();
			// The fixture has no `Elsewhere` sibling in this variant; a detached
			// element in the document is enough for the layer's light dismiss.
			const elsewhere = document.createElement('button');
			elsewhere.type = 'button';
			elsewhere.textContent = 'Elsewhere';
			// Bottom-left keeps the control clear of a layer anchored below the
			// field: the top-layer popover would otherwise intercept the real click.
			elsewhere.style.cssText =
				'position: fixed; inset-block-end: 0; inset-inline-start: 0; z-index: 2147483647';
			document.body.appendChild(elsewhere);
			try {
				await user.click(elsewhere);
				await vi.waitFor(() => expect(isLayerOpen(dialog)).toBe(false));
				await new Promise((resolve) => setTimeout(resolve, 50));
				expect(input).toHaveAttribute('aria-expanded', 'false');
			} finally {
				elsewhere.remove();
			}
		});
	});

	describe('a pick that calls open() and stays a listbox', () => {
		it('reloads the focus entries, with focus back in the input', async () => {
			const user = userEvent.setup();
			const screen = await render(BaseTypeaheadFixture, {
				props: {
					variant: 'picker-listbox' as const,
					searchSource: focusEntries,
					hasEntriesOnFocus: true
				}
			});
			const input = comboboxIn(screen.container);
			input.focus();
			await user.type(input, 'apr');
			await user.click(await vi.waitFor(() => optionNamed(screen.container, 'Apricot')));

			expect(input).toHaveFocus();
			await vi.waitFor(() => {
				expect(optionNamed(screen.container, 'Banana')).toBeInTheDocument();
			});
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		it('closes with focus in the input when there are no focus entries', async () => {
			const user = userEvent.setup();
			const screen = await render(BaseTypeaheadFixture, {
				props: {
					variant: 'picker-listbox' as const,
					searchSource: fruits,
					hasEntriesOnFocus: false
				}
			});
			const input = comboboxIn(screen.container);
			input.focus();
			await user.type(input, 'apr');
			await user.click(await vi.waitFor(() => optionNamed(screen.container, 'Apricot')));

			expect(input).toHaveFocus();
			await vi.waitFor(() => {
				expect(input).toHaveAttribute('aria-expanded', 'false');
			});
		});
	});

	describe('forwarding', () => {
		it('Typeahead forwards the menu and the handle', async () => {
			const user = userEvent.setup();
			const screen = await render(TypeaheadFixture, {
				props: { searchSource: fruits }
			});
			screen.component.open();
			const dialog = await vi.waitFor(() => {
				const next = dialogIn(screen.container);
				expect(next).not.toBeNull();
				return next!;
			});
			expect(dialog.getAttribute('aria-label')).toBe('Pick');
			expect(isLayerOpen(dialog)).toBe(true);
			await user.click(buttonIn(screen.container, 'Done'));
			expect(isLayerOpen(dialog)).toBe(false);
		});

		it('Tokenizer forwards the menu, the handle and onOpenChange', async () => {
			const onOpenChange = vi.fn();
			const screen = await render(TokenizerFixture, {
				props: { searchSource: fruits, onOpenChange }
			});
			screen.component.open();
			const dialog = await vi.waitFor(() => {
				const next = dialogIn(screen.container);
				expect(next).not.toBeNull();
				return next!;
			});
			expect(isLayerOpen(dialog)).toBe(true);
			expect(onOpenChange).toHaveBeenLastCalledWith(true);

			screen.component.close();
			expect(isLayerOpen(dialog)).toBe(false);
			expect(onOpenChange).toHaveBeenLastCalledWith(false);
		});
	});
});
