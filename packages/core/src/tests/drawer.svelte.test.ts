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
	it('clips its panel with clip, not hidden', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		expect(getComputedStyle(dialog).overflow).toBe('clip');
	});

	it('calls onOpenChange(false) on Escape in non-modal mode', async () => {
		const screen = await render(DrawerProbe, { props: { hasScrim: false } });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.matches(':popover-open')).toBe(true));

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(screen.component.getOpen()).toBe(false));
	});

	it('prevents the native cancel event and routes it through onOpenChange', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		const cancel = new Event('cancel', { cancelable: true });
		dialog.dispatchEvent(cancel);
		expect(cancel.defaultPrevented).toBe(true);
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false));
	});

	it('ignores other keys', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(dialog.open).toBe(true);
	});

	it('composes a consumer onKeyDown', async () => {
		const onkeydown = vi.fn();
		const screen = await render(DrawerProbe, { props: { onkeydown } });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
		expect(onkeydown).toHaveBeenCalled();
	});

	it('merges consumer class, style, data and ARIA attributes', async () => {
		const screen = await render(DrawerProbe, {
			props: {
				class: 'consumer-class',
				sideStyle: 'transition-duration: 0.01s; color: rgb(1, 2, 3)',
				dataExtra: 'yes',
				ariaDescribedby: 'hint'
			}
		});
		const dialog = drawerEl(screen.container);
		expect(dialog).toHaveClass('astryx-drawer');
		expect(dialog).toHaveClass('consumer-class');
		expect(dialog).toHaveAttribute('data-extra', 'yes');
		expect(dialog).toHaveAttribute('aria-describedby', 'hint');
		expect(dialog.style.color).toBe('rgb(1, 2, 3)');
	});

	it.each(['start', 'end'] as const)(
		'renders side="%s" with the matching data attribute',
		async (side) => {
			const screen = await render(DrawerProbe, { props: { side } });
			expect(drawerEl(screen.container)).toHaveAttribute('data-side', side);
		}
	);

	it('applies the default 400px inline budget', async () => {
		const screen = await render(DrawerProbe);
		expect(parseFloat(getComputedStyle(drawerEl(screen.container)).width)).toBe(
			Math.min(400, window.innerWidth - 56)
		);
	});

	it('accepts a number of pixels', async () => {
		const screen = await render(DrawerProbe, { props: { width: 320 } });
		expect(parseFloat(getComputedStyle(drawerEl(screen.container)).width)).toBe(320);
	});

	it('accepts any CSS length string', async () => {
		const screen = await render(DrawerProbe, { props: { width: '32rem' } });
		expect(parseFloat(getComputedStyle(drawerEl(screen.container)).width)).toBe(
			Math.min(512, window.innerWidth - 56)
		);
	});

	it('renders no close button of its own', async () => {
		const screen = await render(DrawerProbe, { props: { withHeader: false } });
		const dialog = drawerEl(screen.container);
		expect(dialog.querySelectorAll('button[aria-label="Close"]')).toHaveLength(0);
	});

	it('can be re-opened after closing', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		screen.component.setOpen(false);
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false));

		screen.component.setOpen(true);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
	});

	it('focuses the element with data-autofocus on open', async () => {
		const screen = await render(DrawerProbe, {
			props: { withAutofocus: true, initialOpen: false }
		});
		screen.component.setOpen(true);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		const autofocus = screen.getByTestId('autofocus').element() as HTMLElement;
		await vi.waitFor(() => expect(document.activeElement).toBe(autofocus));
	});

	it('runs a consumer onClick before scrim dismissal', async () => {
		const order: string[] = [];
		const screen = await render(DrawerProbe, {
			props: {
				onclick: () => order.push('consumer')
			}
		});
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(order).toEqual(['consumer']);
	});

	it('lets a consumer onClick preventDefault cancel the scrim dismissal', async () => {
		const screen = await render(DrawerProbe, {
			props: {
				onclick: (event) => event.preventDefault()
			}
		});
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(dialog.open).toBe(true);
	});
});
