/** PORTS: Table/TableHeaderCell.test.tsx */

// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file table-header-cell.test.ts
 * @input Uses vitest, the browser, StyleX and TableHeaderCell
 * @output Unit tests for TableHeaderCell
 * @position Testing; validates the `<th>` contract, the standalone (no
 *   TableContext) plain render, and the context-driven density/divider styling
 *
 * Astryx's `Table/TableHeaderCell.test.tsx`, ported case for case — all 17 of
 * upstream's 17 at the 0.7.13 pin. Runs in the **client (real Chromium)**
 * project, as the Table suite does.
 *
 * Upstream reads StyleX's runtime-injected rules; this port's rules are
 * compiled into `@layer` blocks, and the sheet is on a browser-test page twice
 * (Vite's injection plus `setup-stylex.ts`'s own copy). `allRules` therefore
 * descends into `@layer` and de-duplicates by rule text — not loosened, since
 * either half alone would change what `toContain` means.
 *
 * React-only surface translated:
 * - `ref` is an attachment in the rest props, the Table suite's precedent;
 * - standalone markup and the in-Table `xstyle` case go through
 *   `table-header-cell-fixture.svelte`; the custom styles live in
 *   `table-header-cell-xstyle.stylex.ts` because StyleX may only be imported
 *   from a `.ts` module.
 */

import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createAttachmentKey } from 'svelte/attachments';
import type { TableColumn } from '$lib/components/table/table-types.js';
import { renderTable } from './render-table.js';
import TableHeaderCellFixture from './fixtures/table-header-cell-fixture.svelte';
import { arrayStyles, trailing } from './fixtures/table-header-cell-xstyle.stylex.js';

// =============================================================================
// Test Data
// =============================================================================

interface User extends Record<string, unknown> {
	name: string;
	age: number;
}

const users: User[] = [{ name: 'Alice', age: 30 }];

const columns: TableColumn<User>[] = [
	{ key: 'name', header: 'Name' },
	{ key: 'age', header: 'Age' }
];

// =============================================================================
// Helpers
// =============================================================================

/** Every rule on the page, descending into `@layer` and de-duplicated. */
function allRules(): string[] {
	const out: string[] = [];
	const walk = (list: CSSRuleList): void => {
		for (const rule of Array.from(list)) {
			const nested = (rule as CSSGroupingRule).cssRules;
			if (nested && !(rule as CSSStyleRule).selectorText) {
				walk(nested);
			} else {
				out.push(rule.cssText);
			}
		}
	};
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			walk(sheet.cssRules);
		} catch {
			// A cross-origin sheet throws on `cssRules`; upstream swallows it too.
		}
	}
	return [...new Set(out)];
}

/**
 * Read back the CSS declarations that actually apply to an element's classes.
 *
 * Conditional rules keep their pseudo-class prefix, e.g.
 * `:last-child border-inline-end-width: 0`.
 */
function cssDeclarationsOf(el: Element): string[] {
	const classes = new Set(el.className.split(/\s+/).filter(Boolean));
	const declarations: string[] = [];

	for (const text of allRules()) {
		const brace = text.indexOf('{');
		if (brace === -1) {
			continue;
		}
		// Strip StyleX's `:not(#\#)` specificity padding from the selector.
		const selector = text.slice(0, brace).replaceAll(':not(#\\#)', '').trim();
		const match = /^\.([\w-]+)(.*)$/.exec(selector);
		if (!match || !classes.has(match[1])) {
			continue;
		}
		const body = text
			.slice(brace + 1, text.lastIndexOf('}'))
			.trim()
			.replace(/;$/, '');
		const condition = match[2].trim();
		declarations.push(condition ? `${condition} ${body}` : body);
	}

	return declarations;
}

/** Declarations applying to the first header cell of a rendered Table. */
function headerCellDeclarations(container: HTMLElement): string[] {
	const th = container.querySelector('thead th');
	expect(th).not.toBeNull();
	return cssDeclarationsOf(th as Element);
}

// =============================================================================
// Tests
// =============================================================================

