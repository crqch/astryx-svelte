/** PORTS: Table/TableSelectionToolbar.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TableSelectionToolbarFixture from './fixtures/table-selection-toolbar-fixture.svelte';
import type { TableSelectionState } from '$lib/components/table/plugins/selection/use-table-selection-state.svelte.js';

/**
 * Astryx's `Table/TableSelectionToolbar.test.tsx`, all 5 cases at the 0.7.13
 * pin, in upstream's order and under its titles.
 *
 * Upstream's `createSelectionState` is the same helper here — the component's
 * `selection` prop is a plain state object, so the test owns it rather than
 * mounting a table. The one translation is the harness: `startContent` and
 * `renderSelectionLabel` are snippets, which can only be authored in a
 * template, so the five renders go through
 * `fixtures/table-selection-toolbar-fixture.svelte`.
 *
 * Standing translations: `render` is async and takes `{ props }`; a string
 * `name` carries `exact: true`; a missing element is asserted through
 * `.query()` (a Vitest locator has no `not.toBeInTheDocument` retry for an
 * element that will never appear).
 */

function createSelectionState(
	selectedKeys: ReadonlySet<string>,
	clearSelection = vi.fn()
): TableSelectionState {
	return {
		selectedKeys,
		selectedCount: selectedKeys.size,
		hasSelection: selectedKeys.size > 0,
		clearSelection
	};
}

describe('TableSelectionToolbar', () => {
	it('renders nothing without a selection', async () => {
		const screen = await render(TableSelectionToolbarFixture, {
			props: { selection: createSelectionState(new Set()), hasStartContent: true }
		});

		expect(screen.getByRole('toolbar', { name: 'Bulk actions', exact: true }).query()).toBeNull();
	});

	it('renders product actions with synchronized selection status', async () => {
		const screen = await render(TableSelectionToolbarFixture, {
			props: {
				selection: createSelectionState(new Set(['1', '2'])),
				hasStartContent: true
			}
		});

		const toolbar = screen.getByRole('toolbar', { name: 'Bulk actions', exact: true });
		await expect.element(toolbar).toHaveAttribute('data-size', 'sm');
		expect(toolbar.element().closest('.astryx-section')).toHaveAttribute('data-variant', 'muted');
		await expect
			.element(screen.getByRole('button', { name: 'Export', exact: true }))
			.toBeInTheDocument();
		await expect.element(screen.getByText('2 selected', { exact: true })).toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Unselect All', exact: true }))
			.toBeInTheDocument();
	});

	it('allows a custom selection label to render nothing', async () => {
		const screen = await render(TableSelectionToolbarFixture, {
			props: {
				selection: createSelectionState(new Set(['1'])),
				hideSelectionLabel: true
			}
		});

		expect(screen.getByText('1 selected', { exact: true }).query()).toBeNull();
		await expect
			.element(screen.getByRole('button', { name: 'Unselect All', exact: true }))
			.toBeInTheDocument();
	});

	it('clears the complete selection through the shared state output', async () => {
		const clearSelection = vi.fn();
		const screen = await render(TableSelectionToolbarFixture, {
			props: {
				selection: createSelectionState(new Set(['1']), clearSelection)
			}
		});

		await userEvent.click(screen.getByRole('button', { name: 'Unselect All', exact: true }));
		expect(clearSelection).toHaveBeenCalledOnce();
	});

	it('supports product-specific toolbar, count, and clear labels', async () => {
		const screen = await render(TableSelectionToolbarFixture, {
			props: {
				selection: createSelectionState(new Set(['1', '2', '3'])),
				label: 'Invoice actions',
				isInvoiceLabel: true,
				clearLabel: 'Clear invoices'
			}
		});

		await expect
			.element(screen.getByRole('toolbar', { name: 'Invoice actions', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByText('3 invoices selected', { exact: true }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('button', { name: 'Clear invoices', exact: true }))
			.toBeInTheDocument();
	});
});
