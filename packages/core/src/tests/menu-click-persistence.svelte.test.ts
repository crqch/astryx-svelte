/** NO-UPSTREAM: coverage beyond upstream — the header below says why. */

import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import DropdownMenu from '$lib/components/dropdown-menu/dropdown-menu.svelte';
import MoreMenu from '$lib/components/more-menu/more-menu.svelte';
import Controlled from './fixtures/dropdown-menu-controlled.svelte';

/**
 * **Beyond upstream**, and deliberately so: upstream's `DropdownMenu` and
 * `MoreMenu` suites drive every open with `fireEvent.click`, which dispatches a
 * `click` and nothing else. That skips the menu press model, whose mouse path
 * opens on `pointerdown`, and it also skips the browser behaviour the press
 * model has to survive: a `popover="auto"` is light-dismissed by the release of
 * the very press that opened it, because the trigger is outside the popover.
 * jsdom has neither the Popover API nor the native dismissal, so no upstream
 * case can reach this; the port's own component suites inherited the same
 * click-only shape, which is why the regression shipped.
 *
 * The fix keeps the trigger the popover's invoker (`popovertarget`) for the
 * rest of the opening press, so the browser reads that release as invoker
 * activation rather than a dismissal. These cases therefore have to send real
 * pointer input: a bare `.click()` opens through `handleButtonClick` and never
 * exercises the press model at all.
 *
 * Mutation-checked: removing the `popovertarget` hold in `handleTriggerPress`'s
 * show path makes the first two cases fail with `aria-expanded="false"`.
 */

describe('menu press — a click persists', () => {
	it('leaves a DropdownMenu open after the mouse press that opened it', async () => {
		const screen = await render(DropdownMenu, {
			props: { button: { label: 'Actions' }, items: [{ label: 'Item 1' }] }
		});
		const trigger = screen.getByRole('button', { name: /Actions/ });

		await userEvent.click(trigger);

		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('toggles a DropdownMenu closed on the next real click', async () => {
		const screen = await render(DropdownMenu, {
			props: { button: { label: 'Actions' }, items: [{ label: 'Item 1' }] }
		});
		const trigger = screen.getByRole('button', { name: /Actions/ });

		await userEvent.click(trigger);
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');

		await userEvent.click(trigger);
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('opens a controlled DropdownMenu through a real click and keeps it open', async () => {
		const screen = await render(Controlled, { props: { items: [{ label: 'Item 1' }] } });
		const trigger = screen.getByRole('button', { name: /Actions/ });

		await userEvent.click(trigger);

		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('leaves a MoreMenu open after the mouse press that opened it', async () => {
		const screen = await render(MoreMenu, {
			props: { items: [{ label: 'Item 1' }] }
		});
		const trigger = screen.getByRole('button', { name: 'More options', exact: true });

		await userEvent.click(trigger);

		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('still dismisses on a real click outside', async () => {
		const screen = await render(DropdownMenu, {
			props: { button: { label: 'Actions' }, items: [{ label: 'Item 1' }] }
		});
		const trigger = screen.getByRole('button', { name: /Actions/ });

		await userEvent.click(trigger);
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');

		await userEvent.click(document.body);
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
	});
});
