/** PORTS: Drawer/DrawerHeader.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import { userEvent } from 'vitest/browser';
import DrawerHeader from '$lib/components/drawer/drawer-header.svelte';

/**
 * Astryx's `Drawer/DrawerHeader.test.tsx` at the **0.7.13** pin, all eight
 * declarations. Chromium supplies the accessible roles and layout; the cases
 * read the same headings, slots, targets and close action upstream does.
 */
const zero = createRawSnippet(() => ({ render: () => '<span>0</span>' }));

describe('DrawerHeader', () => {
	it('renders the title as an h2 and the subtitle below it', async () => {
		const screen = await render(DrawerHeader, {
			props: { title: 'Details', subtitle: 'Inspector' }
		});
		expect(
			screen.getByRole('heading', { level: 2, name: 'Details', exact: true })
		).toBeInTheDocument();
		expect(screen.getByText('Inspector', { exact: true })).toBeInTheDocument();
	});

	it('renders no close button without onOpenChange', async () => {
		const screen = await render(DrawerHeader, { props: { title: 'Details' } });
		expect(screen.container.querySelectorAll('button')).toHaveLength(0);
	});

	it('renders a named close button that calls onOpenChange(false)', async () => {
		const onOpenChange = vi.fn();
		const screen = await render(DrawerHeader, {
			props: { title: 'Details', onOpenChange }
		});
		const close = screen.getByRole('button', { name: 'Close', exact: true });
		await userEvent.click(close);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('renders start and end content around the title', async () => {
		const start = createRawSnippet(() => ({ render: () => '<span>Back</span>' }));
		const end = createRawSnippet(() => ({ render: () => '<span>Actions</span>' }));
		const screen = await render(DrawerHeader, {
			props: { title: 'Details', startContent: start, endContent: end }
		});
		const heading = screen.getByRole('heading', { level: 2 });
		expect(heading).toBeInTheDocument();
		expect(screen.getByText('Back', { exact: true })).toBeInTheDocument();
		expect(screen.getByText('Actions', { exact: true })).toBeInTheDocument();
	});

	it('renders 0 values inside their start and end content slots', async () => {
		const screen = await render(DrawerHeader, {
			props: { title: 'Details', startContent: zero, endContent: zero }
		});
		expect(screen.getByText('0', { exact: true }).elements()).toHaveLength(2);
	});

	it('renders a 0 subtitle and skips an empty one', async () => {
		const zeroSubtitle = await render(DrawerHeader, {
			props: { title: 'Details', subtitle: 0 }
		});
		expect(zeroSubtitle.getByText('0', { exact: true })).toBeInTheDocument();
		zeroSubtitle.unmount();

		const empty = await render(DrawerHeader, { props: { title: 'Details', subtitle: '' } });
		expect(empty.getByRole('heading', { level: 2 })).toBeInTheDocument();
		expect(empty.container.textContent?.trim()).toBe('Details');
	});

	it('emits its theming targets', async () => {
		const start = createRawSnippet(() => ({ render: () => '<span>Back</span>' }));
		const end = createRawSnippet(() => ({ render: () => '<span>Actions</span>' }));
		const screen = await render(DrawerHeader, {
			props: {
				title: 'Details',
				subtitle: 'Inspector',
				startContent: start,
				endContent: end,
				onOpenChange: () => {}
			}
		});
		expect(screen.container.querySelector('.astryx-drawer-header')).not.toBeNull();
		expect(screen.container.querySelector('.astryx-drawer-header-start-content')).not.toBeNull();
		expect(screen.container.querySelector('.astryx-drawer-header-title-block')).not.toBeNull();
		expect(screen.container.querySelector('.astryx-drawer-header-end-content')).not.toBeNull();
		expect(screen.container.querySelector('.astryx-drawer-header-close-icon')).not.toBeNull();
	});

	it('does not move focus on mount', async () => {
		const before = document.body;
		before.focus();
		await render(DrawerHeader, { props: { title: 'Details' } });
		expect(document.activeElement).toBe(before);
	});
});
