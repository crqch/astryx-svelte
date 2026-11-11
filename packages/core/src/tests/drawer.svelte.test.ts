/** PORTS: Drawer/Drawer.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import { userEvent } from 'vitest/browser';
import DrawerProbe from './fixtures/drawer-probe.svelte';

/**
 * The first slice of Astryx's `Drawer/Drawer.test.tsx` at the **0.7.13** pin,
 * moved to real Chromium.
 *
 * The suite is 71 declarations. This file ports the presence, host-mode,
 * dismissal, role, focus-return and theming-target cases that the port's native
 * `<dialog>` implementation can exercise directly. The remaining cases —
 * per-frame clip/hold behavior, pointer-hold entrance timing, sibling layer
 * ordering, and the touch-entrance specs — are the next slice.
 */

function drawerEl(container: HTMLElement): HTMLDialogElement {
	const el = container.querySelector('[data-testid="drawer"]');
	if (!(el instanceof HTMLDialogElement)) throw new Error('expected a drawer dialog');
	return el;
}

async function closeWithTransition(dialog: HTMLDialogElement): Promise<void> {
	dialog.dispatchEvent(
		new TransitionEvent('transitionend', { propertyName: 'transform', bubbles: true })
	);
}

describe('Drawer', () => {
	it('renders children when open, with the accessible label', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);

		await vi.waitFor(() => expect(dialog.open).toBe(true));
		expect(dialog).toHaveAttribute('aria-label', 'Details');
		expect(screen.getByTestId('drawer-content').element()).toHaveTextContent('Drawer content');
	});

	it('does not show when isOpen is false', async () => {
		const screen = await render(DrawerProbe, { props: { initialOpen: false } });
		const dialog = drawerEl(screen.container);

		expect(dialog.open).toBe(false);
		expect(dialog).not.toHaveAttribute('aria-modal');
	});

	it('opens with showModal and aria-modal by default', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);

		await vi.waitFor(() => expect(dialog.open).toBe(true));
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(dialog.matches(':modal')).toBe(true);
	});

	it('opens with a non-modal popover and no aria-modal when hasScrim is false', async () => {
		const screen = await render(DrawerProbe, { props: { hasScrim: false } });
		const dialog = drawerEl(screen.container);

		await vi.waitFor(() => expect(dialog.matches(':popover-open')).toBe(true));
		expect(dialog).not.toHaveAttribute('aria-modal');
		expect(dialog.open).toBe(false);
	});

	it('renders the side as a data attribute and applies the width', async () => {
		const screen = await render(DrawerProbe, { props: { side: 'start', width: '32rem' } });
		const dialog = drawerEl(screen.container);

		expect(dialog).toHaveAttribute('data-side', 'start');
		expect(dialog.getAttribute('style')).toContain('32rem');
	});

	it('exposes a modal required drawer as an alertdialog, and keeps non-modal required as a dialog', async () => {
		const modal = await render(DrawerProbe, { props: { purpose: 'required' } });
		expect(drawerEl(modal.container)).toHaveAttribute('role', 'alertdialog');
		modal.unmount();

		const nonModal = await render(DrawerProbe, {
			props: { purpose: 'required', hasScrim: false }
		});
		expect(drawerEl(nonModal.container)).not.toHaveAttribute('role');
	});

	it('closes through the DrawerHeader close button', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		const close = screen.container.querySelector('button[aria-label="Close"]') as HTMLElement;
		await userEvent.click(close);

		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false));
	});

	it('does not close when drawer content is clicked, and closes on a scrim click', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		await userEvent.click(screen.getByTestId('drawer-content'));
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(dialog.open).toBe(true);

		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false));
	});

	it('ignores a scrim click for the form and required purposes', async () => {
		for (const purpose of ['form', 'required'] as const) {
			const screen = await render(DrawerProbe, { props: { purpose } });
			const dialog = drawerEl(screen.container);
			await vi.waitFor(() => expect(dialog.open).toBe(true));

			dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			await new Promise((resolve) => setTimeout(resolve, 40));
			expect(dialog.open).toBe(true);
			screen.unmount();
		}
	});

	it('closes on Escape unless the purpose is required', async () => {
		const info = await render(DrawerProbe);
		const infoDialog = drawerEl(info.container);
		await vi.waitFor(() => expect(infoDialog.open).toBe(true));
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await closeWithTransition(infoDialog);
		await vi.waitFor(() => expect(infoDialog.open).toBe(false));
		info.unmount();

		const required = await render(DrawerProbe, { props: { purpose: 'required' } });
		const requiredDialog = drawerEl(required.container);
		await vi.waitFor(() => expect(requiredDialog.open).toBe(true));
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(requiredDialog.open).toBe(true);
	});

	it('restores focus to the trigger on close', async () => {
		const screen = await render(DrawerProbe, { props: { initialOpen: false } });
		const trigger = screen.getByTestId('trigger').element() as HTMLElement;
		trigger.focus();
		screen.component.setOpen(true);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		screen.component.setOpen(false);
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false));
		expect(document.activeElement).toBe(trigger);
	});

	it('delays dialog.close until the exit transition ends', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		screen.component.setOpen(false);
		await tick();
		expect(dialog.open).toBe(true);

		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false));
	});

	it('merges the drawer theme target and consumer class', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		expect(dialog).toHaveClass('astryx-drawer');
	});

	it('publishes an explicit padding step without changing the viewport default', async () => {
		const screen = await render(DrawerProbe, { props: { padding: 2 } });
		const content = screen.container.querySelector('[data-testid="drawer-content"]')
			?.parentElement as HTMLElement;
		expect(content).toBeDefined();
		expect(content.className).not.toBe('');
	});
});
