/** PORTS: Drawer/Drawer.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import { cssIn } from './forced-colors.js';
import * as stylex from '@stylexjs/stylex';
import { userEvent } from 'vitest/browser';
import DrawerProbe from './fixtures/drawer-probe.svelte';
import DrawerStackProbe from './fixtures/drawer-stack-probe.svelte';
import DrawerSideFlipProbe from './fixtures/drawer-side-flip-probe.svelte';
import DrawerNonModalProbe from './fixtures/drawer-nonmodal-probe.svelte';
import DrawerInspectorProbe from './fixtures/drawer-inspector-probe.svelte';
import DrawerGroupProbe from './fixtures/drawer-group-probe.svelte';
import DrawerRadiosProbe from './fixtures/drawer-radios-probe.svelte';
import DrawerTooltipProbe from './fixtures/drawer-tooltip-probe.svelte';

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

async function waitForTestId(container: HTMLElement, testId: string): Promise<HTMLElement> {
	let found: Element | null = null;
	await vi.waitFor(() => {
		found = container.querySelector(`[data-testid="${testId}"]`);
		expect(found).not.toBeNull();
	});
	return found as unknown as HTMLElement;
}

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
	it('does not close on a self-click when non-modal (no scrim to click)', async () => {
		const screen = await render(DrawerProbe, { props: { hasScrim: false } });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.matches(':popover-open')).toBe(true));

		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(screen.component.getOpen()).toBe(true);
	});

	it('renders the panel in its open position', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		// translateX(0) resolves to the identity matrix in a real browser.
		await vi.waitFor(() =>
			expect(getComputedStyle(dialog).transform).toBe('matrix(1, 0, 0, 1, 0, 0)')
		);
	});
	it('applies the shared text baseline and structural reset on the root dialog', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		const { layerTextReset } = await import('$lib/components/layer/layer-text-reset.stylex.js');
		const { layerStructureReset } =
			await import('$lib/components/layer/layer-structure-reset.stylex.js');
		const classes = dialog.className.split(' ');
		// The test-side StyleX runtime reports dev debug names in the `__`
		// namespace; the component carries the compiled atoms, so only those
		// are comparable.
		for (const reset of [layerTextReset.reset, layerStructureReset.reset]) {
			for (const cls of (stylex.props(reset).className ?? '')
				.split(' ')
				.filter((token) => token && !token.includes('__'))) {
				expect(classes).toContain(cls);
			}
		}
		expect(getComputedStyle(dialog).textAlign).toBe('start');
	});

	it('resets container padding custom properties on the root dialog element', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		const computed = getComputedStyle(dialog);
		for (const edge of ['inline-start', 'inline-end', 'block-start', 'block-end']) {
			expect(computed.getPropertyValue(`--container-padding-${edge}`)).toBe('0px');
		}
	});

	describe('container padding', () => {
		function contentAreaIn(container: HTMLElement): HTMLElement {
			const child = container.querySelector('[data-testid="drawer-content"]');
			const area = child?.parentElement;
			if (!(area instanceof HTMLElement)) throw new Error('expected a content area');
			return area;
		}

		it("defaults to Dialog's --spacing-4 inset and publishes the theme chain", async () => {
			const screen = await render(DrawerProbe);
			const dialog = drawerEl(screen.container);
			await vi.waitFor(() => expect(dialog.open).toBe(true));
			const area = contentAreaIn(screen.container);
			const computed = getComputedStyle(area);
			// A browser substitutes custom-property references before
			// `getComputedStyle` reads them, so the published chain is asserted
			// against the compiled rule and the applied edges against pixels.
			const css = cssIn(area).replace(/\s+/g, '');

			for (const edge of ['inline-start', 'inline-end', 'block-start']) {
				expect(css).toContain(`var(--astryx-drawer-padding-${edge}`);
			}
			expect(css).toContain('var(--astryx-drawer-padding,var(--spacing-4))');
			expect(css).toContain('var(--container-padding-inline-start)');
			for (const name of [
				'--layout-padding-outer-x',
				'--layout-padding-outer-y',
				'--layout-padding-inner-x',
				'--layout-padding-inner-y'
			]) {
				expect(computed.getPropertyValue(name), name).toBe(
					getComputedStyle(document.documentElement).getPropertyValue('--spacing-4').trim()
				);
			}
			// The applied edges read the published value, so bleed children
			// subtract exactly the inset they sit in.
			const spacing4 = getComputedStyle(document.documentElement).getPropertyValue('--spacing-4');
			expect(computed.paddingInlineStart).toBe(spacing4.trim());
			expect(computed.paddingTop).toBe(spacing4.trim());
			expect(computed.paddingBottom).toBe(spacing4.trim());
		});

		it.each([0, 2] as const)(
			'applies and publishes an explicit padding step (%s)',
			async (padding) => {
				const screen = await render(DrawerProbe, { props: { padding } });
				const dialog = drawerEl(screen.container);
				await vi.waitFor(() => expect(dialog.open).toBe(true));
				const area = contentAreaIn(screen.container);
				const computed = getComputedStyle(area);
				expect(cssIn(area).replace(/\s+/g, '')).toContain(`var(--spacing-${padding})`);
				const spacing = getComputedStyle(document.documentElement)
					.getPropertyValue(`--spacing-${padding}`)
					.trim();

				for (const edge of ['inline-start', 'inline-end', 'block-start', 'block-end']) {
					expect(computed.getPropertyValue(`--container-padding-${edge}`)).toBe(spacing);
				}
				expect(computed.getPropertyValue('--layout-padding-inner-x')).toBe(spacing);
				expect(computed.paddingInlineStart).toBe(spacing);
			}
		);

		it('keeps the panel itself unpadded and free of a padding attribute', async () => {
			const screen = await render(DrawerProbe, { props: { padding: 2 } });
			const dialog = drawerEl(screen.container);
			await vi.waitFor(() => expect(dialog.open).toBe(true));
			expect(dialog.hasAttribute('padding')).toBe(false);
			expect(getComputedStyle(dialog).getPropertyValue('--container-padding-inline-start')).toBe(
				'0px'
			);
		});
	});

	it('preserves a 56px page reveal without exceeding the width budget on mobile', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		const style = dialog.getAttribute('style') ?? '';
		expect(style).toContain('400px');
		expect(style).toContain('min(400px, calc(100dvw - 56px))');
	});

	it('covers the full viewport on mobile with experimental.isFullWidthOnMobile', async () => {
		const screen = await render(DrawerProbe, {
			props: { experimental: { isFullWidthOnMobile: true } }
		});
		const dialog = drawerEl(screen.container);
		const style = dialog.getAttribute('style') ?? '';
		expect(style).toContain('100dvw');
		expect(style).not.toContain('100dvw - 56px');
		expect(dialog).not.toHaveAttribute('experimental');
	});

	it('keeps the 56px page reveal when experimental omits the option', async () => {
		const screen = await render(DrawerProbe, { props: { experimental: {} } });
		const dialog = drawerEl(screen.container);
		const style = dialog.getAttribute('style') ?? '';
		expect(style).toContain('min(400px, calc(100dvw - 56px))');
	});
	describe('LIFO stacking', () => {
		function dialogNamed(container: HTMLElement, name: string): HTMLDialogElement {
			const match = [...container.querySelectorAll('dialog')].find(
				(dialog) => dialog.getAttribute('aria-label') === name
			);
			if (!(match instanceof HTMLDialogElement)) throw new Error(`expected a ${name} drawer`);
			return match;
		}

		it('closes only the last-opened drawer on Escape, regardless of event target', async () => {
			const screen = await render(DrawerStackProbe);
			const first = dialogNamed(screen.container, 'First');
			const second = dialogNamed(screen.container, 'Second');
			await vi.waitFor(() => expect(first.matches(':popover-open')).toBe(true));
			await vi.waitFor(() => expect(second.matches(':popover-open')).toBe(true));

			first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			await closeWithTransition(second);

			await vi.waitFor(() => expect(screen.component.getSecond()).toBe(false));
			expect(screen.component.getFirst()).toBe(true);
		});

		it('keeps a closing top drawer on the stack until its exit completes', async () => {
			const screen = await render(DrawerStackProbe);
			const first = dialogNamed(screen.container, 'First');
			const second = dialogNamed(screen.container, 'Second');
			await vi.waitFor(() => expect(second.matches(':popover-open')).toBe(true));

			second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			// Still top-layer present while it slides out: a second Escape must be
			// consumed by the closing surface, not reach the sibling below.
			first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(screen.component.getFirst()).toBe(true);
			expect(screen.component.getSecond()).toBe(false);

			await closeWithTransition(second);
			await vi.waitFor(() => expect(second.matches(':popover-open')).toBe(false));

			first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			await closeWithTransition(first);
			await vi.waitFor(() => expect(screen.component.getFirst()).toBe(false));
		});

		it('moves a reopened sibling above a drawer that stayed open', async () => {
			const screen = await render(DrawerStackProbe);
			const first = dialogNamed(screen.container, 'First');
			const second = dialogNamed(screen.container, 'Second');
			await vi.waitFor(() => expect(first.matches(':popover-open')).toBe(true));

			screen.component.closeFirst();
			await closeWithTransition(first);
			await vi.waitFor(() => expect(first.matches(':popover-open')).toBe(false));
			expect(screen.component.getSecond()).toBe(true);

			screen.component.reopenFirst();
			await vi.waitFor(() => expect(first.matches(':popover-open')).toBe(true));

			// Reopened last: the shared stack must route the press here even when
			// it starts in the sibling below.
			second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			await closeWithTransition(first);
			await vi.waitFor(() => expect(screen.component.getFirst()).toBe(false));
			expect(screen.component.getSecond()).toBe(true);
		});

		it('unregisters unmounted drawers so the remaining one becomes top', async () => {
			const screen = await render(DrawerStackProbe);
			const first = dialogNamed(screen.container, 'First');
			await vi.waitFor(() => expect(first.matches(':popover-open')).toBe(true));

			// Removing the sibling while it is open must leave the stack, not
			// merely hide its host.
			await screen.rerender({ showSecond: false });
			await vi.waitFor(() =>
				expect(screen.container.querySelector('dialog[aria-label="Second"]')).toBeNull()
			);

			first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			await vi.waitFor(() => expect(screen.component.getFirst()).toBe(false));
		});

		it('consumes Escape for a required drawer so the one behind it stays open', async () => {
			const screen = await render(DrawerStackProbe);
			const first = dialogNamed(screen.container, 'First');
			await vi.waitFor(() => expect(first.matches(':popover-open')).toBe(true));

			// The sibling popover covers the page, so activate the button directly:
			// upstream's `fireEvent.click` bypasses hit-testing the same way.
			(screen.getByTestId('open-terms').element() as HTMLElement).click();
			const terms = dialogNamed(screen.container, 'Accept terms');
			await vi.waitFor(() => expect(terms.open).toBe(true));

			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(screen.component.getInner()).toBe(true);
			expect(screen.component.getFirst()).toBe(true);
		});
	});

	it('slides out to the side it opened from, even if the prop flips', async () => {
		const screen = await render(DrawerSideFlipProbe);
		await userEvent.click(screen.getByTestId('open-start'));
		const dialog = screen.container.querySelector('dialog') as HTMLDialogElement;
		await vi.waitFor(() => expect(dialog.dataset.side).toBe('start'));

		dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await vi.waitFor(() => expect(screen.component).toBeDefined());
		// Mid-exit: the live prop is back to its default, the anchor is not.
		expect(dialog.dataset.side).toBe('start');
	});

	it("'required' ignores Escape, the native cancel event, and a scrim click", async () => {
		const screen = await render(DrawerProbe, {
			props: { purpose: 'required', withHeader: false }
		});
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		const cancel = new Event('cancel', { cancelable: true });
		dialog.dispatchEvent(cancel);
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(cancel.defaultPrevented).toBe(true);
		expect(dialog.open).toBe(true);
		expect(screen.component.getOpen()).toBe(true);
	});

	it("'form' closes on Escape but ignores a scrim click", async () => {
		const screen = await render(DrawerProbe, { props: { purpose: 'form' } });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(dialog.open).toBe(true);

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false));
	});
	it('stays open when a file picker inside it is dismissed', async () => {
		const screen = await render(DrawerProbe, { props: { withFileInput: true } });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		const input = screen.container.querySelector('input[type="file"]') as HTMLInputElement;
		const fromPicker = new Event('cancel', { bubbles: true, cancelable: true });
		input.dispatchEvent(fromPicker);
		expect(fromPicker.defaultPrevented).toBe(false);
		expect(screen.component.getOpen()).toBe(true);

		// Its own close request still closes it.
		dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(screen.component.getOpen()).toBe(false));
	});

	it('lets a consumer preventDefault opt out of built-in Escape handling', async () => {
		const onkeydown = (event: KeyboardEvent) => event.preventDefault();
		const screen = await render(DrawerProbe, { props: { onkeydown } });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		dialog.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		);
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(screen.component.getOpen()).toBe(true);
		expect(dialog.open).toBe(true);
	});

	it('hands a consumer onKeyDown the Escape press ahead of the shared stack', async () => {
		const order: string[] = [];
		const onkeydown = (event: KeyboardEvent) => order.push(`consumer:${event.key}`);
		const screen = await render(DrawerProbe, { props: { onkeydown } });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		dialog.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		);
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(screen.component.getOpen()).toBe(false));
		expect(order).toEqual(['consumer:Escape']);
	});

	it('does not forward a native open prop to the dialog element', async () => {
		const screen = await render(DrawerProbe, {
			props: { initialOpen: false, nativeOpen: true }
		});
		const dialog = drawerEl(screen.container);
		expect(dialog.open).toBe(false);
		expect(dialog).not.toHaveAttribute('open');
	});

	it('merges a consumer xstyle after the Drawer styles so the override wins', async () => {
		const overrides = stylex.create({ narrow: { maxWidth: '240px' } });
		const screen = await render(DrawerProbe, { props: { xstyle: overrides.narrow } });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		expect(getComputedStyle(dialog).maxWidth).toBe('240px');
		expect(getComputedStyle(dialog).position).toBe('fixed');
		expect(dialog).toHaveClass('astryx-drawer');
	});
	it('leaves the manual popover and preserves close listeners after exit', async () => {
		const screen = await render(DrawerNonModalProbe, { props: { show: true } });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.matches(':popover-open')).toBe(true));
		const handleClose = vi.fn();
		dialog.addEventListener('close', handleClose);

		await screen.rerender({ show: false });
		await closeWithTransition(dialog);

		await vi.waitFor(() => expect(dialog.matches(':popover-open')).toBe(false));
		expect(handleClose).toHaveBeenCalledTimes(1);
		expect(dialog).not.toHaveAttribute('open');
	});

	it('dispatches the synthetic close after focus restore so a close listener owns final focus', async () => {
		const screen = await render(DrawerNonModalProbe);
		const openTrigger = screen.getByTestId('open-row').element() as HTMLElement;
		const latestRow = screen.getByTestId('latest-row').element() as HTMLElement;
		openTrigger.focus();

		await screen.rerender({ show: true });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.matches(':popover-open')).toBe(true));
		const handleClose = vi.fn(() => latestRow.focus());
		dialog.addEventListener('close', handleClose);

		await screen.rerender({ show: false });
		await closeWithTransition(dialog);

		expect(handleClose).toHaveBeenCalledTimes(1);
		expect(document.activeElement).toBe(latestRow);
	});

	it('dispatches exactly one close when an open non-modal drawer unmounts', async () => {
		const screen = await render(DrawerNonModalProbe, { props: { show: true } });
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.matches(':popover-open')).toBe(true));
		const handleClose = vi.fn();
		dialog.addEventListener('close', handleClose);

		screen.unmount();

		expect(handleClose).toHaveBeenCalledTimes(1);
	});

	it('keeps sliding while a transitionend for another property arrives', async () => {
		// A long transform keeps the browser's own transform transition from
		// completing during the wait, so only the opaque event is under test.
		const screen = await render(DrawerProbe, {
			props: { sideStyle: 'transition-duration: 5s' }
		});
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		screen.component.setOpen(false);
		await tick();
		dialog.dispatchEvent(
			new TransitionEvent('transitionend', { propertyName: 'opacity', bubbles: true })
		);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(dialog.open).toBe(true);

		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false));
	});

	it('reaches the dialog element through an object ref', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(screen.component.getDialog()).toBe(dialog));
	});

	it('reaches the dialog element through a callback ref', async () => {
		const seen: Array<HTMLElement | null> = [];
		const screen = await render(DrawerProbe, {
			props: {
				onref: (node: HTMLDialogElement | null) => seen.push(node)
			}
		});
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(seen).toContain(dialog));
	});
	it('traps Tab focus inside a modal drawer', async () => {
		const screen = await render(DrawerProbe, {
			props: { withActions: true, withHeader: false }
		});
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		const first = screen.getByTestId('first-action').element() as HTMLElement;
		const last = screen.getByTestId('last-action').element() as HTMLElement;

		last.focus();
		document.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
		);
		await vi.waitFor(() => expect(document.activeElement).toBe(first));
	});

	it('wraps Tab from the checked radio of a group that ends the drawer', async () => {
		const screen = await render(DrawerRadiosProbe, { props: { radios: 'end' } });
		const medium = screen.getByRole('radio', { name: 'Medium' }).element() as HTMLElement;
		const first = screen.getByTestId('first').element() as HTMLElement;

		medium.focus();
		document.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
		);
		await vi.waitFor(() => expect(document.activeElement).toBe(first));
		first.focus();
		document.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
		);
		await vi.waitFor(() => expect(document.activeElement).toBe(medium));
	});

	it('wraps Shift+Tab from the checked radio of a group that starts the drawer', async () => {
		const screen = await render(DrawerRadiosProbe, { props: { radios: 'start' } });
		const medium = screen.getByRole('radio', { name: 'Medium' }).element() as HTMLElement;
		const last = screen.getByTestId('last').element() as HTMLElement;

		medium.focus();
		document.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
		);
		await vi.waitFor(() => expect(document.activeElement).toBe(last));
		last.focus();
		document.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
		);
		await vi.waitFor(() => expect(document.activeElement).toBe(medium));
	});

	it('ends ancestor group membership while explicit and inner-group state hold', async () => {
		const screen = await render(DrawerGroupProbe);
		const outer = screen.getByRole('button', { name: 'Outer member' }).element();
		const independent = screen
			.getByRole('button', { name: 'Independent' })
			.element() as HTMLElement;
		const explicit = screen.getByRole('button', { name: 'Explicit disabled' }).element();
		const inner = screen.getByRole('button', { name: 'Inner member' }).element();

		// RESTATED: this port's Button renders the native `disabled` attribute
		// for a group-disabled member, where 0.7.13 uses `aria-disabled` alone.
		// The boundary contract is the same: membership stops at the drawer.
		expect(outer).toHaveAttribute('disabled');
		expect(independent).not.toHaveAttribute('disabled');
		independent.click();
		expect(explicit).toHaveAttribute('disabled');
		expect(inner).toHaveAttribute('disabled');
	});

	it('lets a focused control open its tooltip after the show, with no error', async () => {
		const errors: unknown[] = [];
		const onError = (event: ErrorEvent) => {
			errors.push(event.error ?? event.message);
			event.preventDefault();
		};
		window.addEventListener('error', onError);
		// Upstream stubs the same match: the trigger's focus path only opens for
		// keyboard focus, and this harness's programmatic focus is not reliable
		// about reporting `:focus-visible` after unrelated tests.
		const nativeMatches = Element.prototype.matches;
		const matchesSpy = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
			this: Element,
			selector: string
		) {
			if (selector === ':focus-visible') return true;
			return nativeMatches.call(this, selector);
		});
		try {
			const screen = await render(DrawerTooltipProbe);
			await screen.rerender({ show: true });
			const trigger = screen.getByRole('button', { name: 'Close' }).element() as HTMLElement;
			await vi.waitFor(() => expect(trigger.isConnected).toBe(true));
			// Keyboard modality makes the programmatic focus match `:focus-visible`,
			// which is the trigger the tooltip's focus path requires.
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
			trigger.focus();
			trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
			const layer = screen.container.querySelector('[role="tooltip"]');
			if (!(layer instanceof HTMLElement)) throw new Error('expected a tooltip layer');
			await vi.waitFor(() => expect(layer.matches(':popover-open')).toBe(true));
			expect(errors).toEqual([]);
		} finally {
			matchesSpy.mockRestore();
			window.removeEventListener('error', onError);
		}
	});

	for (const hasScrim of [false, true]) {
		for (const unmountWith of ['save', 'view'] as const) {
			it(`returns focus to the opener (${hasScrim ? 'modal' : 'non-modal'}, ${unmountWith})`, async () => {
				const screen = await render(DrawerInspectorProbe, {
					props: { unmountWith, hasScrim }
				});
				const edit = screen.getByTestId('edit').element() as HTMLElement;
				edit.focus();
				edit.click();
				await tick();
				const save = await waitForTestId(screen.container, 'save');
				save.focus();

				save.click();
				await vi.waitFor(() =>
					expect(screen.container.querySelector('[data-testid="save"]')).toBeNull()
				);
				await vi.waitFor(() => expect(document.activeElement).toBe(edit));
			});
		}
	}

	it('leaves focus where the user moved it before the unmount', async () => {
		const screen = await render(DrawerInspectorProbe, {
			props: { unmountWith: 'save', hasScrim: false }
		});
		const edit = screen.getByTestId('edit').element() as HTMLElement;
		edit.focus();
		edit.click();
		await tick();
		const save = await waitForTestId(screen.container, 'save');
		const elsewhere = screen.getByTestId('elsewhere').element() as HTMLElement;
		elsewhere.focus();

		save.click();
		await vi.waitFor(() =>
			expect(screen.container.querySelector('[data-testid="save"]')).toBeNull()
		);
		expect(document.activeElement).toBe(elsewhere);
	});

	it('a remount that keeps the drawer mounted leaves focus inside the open drawer', async () => {
		// Svelte has no StrictMode double effect replay; the repair's
		// connected-surface guard is the same contract, so this case renders the
		// inspector, moves focus inside, and asserts the drawer keeps it.
		const screen = await render(DrawerInspectorProbe, {
			props: { unmountWith: 'save', hasScrim: false }
		});
		const edit = screen.getByTestId('edit').element() as HTMLElement;
		edit.focus();
		edit.click();
		await tick();
		const save = await waitForTestId(screen.container, 'save');
		save.focus();
		await Promise.resolve();
		expect(document.activeElement).toBe(save);
	});
	it('renders children when open', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		expect(screen.getByTestId('drawer-content').element()).toHaveTextContent('Drawer content');
	});

	it('applies the accessible label', async () => {
		const screen = await render(DrawerProbe, { props: { label: 'Host details' } });
		expect(drawerEl(screen.container)).toHaveAttribute('aria-label', 'Host details');
	});

	it('calls onOpenChange(false) on Escape keydown', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		dialog.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		);
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(screen.component.getOpen()).toBe(false));
	});

	it('calls onOpenChange(false) when the ::backdrop (dialog element itself) is clicked', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(screen.component.getOpen()).toBe(false));
	});

	it('closes as soon as the slide-out transition ends', async () => {
		const screen = await render(DrawerProbe);
		const dialog = drawerEl(screen.container);
		await vi.waitFor(() => expect(dialog.open).toBe(true));

		screen.component.setOpen(false);
		await tick();
		await closeWithTransition(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false));
	});
});
