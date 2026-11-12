/** PORTS: Drawer/Drawer.ssr.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DrawerProbe from './fixtures/drawer-probe.svelte';

/**
 * The client half of Astryx's `Drawer/Drawer.ssr.test.tsx` — the two cases
 * that assert what happens after the server's closed markup reaches a browser.
 *
 * Upstream hydrates with `hydrateRoot` and counts `showModal` calls. Svelte's
 * hydration entry point is `hydrate()`, not a prop on `render`, and the
 * browser project's `render` mounts fresh; these are **restatements** in
 * mechanism: mounting an already-open Drawer is the same first-render-after-
 * markup state, and the presence hook is what opens it, so the case asserts
 * that transition rather than React's hydration bookkeeping. The settled-open
 * half of the third case is recorded in `port/debts.md` (no public hydration
 * flag in Svelte 5).
 */
describe('Drawer: open after mount (FR17)', () => {
	it('opens modally in the render after mount, without surfacing an error', async () => {
		const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
		const logged = vi.spyOn(console, 'error');
		const screen = await render(DrawerProbe);
		const dialog = screen.container.querySelector('dialog[data-testid="drawer"]');
		if (!(dialog instanceof HTMLDialogElement)) throw new Error('expected a drawer');

		await vi.waitFor(() => expect(dialog.open).toBe(true));
		expect(showModal).toHaveBeenCalledTimes(1);
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(logged).not.toHaveBeenCalled();
		showModal.mockRestore();
		logged.mockRestore();
	});

	it('animates a client open and keeps the same transition on a later open', async () => {
		const screen = await render(DrawerProbe, { props: { sideStyle: '' } });
		const dialog = screen.container.querySelector('dialog[data-testid="drawer"]');
		if (!(dialog instanceof HTMLDialogElement)) throw new Error('expected a drawer');
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		const clientMotion = getComputedStyle(dialog).transitionDuration;
		expect(clientMotion).not.toBe('0.01s');

		screen.component.setOpen(false);
		dialog.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'transform' }));
		await vi.waitFor(() => expect(dialog.open).toBe(false));

		screen.component.setOpen(true);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		expect(getComputedStyle(dialog).transitionDuration).toBe(clientMotion);
	});
});