describe('TableHeaderCell', () => {
	it('renders a th element around its children', async () => {
		const screen = await render(TableHeaderCellFixture, {
			props: { text: 'Name' }
		});
		const th = screen.container.querySelector('th');
		expect(th).not.toBeNull();
		expect(th).toHaveTextContent('Name');
		// Upstream's `getByRole('columnheader')` reads Testing Library's own
		// HTML-AAM mapping. Playwright maps a `<th>` without `scope` to `cell`,
		// so the structural claim HTML-AAM derives that role from — a `th` in
		// the header row — is asserted instead. The scoped path is the very
		// next case.
		expect(th?.tagName).toBe('TH');
		expect(th?.closest('thead')).not.toBeNull();
	});

	it('sets no scope attribute unless one is given', async () => {
		const screen = await render(TableHeaderCellFixture, {
			props: { text: 'Name' }
		});
		expect(screen.container.querySelector('th')).not.toHaveAttribute('scope');
	});

	it('reflects the scope prop on the th', async () => {
		const screen = await render(TableHeaderCellFixture, {
			props: { text: 'Name', rest: { scope: 'rowgroup' } }
		});
		expect(screen.container.querySelector('th')).toHaveAttribute('scope', 'rowgroup');
	});

	it('renders unstyled when used outside a Table', async () => {
		const screen = await render(TableHeaderCellFixture, {
			props: { text: 'Name' }
		});
		const th = screen.container.querySelector('th') as HTMLElement;
		// No table context — no density, divider or overflow styling at all.
		expect(cssDeclarationsOf(th)).toEqual([]);
		expect(th).toHaveClass('astryx-table-header-cell');
	});

	it('takes the balanced density padding from the table by default', async () => {
		const screen = await renderTable({ data: users, columns });
		const declarations = headerCellDeclarations(screen.container);
		expect(declarations).toContain('padding-block: var(--spacing-2)');
		expect(declarations).toContain('padding-inline: var(--spacing-3)');
	});

	it('takes the compact density padding from the table', async () => {
		const screen = await renderTable({ data: users, columns, density: 'compact' });
		const declarations = headerCellDeclarations(screen.container);
		expect(declarations).toContain('padding-block: var(--spacing-1)');
		expect(declarations).toContain('padding-inline: var(--spacing-2)');
	});

	it('takes the spacious density padding from the table', async () => {
		const screen = await renderTable({ data: users, columns, density: 'spacious' });
		const declarations = headerCellDeclarations(screen.container);
		expect(declarations).toContain('padding-block: var(--spacing-3)');
		expect(declarations).toContain('padding-inline: var(--spacing-4)');
	});

	it('applies the header font weight and color inside a table', async () => {
		const screen = await renderTable({ data: users, columns });
		const declarations = headerCellDeclarations(screen.container);
		expect(declarations).toContain('font-weight: var(--font-weight-semibold)');
		expect(declarations).toContain('color: var(--color-text-secondary)');
	});

	it('draws the bottom divider even when the table has dividers off', async () => {
		const screen = await renderTable({ data: users, columns, dividers: 'none' });
		const declarations = headerCellDeclarations(screen.container);
		// The header/body separator is unconditional inside a table.
		expect(declarations).toContain('border-bottom-width: var(--border-width)');
		expect(declarations).toContain('border-bottom-style: solid');
		expect(declarations).toContain('border-bottom-color: var(--color-border)');
		// …but the column divider is not.
		expect(declarations.filter((d) => d.includes('border-inline-end'))).toEqual([]);
	});

	it('draws no column divider when the table divides rows only', async () => {
		const screen = await renderTable({ data: users, columns, dividers: 'rows' });
		expect(
			headerCellDeclarations(screen.container).filter((d) => d.includes('border-inline-end'))
		).toEqual([]);
	});

	// StyleX packs the default and the `:last-child` override into one atomic
	// class, so this reads the rules the header cells carry rather than
	// comparing two cells — both carry byte-identical classes. The divider sits
	// on the logical inline-end edge so it mirrors under RTL.
	it('draws a column divider that the last header cell zeroes out', async () => {
		const screen = await renderTable({ data: users, columns, dividers: 'columns' });
		const declarations = headerCellDeclarations(screen.container);
		expect(declarations).toContain('border-inline-end-width: var(--border-width)');
		expect(declarations).toContain('border-inline-end-style: solid');
		expect(declarations).toContain('border-inline-end-color: var(--color-border)');
		// The compiled sheet writes `0px`; upstream's runtime injection writes
		// `0`. Same declaration, so the literal is the one that ships.
		expect(declarations).toContain(':last-child border-inline-end-width: 0px');
	});

	it('draws a column divider when the table divides on a grid', async () => {
		const screen = await renderTable({ data: users, columns, dividers: 'grid' });
		expect(headerCellDeclarations(screen.container)).toContain(
			'border-inline-end-width: var(--border-width)'
		);
	});

	it('lets consumer xstyle win over the context header styling', async () => {
		const screen = await render(TableHeaderCellFixture, {
			props: { inTable: true, text: 'Name', rest: { xstyle: trailing.trailing } }
		});
		const declarations = headerCellDeclarations(screen.container);
		// The context sets `text-align: start`; xstyle merges on top of it.
		expect(declarations).toContain('text-align: end');
		expect(declarations).not.toContain('text-align: start');
		// The rest of the context styling survives the override.
		expect(declarations).toContain('padding-inline: var(--spacing-3)');
	});

	it('accepts an array of xstyle values', async () => {
		const screen = await render(TableHeaderCellFixture, {
			props: {
				text: 'Name',
				rest: { xstyle: [arrayStyles.caps, arrayStyles.spaced] }
			}
		});
		const th = screen.container.querySelector('th') as HTMLElement;
		expect(cssDeclarationsOf(th).sort()).toEqual([
			'letter-spacing: 2px',
			'text-transform: uppercase'
		]);
	});

	it('forwards the ref to the th element', async () => {
		let node: Element | undefined;
		await render(TableHeaderCellFixture, {
			props: {
				text: 'Name',
				rest: {
					[createAttachmentKey()]: (element: Element) => {
						node = element;
					}
				}
			}
		});
		expect(node).toBeInstanceOf(HTMLTableCellElement);
	});

	it('spreads html attributes onto the th', async () => {
		const screen = await render(TableHeaderCellFixture, {
			props: {
				text: 'Name',
				rest: {
					id: 'name-header',
					'aria-sort': 'ascending',
					'data-column-key': 'name'
				}
			}
		});
		const th = screen.container.querySelector('th') as HTMLElement;
		expect(th.id).toBe('name-header');
		expect(th).toHaveAttribute('aria-sort', 'ascending');
		expect(th).toHaveAttribute('data-column-key', 'name');
	});

	it('keeps a consumer className and style alongside the astryx class', async () => {
		const screen = await render(TableHeaderCellFixture, {
			props: {
				text: 'Name',
				rest: { class: 'custom-header', style: 'width: 10px' }
			}
		});
		const th = screen.container.querySelector('th') as HTMLElement;
		expect(th).toHaveClass('astryx-table-header-cell');
		expect(th).toHaveClass('custom-header');
		expect(th.style.width).toBe('10px');
	});
});
