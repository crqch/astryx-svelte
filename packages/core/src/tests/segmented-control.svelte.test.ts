/** PORTS: SegmentedControl/SegmentedControl.test.tsx */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import SegmentedControlProbe from './fixtures/segmented-control-probe.svelte';
import { cssIn, forcedColorsCssIn } from './forced-colors.js';

/**
 * Astryx's `SegmentedControl/SegmentedControl.test.tsx`, ported case for case.
 *
 * The file recount is the contract: upstream has **63** declared cases at the
 * **0.7.13** pin, across eleven describe blocks — 14 top-level
 * `SegmentedControl`, 4 `Tab stop` (spec:AST-085 FR1), 9 `keyboard navigation`
 * (a nested "#3597 pure focus move" block of 3 plus 6), 14 `disabled state`
 * (6 direct, a nested `disabledMessage` of 7 plus a 3-row `it.each`), 3
 * `data-testid forwarding`, 2 `onClick composition`, 2 `container handler
 * forwarding`, 1 `forced colors`, 2 `pressed state`, 6 `selection motion`, and
 * 2 caller `aria-describedby`. All 63 are ported here; this file also keeps
 * earlier-pin coverage, so it declares more than upstream.
 *
 * Because `<SegmentedControl>` takes its `SegmentedControlItem` children as a snippet,
 * every case renders through `segmented-control-probe.svelte`, which describes the
 * items as an array and forwards every group prop; see that file. Selection is
 * controlled exactly as upstream's: `value` is a plain prop and the test's `onChange`
 * is a spy that does not commit, so a click fires `onChange` while `value` stays put.
 *
 * Upstream's `beforeEach` (`:20-43`) shims `showPopover`/`hidePopover` and
 * `matches(':popover-open')` because jsdom implements none of the Popover API, and
 * reflects the open state as an invented `popover-open` *attribute* its assertions
 * read. The browser project needs none of it: Chromium has the real Popover API, so
 * open state is read with the real `matches(':popover-open')` — the same drop the
 * Tooltip / RadioList ports recorded.
 *
 * Restated deliveries (each noted at its case), assertions unchanged:
 * - layout cases: Chromium resolves `width: fit-content` to a used px value and
 *   `min-width: auto` to `auto`, where jsdom reports the specified keyword. The
 *   same declarations are asserted through `cssIn`, the port's scoped
 *   `getAllInjectedCss`; used values that a browser can resolve (overflow,
 *   text-overflow, flex-shrink, display) stay computed-style assertions.
 * - `does not call onChange when group is disabled` / `disables individual items` /
 *   `blocks selection while focusable-disabled` — the segment is aria-disabled (and,
 *   for the whole-group case, the container carries `pointer-events: none`). Playwright's
 *   actionability refuses to `userEvent.click` such an element, which would assert the
 *   heuristic rather than the component. The click is delivered as a native `.click()`
 *   — upstream's `fireEvent.click`, a plain trusted-free DOM dispatch that still runs
 *   `handleClick` and hits the component's guard.
 * - the two `#3597` tab-through cases — a synthetic Tab into a roving-tabindex group does
 *   not reliably settle onto a radio in Playwright, so focus is moved from the outside
 *   button onto the group's tab stop, giving `focusin` the outside `relatedTarget` the
 *   pure-focus-move branch reads. onChange must stay silent — the property upstream asserts.
 * - `shows the reason tooltip on keyboard focus` — as the RadioList port: a Tab enters
 *   keyboard modality, then focus is placed on the still-focusable selected segment so
 *   the container's `focusin` gate treats it as keyboard-originated.
 * - `touch presentation: a value change starts the slide, StrictMode included` —
 *   Svelte has no StrictMode double-mount; the case keeps the property it is named
 *   for (the controller survives the value change and starts the slide) and stubs
 *   the track's `offsetWidth` beside its rect stubs, as upstream's setup does.
 */

const noop = (): void => {};

afterEach(() => {
	vi.restoreAllMocks();
});

/** The control's Tab stops: every radio whose tabIndex is 0, in DOM order. */
function tabStops(container: HTMLElement): string[] {
	return [...container.querySelectorAll<HTMLElement>('[role="radio"]')]
		.filter((radio) => radio.tabIndex === 0)
		.map((radio) => radio.textContent?.trim() ?? '');
}

/** The stylesheet's declarations for this element, whitespace-normalized. */
function declaredCss(element: Element): string {
	return cssIn(element).replace(/\s+/g, ' ');
}

/** A flat pointer is the primary pointer: the theme's transitions, no lens. */
function mockCoarsePointer(): ReturnType<typeof vi.spyOn> {
	return vi.spyOn(window, 'matchMedia').mockImplementation(
		(query: string) =>
			({
				matches: query === '(pointer: coarse)',
				media: query,
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => false
			}) as MediaQueryList
	);
}

/** Whether the element's own rules paint the system pressed overlay on :active. */
function hasPressedArm(element: Element): boolean {
	return declaredCss(element)
		.split('\n')
		.some((rule) => rule.includes(':active') && rule.includes('--color-overlay-pressed'));
}

/** The tooltip layer, present (but `display:none`) whenever a reason renders. */
function tooltipIn(container: HTMLElement): HTMLElement | null {
	const el = container.querySelector('[role="tooltip"]');
	return el instanceof HTMLElement ? el : null;
}

describe('SegmentedControl', () => {
	it('renders a radiogroup with radio buttons', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});

		await expect.element(screen.getByRole('radiogroup')).toBeInTheDocument();
		await expect.element(screen.getByRole('radiogroup')).toHaveAttribute('aria-label', 'View mode');
		await expect
			.element(screen.getByRole('radio', { name: 'Grid', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('radio', { name: 'List', exact: true }))
			.toBeInTheDocument();
	});

	it('marks selected item with aria-checked', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});

		await expect
			.element(screen.getByRole('radio', { name: 'Grid', exact: true }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(screen.getByRole('radio', { name: 'List', exact: true }))
			.toHaveAttribute('aria-checked', 'false');
	});

	it('calls onChange when an item is clicked', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});

		await userEvent.click(screen.getByRole('radio', { name: 'List', exact: true }));
		expect(handleChange).toHaveBeenCalledWith('list');
	});

	it('does not call onChange when clicking the already-selected item', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});

		await userEvent.click(screen.getByRole('radio', { name: 'Grid', exact: true }));
		expect(handleChange).not.toHaveBeenCalled();
	});

	it('updates aria-checked when value changes', async () => {
		const items = [
			{ value: 'grid', label: 'Grid' },
			{ value: 'list', label: 'List' }
		];
		const screen = await render(SegmentedControlProbe, {
			props: { label: 'View mode', value: 'grid', onChange: noop, items }
		});

		await expect
			.element(screen.getByRole('radio', { name: 'Grid', exact: true }))
			.toHaveAttribute('aria-checked', 'true');

		// Upstream's `rerender` with a new controlled `value`.
		await screen.rerender({ label: 'View mode', value: 'list', onChange: noop, items });

		await expect
			.element(screen.getByRole('radio', { name: 'Grid', exact: true }))
			.toHaveAttribute('aria-checked', 'false');
		await expect
			.element(screen.getByRole('radio', { name: 'List', exact: true }))
			.toHaveAttribute('aria-checked', 'true');
	});

	it('renders with different sizes', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				size: 'sm',
				items: [{ value: 'grid', label: 'Grid' }]
			}
		});
		await expect
			.element(screen.getByRole('radio', { name: 'Grid', exact: true }))
			.toBeInTheDocument();

		await screen.rerender({
			label: 'View mode',
			value: 'grid',
			onChange: noop,
			size: 'lg',
			items: [{ value: 'grid', label: 'Grid' }]
		});
		await expect
			.element(screen.getByRole('radio', { name: 'Grid', exact: true }))
			.toBeInTheDocument();
	});

	it('renders item with icon', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [{ value: 'grid', label: 'Grid', icon: true }]
			}
		});

		await expect.element(screen.getByTestId('icon')).toBeInTheDocument();
	});

	it('renders icon-only item with aria-label from label prop', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [{ value: 'grid', label: 'Grid view', isLabelHidden: true, icon: true }]
			}
		});

		const radio = screen.getByRole('radio', { name: 'Grid view', exact: true });
		await expect.element(radio).toBeInTheDocument();
		await expect.element(radio).toHaveAttribute('aria-label', 'Grid view');
		// Label text should not be visible.
		expect(screen.container.textContent).not.toContain('Grid view');
	});

	it('keeps hug layout content-sized inside a stretching flex parent', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});
		const group = screen.getByRole('radiogroup').element();
		// A browser resolves `width: fit-content` to a used px value; the
		// declaration is the port's contract, as jsdom's computed style is
		// upstream's.
		expect(declaredCss(group)).toContain('width: fit-content');
		expect(getComputedStyle(group).display).toBe('inline-flex');
	});

	it('fill layout overrides the intrinsic control width', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				layout: 'fill',
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});
		expect(declaredCss(screen.getByRole('radiogroup').element())).toContain('width: 100%');
	});

	it('fill items can shrink and truncate long labels', async () => {
		const long = 'A very long segment label that should truncate';
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				layout: 'fill',
				items: [
					{ value: 'grid', label: long },
					{ value: 'list', label: 'List' },
					{ value: 'table', label: 'Table' }
				]
			}
		});
		const button = screen.getByRole('radio', { name: /very long/ }).element();
		const label = screen.getByText(long, { exact: true }).element();
		expect(declaredCss(button)).toContain('min-width: 0');
		const labelStyle = getComputedStyle(label);
		expect(labelStyle.overflow).toBe('hidden');
		expect(labelStyle.textOverflow).toBe('ellipsis');
	});

	it('caps the hug layout at its container and lets segments truncate', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'A very long segment label that should truncate' },
					{ value: 'list', label: 'List' },
					{ value: 'icon', label: 'Icon', isLabelHidden: true, icon: true }
				]
			}
		});
		const group = screen.getByRole('radiogroup').element();
		const css = declaredCss(group);
		expect(css).toContain('width: fit-content');
		expect(css).toContain('max-width: 100%');
		expect(css).toContain('min-width: 0');
		const segment = screen.getByRole('radio', { name: /very long/ }).element();
		expect(declaredCss(segment)).toContain('min-width: 0');
		expect(getComputedStyle(segment).flexShrink).not.toBe('0');
		// Icon-only segments have nothing to truncate and keep their size.
		const iconOnly = screen.getByRole('radio', { name: 'Icon', exact: true }).element();
		expect(getComputedStyle(iconOnly).flexShrink).toBe('0');
	});

	it('keeps the content-sized hug layout from #6643 while adding the cap', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});
		const group = screen.getByRole('radiogroup').element();
		const css = declaredCss(group);
		expect(css).toContain('width: fit-content');
		expect(css).toContain('max-width: 100%');
		expect(getComputedStyle(group).display).toBe('inline-flex');
	});

	it('lets a fill control yield to a narrow row too', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				layout: 'fill',
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});
		const css = declaredCss(screen.getByRole('radiogroup').element());
		expect(css).toContain('width: 100%');
		expect(css).toContain('min-width: 0');
		expect(css).toContain('max-width: 100%');
	});

	it('truncates the label of an icon-and-label segment but keeps its icon', async () => {
		const label = 'Grid with thumbnails and captions';
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [
					{ value: 'grid', label, icon: true },
					{ value: 'list', label: 'List' }
				]
			}
		});
		const segment = screen.getByRole('radio', { name: /Grid with/ }).element();
		expect(declaredCss(segment)).toContain('min-width: 0');
		expect(getComputedStyle(segment).flexShrink).not.toBe('0');
		const iconWrapper = screen.getByTestId('icon').element().parentElement!;
		expect(getComputedStyle(iconWrapper).flexShrink).toBe('0');
		expect(getComputedStyle(screen.getByText(label, { exact: true }).element()).textOverflow).toBe(
			'ellipsis'
		);
	});

	it('does not cap a control whose segments are all icon-only', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'list',
				onChange: noop,
				items: [
					{ value: 'list', label: 'List', isLabelHidden: true, icon: true },
					{ value: 'board', label: 'Board', isLabelHidden: true, icon: true }
				]
			}
		});
		const css = declaredCss(screen.getByRole('radiogroup').element());
		expect(css).toContain('width: fit-content');
		expect(css).toContain('max-width: none');
		expect(css).toContain('min-width: auto');
		for (const radio of screen.container.querySelectorAll<HTMLElement>('[role="radio"]')) {
			expect(getComputedStyle(radio).flexShrink).toBe('0');
		}
	});

	it('uses roving tabindex — selected item has tabIndex 0, others -1', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'list',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' },
					{ value: 'table', label: 'Table' }
				]
			}
		});

		await expect
			.element(screen.getByRole('radio', { name: 'Grid', exact: true }))
			.toHaveAttribute('tabindex', '-1');
		await expect
			.element(screen.getByRole('radio', { name: 'List', exact: true }))
			.toHaveAttribute('tabindex', '0');
		await expect
			.element(screen.getByRole('radio', { name: 'Table', exact: true }))
			.toHaveAttribute('tabindex', '-1');
	});

	it('keeps a tab stop when the value matches no item (tab-stop repair)', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'nonexistent',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' },
					{ value: 'table', label: 'Table' }
				]
			}
		});

		// No item is selected, but the group must remain Tab-reachable: the first
		// enabled radio is promoted to tabIndex=0 (by `useListFocus`'s repair).
		await expect
			.element(screen.getByRole('radio', { name: 'Grid', exact: true }))
			.toHaveAttribute('tabindex', '0');
	});

	it('promotes the first enabled item when the value matches no item and the first is disabled', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'nonexistent',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid', isDisabled: true },
					{ value: 'list', label: 'List' },
					{ value: 'table', label: 'Table' }
				]
			}
		});

		// The disabled first item is skipped; the first ENABLED radio is tabbable.
		await expect
			.element(screen.getByRole('radio', { name: 'List', exact: true }))
			.toHaveAttribute('tabindex', '0');
	});
});

describe('SegmentedControl Tab stop (spec:AST-085 FR1)', () => {
	it('keeps one Tab stop on the selected segment of a control disabled without a reason', async () => {
		const onChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View',
				value: 'list',
				onChange,
				isDisabled: true,
				before: true,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});
		expect(tabStops(screen.container)).toEqual(['List']);
		(screen.getByRole('button', { name: 'before' }).element() as HTMLElement).focus();
		await userEvent.tab();
		const list = screen.getByRole('radio', { name: 'List', exact: true }).element();
		expect(list).toHaveFocus();
		expect(list).toHaveAttribute('aria-disabled', 'true');
		await userEvent.keyboard('{ArrowLeft}');
		(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).click();
		expect(onChange).not.toHaveBeenCalled();
	});

	it('keeps the Tab stop on a selected segment that is disabled in an enabled control', async () => {
		const onChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View',
				value: 'list',
				onChange,
				before: true,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List', isDisabled: true },
					{ value: 'table', label: 'Table' }
				]
			}
		});
		expect(tabStops(screen.container)).toEqual(['List']);
		(screen.getByRole('button', { name: 'before' }).element() as HTMLElement).focus();
		await userEvent.tab();
		expect(screen.getByRole('radio', { name: 'List', exact: true }).element()).toHaveFocus();
		expect(onChange).not.toHaveBeenCalled();
		// Arrows move from it to the enabled segment beside it and select it.
		await userEvent.keyboard('{ArrowRight}');
		expect(onChange).toHaveBeenCalledWith('table');
		expect(screen.getByRole('radio', { name: 'Table', exact: true }).element()).toHaveFocus();
		expect(tabStops(screen.container)).toHaveLength(1);
	});

	it('moves left from a disabled selected segment to the enabled segment beside it', async () => {
		const onChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View',
				value: 'list',
				onChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List', isDisabled: true },
					{ value: 'table', label: 'Table' }
				]
			}
		});
		(screen.getByRole('radio', { name: 'List', exact: true }).element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowLeft}');
		expect(onChange).toHaveBeenCalledWith('grid');
		expect(screen.getByRole('radio', { name: 'Grid', exact: true }).element()).toHaveFocus();
	});

	it('moves a fallen-back Tab stop to the segment selected later', async () => {
		const items = [
			{ value: 'grid', label: 'Grid' },
			{ value: 'list', label: 'List' },
			{ value: 'table', label: 'Table' }
		];
		const screen = await render(SegmentedControlProbe, {
			props: { label: 'View', value: 'archived', onChange: noop, items }
		});
		expect(tabStops(screen.container)).toEqual(['Grid']);
		await screen.rerender({ label: 'View', value: 'table', onChange: noop, items });
		expect(tabStops(screen.container)).toEqual(['Table']);
	});
});

describe('SegmentedControl keyboard navigation', () => {
	describe('tab-through is a pure focus move (#3597)', () => {
		it('does not fire onChange when tabbing in with an unmatched value', async () => {
			const onChange = vi.fn();
			const screen = await render(SegmentedControlProbe, {
				props: {
					label: 'View',
					value: 'archived',
					onChange,
					before: true,
					items: [
						{ value: 'grid', label: 'Grid' },
						{ value: 'list', label: 'List' }
					]
				}
			});
			const before = screen.getByText('before', { exact: true }).element() as HTMLElement;
			// Restated delivery (see file header): the tab stop is the promoted first
			// enabled radio; moving focus onto it from the outside button gives `focusin`
			// the outside `relatedTarget` a Tab entry would, exercising the pure-focus-move
			// branch. onChange must stay silent.
			before.focus();
			(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).focus();
			expect(onChange).not.toHaveBeenCalled();
		});

		it('does not fire onChange when tabbing in while the selected item is disabled', async () => {
			const onChange = vi.fn();
			const screen = await render(SegmentedControlProbe, {
				props: {
					label: 'View',
					value: 'list',
					onChange,
					before: true,
					items: [
						{ value: 'grid', label: 'Grid' },
						{ value: 'list', label: 'List', isDisabled: true }
					]
				}
			});
			const before = screen.getByText('before', { exact: true }).element() as HTMLElement;
			// The selected 'list' is disabled, so the tab stop is the first enabled radio
			// (Grid); entering it from outside stays a pure focus move.
			before.focus();
			(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).focus();
			expect(onChange).not.toHaveBeenCalled();
		});

		it('still selects on arrow-key navigation within the group', async () => {
			const onChange = vi.fn();
			const screen = await render(SegmentedControlProbe, {
				props: {
					label: 'View',
					value: 'grid',
					onChange,
					items: [
						{ value: 'grid', label: 'Grid' },
						{ value: 'list', label: 'List' }
					]
				}
			});
			(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).focus();
			await userEvent.keyboard('{ArrowRight}');
			expect(onChange).toHaveBeenCalledWith('list');
		});
	});

	it('navigates with ArrowRight and selects', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' },
					{ value: 'table', label: 'Table' }
				]
			}
		});

		(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');

		expect(handleChange).toHaveBeenCalledWith('list');
		await expect.element(screen.getByRole('radio', { name: 'List', exact: true })).toHaveFocus();
	});

	it('navigates with ArrowLeft and selects', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'list',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' },
					{ value: 'table', label: 'Table' }
				]
			}
		});

		(screen.getByRole('radio', { name: 'List', exact: true }).element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowLeft}');

		expect(handleChange).toHaveBeenCalledWith('grid');
		await expect.element(screen.getByRole('radio', { name: 'Grid', exact: true })).toHaveFocus();
	});

	it('wraps around from last to first with ArrowRight', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'table',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' },
					{ value: 'table', label: 'Table' }
				]
			}
		});

		(screen.getByRole('radio', { name: 'Table', exact: true }).element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');

		expect(handleChange).toHaveBeenCalledWith('grid');
		await expect.element(screen.getByRole('radio', { name: 'Grid', exact: true })).toHaveFocus();
	});

	it('wraps around from first to last with ArrowLeft', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' },
					{ value: 'table', label: 'Table' }
				]
			}
		});

		(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowLeft}');

		expect(handleChange).toHaveBeenCalledWith('table');
		await expect.element(screen.getByRole('radio', { name: 'Table', exact: true })).toHaveFocus();
	});

	it('Home key focuses first item', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'table',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' },
					{ value: 'table', label: 'Table' }
				]
			}
		});

		(screen.getByRole('radio', { name: 'Table', exact: true }).element() as HTMLElement).focus();
		await userEvent.keyboard('{Home}');

		expect(handleChange).toHaveBeenCalledWith('grid');
		await expect.element(screen.getByRole('radio', { name: 'Grid', exact: true })).toHaveFocus();
	});

	it('End key focuses last item', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' },
					{ value: 'table', label: 'Table' }
				]
			}
		});

		(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).focus();
		await userEvent.keyboard('{End}');

		expect(handleChange).toHaveBeenCalledWith('table');
		await expect.element(screen.getByRole('radio', { name: 'Table', exact: true })).toHaveFocus();
	});
});

describe('SegmentedControl disabled state', () => {
	it('marks entire group as disabled', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				isDisabled: true,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});

		await expect.element(screen.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true');
	});

	it('does not call onChange when group is disabled', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: handleChange,
				isDisabled: true,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});

		// Restated delivery (see file header): the disabled group carries
		// `pointer-events: none`, so a native `.click()` stands in for
		// `userEvent.click` — the component's guard blocks selection all the same.
		(screen.getByRole('radio', { name: 'List', exact: true }).element() as HTMLElement).click();
		expect(handleChange).not.toHaveBeenCalled();
	});

	it('disables individual items', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List', isDisabled: true }
				]
			}
		});

		await expect
			.element(screen.getByRole('radio', { name: 'List', exact: true }))
			.toHaveAttribute('aria-disabled', 'true');

		// Restated delivery (see file header): the aria-disabled segment is not
		// actionable to Playwright; a native `.click()` reaches the blocked guard.
		(screen.getByRole('radio', { name: 'List', exact: true }).element() as HTMLElement).click();
		expect(handleChange).not.toHaveBeenCalled();
	});

	it("does not run a caller's onClick on a disabled segment", async () => {
		const handleClick = vi.fn();
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List', isDisabled: true, onclick: handleClick }
				]
			}
		});
		(screen.getByRole('radio', { name: 'List', exact: true }).element() as HTMLElement).click();
		expect(handleClick).not.toHaveBeenCalled();
		expect(handleChange).not.toHaveBeenCalled();
	});

	it("does not run a caller's onClick when the whole group is disabled", async () => {
		const handleClick = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				isDisabled: true,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List', onclick: handleClick }
				]
			}
		});
		(screen.getByRole('radio', { name: 'List', exact: true }).element() as HTMLElement).click();
		expect(handleClick).not.toHaveBeenCalled();
	});

	it("does not run a caller's onClick on a focusable disabled segment", async () => {
		// A group disabled with a reason keeps its selected segment in the tab
		// order, so Enter and Space can reach it and synthesize a click.
		const handleClick = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				isDisabled: true,
				disabledMessage: 'Choose a project to switch views',
				items: [
					{ value: 'grid', label: 'Grid', onclick: handleClick },
					{ value: 'list', label: 'List' }
				]
			}
		});
		const selected = screen.getByRole('radio', { name: 'Grid', exact: true }).element();
		selected.focus();
		expect(selected).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		await userEvent.keyboard(' ');
		expect(handleClick).not.toHaveBeenCalled();
	});

	it("still runs a caller's onClick on an enabled segment", async () => {
		const handleClick = vi.fn();
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List', onclick: handleClick }
				]
			}
		});
		(screen.getByRole('radio', { name: 'List', exact: true }).element() as HTMLElement).click();
		expect(handleClick).toHaveBeenCalledTimes(1);
		expect(handleChange).toHaveBeenCalledWith('list');
	});

	it('skips disabled items during keyboard navigation', async () => {
		const handleChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: handleChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List', isDisabled: true },
					{ value: 'table', label: 'Table' }
				]
			}
		});

		(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');

		// Should skip disabled "List" and go to "Table".
		expect(handleChange).toHaveBeenCalledWith('table');
		await expect.element(screen.getByRole('radio', { name: 'Table', exact: true })).toHaveFocus();
	});

	describe('disabledMessage', () => {
		async function renderControl(onChange: (v: string) => void = noop) {
			return render(SegmentedControlProbe, {
				props: {
					label: 'View mode',
					value: 'grid',
					onChange,
					isDisabled: true,
					disabledMessage: 'Choose a project to switch views',
					items: [
						{ value: 'grid', label: 'Grid' },
						{ value: 'list', label: 'List' }
					]
				}
			});
		}

		it('shows the reason tooltip on hover when the control is disabled with a reason', async () => {
			const screen = await renderControl();
			const tooltip = tooltipIn(screen.container)!;
			expect(tooltip).toHaveTextContent('Choose a project to switch views');
			const group = screen.getByRole('radiogroup').element();
			// `mouseenter`/`mouseleave` do not bubble; the listener sits on the group.
			group.dispatchEvent(new MouseEvent('mouseenter'));
			await vi.waitFor(() => {
				// `:popover-open` rather than upstream's invented `popover-open` attribute.
				expect(tooltip.matches(':popover-open')).toBe(true);
			});
			group.dispatchEvent(new MouseEvent('mouseleave'));
			await vi.waitFor(() => {
				expect(tooltip.matches(':popover-open')).toBe(false);
			});
		});

		it('shows the reason tooltip on keyboard focus', async () => {
			const screen = await renderControl();
			const tooltip = tooltipIn(screen.container)!;
			// Restated delivery (see file header): a Tab enters keyboard modality, then
			// focus is placed on the still-focusable selected segment.
			await userEvent.tab();
			(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).focus();
			await vi.waitFor(() => {
				expect(tooltip.matches(':popover-open')).toBe(true);
			});
		});

		it('does not render a tooltip when not disabled', async () => {
			const screen = await render(SegmentedControlProbe, {
				props: {
					label: 'View mode',
					value: 'grid',
					onChange: noop,
					disabledMessage: 'Choose a project to switch views',
					items: [{ value: 'grid', label: 'Grid' }]
				}
			});
			expect(tooltipIn(screen.container)).toBeNull();
		});

		it('does not render a tooltip when disabled without a reason', async () => {
			const screen = await render(SegmentedControlProbe, {
				props: {
					label: 'View mode',
					value: 'grid',
					onChange: noop,
					isDisabled: true,
					items: [{ value: 'grid', label: 'Grid' }]
				}
			});
			expect(tooltipIn(screen.container)).toBeNull();
		});

		it('keeps the selected segment focusable when a reason is provided', async () => {
			const screen = await renderControl();
			const selected = screen.getByRole('radio', { name: 'Grid', exact: true });
			await expect.element(selected).toHaveAttribute('aria-disabled', 'true');
			await expect.element(selected).toHaveAttribute('tabindex', '0');
		});

		it('links the reason tooltip from the group via aria-describedby', async () => {
			const screen = await renderControl();
			const group = screen.getByRole('radiogroup').element();
			const tooltip = tooltipIn(screen.container)!;
			expect(group.getAttribute('aria-describedby')).toContain(tooltip.id);
		});

		it('blocks selection while focusable-disabled', async () => {
			const onChange = vi.fn();
			const screen = await renderControl(onChange);
			// Restated delivery (see file header): the segment is focusable-disabled
			// (aria-disabled, not native); a native `.click()` is upstream's
			// `fireEvent.click`, running the component's blocked guard.
			(screen.getByRole('radio', { name: 'List', exact: true }).element() as HTMLElement).click();
			expect(onChange).not.toHaveBeenCalled();
		});

		it('describes the focused segment with the reason', async () => {
			const screen = await renderControl();
			await userEvent.tab();
			const grid = screen.getByRole('radio', { name: 'Grid', exact: true });
			await expect.element(grid).toHaveFocus();
			await expect.element(grid).toHaveAccessibleDescription('Choose a project to switch views');
			await expect
				.element(screen.getByRole('radio', { name: 'List', exact: true }))
				.toHaveAccessibleDescription('Choose a project to switch views');
		});

		it('keeps a caller description ahead of the reason', async () => {
			const screen = await render(SegmentedControlProbe, {
				props: {
					label: 'View mode',
					value: 'grid',
					onChange: noop,
					isDisabled: true,
					disabledMessage: 'Choose a project to switch views',
					items: [{ value: 'grid', label: 'Grid', describedBy: 'grid-hint' }]
				}
			});
			const hint = document.createElement('span');
			hint.id = 'grid-hint';
			hint.textContent = 'Shows thumbnails';
			screen.container.append(hint);
			await expect
				.element(screen.getByRole('radio', { name: 'Grid', exact: true }))
				.toHaveAccessibleDescription('Shows thumbnails Choose a project to switch views');
		});

		it('adds no reason to the segments of a control that is not disabled', async () => {
			const screen = await render(SegmentedControlProbe, {
				props: {
					label: 'View mode',
					value: 'grid',
					onChange: noop,
					disabledMessage: 'Choose a project to switch views',
					items: [{ value: 'grid', label: 'Grid' }]
				}
			});
			expect(
				screen
					.getByRole('radio', { name: 'Grid', exact: true })
					.element()
					.hasAttribute('aria-describedby')
			).toBe(false);
		});

		it.each([
			['the value matches no segment', 'none', undefined, 'Grid'],
			['the selected segment is itself disabled', 'grid', 'grid', 'Grid'],
			['the value matches no segment and the first is itself disabled', 'none', 'grid', 'List']
		] as const)(
			'keeps one Tab stop when %s',
			async (_case, value, disabledSegment, expectedStop) => {
				const screen = await render(SegmentedControlProbe, {
					props: {
						label: 'View mode',
						value,
						onChange: noop,
						isDisabled: true,
						disabledMessage: 'Choose a project to switch views',
						before: true,
						after: true,
						items: [
							{ value: 'grid', label: 'Grid', isDisabled: disabledSegment === 'grid' },
							{ value: 'list', label: 'List' }
						]
					}
				});
				expect(tabStops(screen.container)).toEqual([expectedStop]);
				await userEvent.tab();
				expect(screen.getByRole('button', { name: 'before' }).element()).toHaveFocus();
				await userEvent.tab();
				const stop = screen.getByRole('radio', { name: expectedStop, exact: true });
				await expect.element(stop).toHaveFocus();
				await expect.element(stop).toHaveAccessibleDescription('Choose a project to switch views');
				await userEvent.tab();
				expect(screen.getByRole('button', { name: 'after' }).element()).toHaveFocus();
			}
		);

		it('opens the reason on a tap and selects nothing', async () => {
			const onChange = vi.fn();
			const screen = await renderControl(onChange);
			const tooltip = tooltipIn(screen.container)!;
			const list = screen
				.getByRole('radio', { name: 'List', exact: true })
				.element() as HTMLElement;
			// A tap, in the order a browser dispatches it.
			list.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
			list.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
			list.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }));
			list.dispatchEvent(new MouseEvent('mouseenter'));
			list.click();
			await vi.waitFor(() => {
				expect(tooltip.matches(':popover-open')).toBe(true);
			});
			expect(onChange).not.toHaveBeenCalled();
		});
	});
});

describe('SegmentedControl data-testid forwarding', () => {
	it('forwards data-testid to the radiogroup', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				'data-testid': 'view-toggle',
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});

		expect(screen.getByTestId('view-toggle').element()).toBe(
			screen.getByRole('radiogroup').element()
		);
	});

	it('forwards data-testid to an individual item button', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid', 'data-testid': 'opt-grid' },
					{ value: 'list', label: 'List', 'data-testid': 'opt-list' }
				]
			}
		});

		expect(screen.getByTestId('opt-grid').element()).toBe(
			screen.getByRole('radio', { name: 'Grid', exact: true }).element()
		);
		expect(screen.getByTestId('opt-list').element()).toBe(
			screen.getByRole('radio', { name: 'List', exact: true }).element()
		);
	});

	it('does not let a forwarded prop override the computed role', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				// A consumer-supplied role must not clobber the component's own
				// radiogroup role (the computed role is applied after {...rest}).
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				role: 'tablist',
				'data-testid': 'view-toggle',
				items: [{ value: 'grid', label: 'Grid' }]
			}
		});

		await expect.element(screen.getByTestId('view-toggle')).toHaveAttribute('role', 'radiogroup');
	});
});

describe('SegmentedControlItem onClick composition', () => {
	it('calls a consumer onClick in addition to selecting the item', async () => {
		const onChange = vi.fn();
		const onClick = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange,
				items: [{ value: 'list', label: 'List', onclick: onClick }]
			}
		});

		// Upstream's `fireEvent.click`, a plain DOM dispatch.
		(screen.getByRole('radio', { name: 'List', exact: true }).element() as HTMLElement).click();

		expect(onClick).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith('list');
	});

	it('lets a consumer onClick opt out of selection via preventDefault', async () => {
		const onChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange,
				items: [{ value: 'list', label: 'List', onclick: (e: MouseEvent) => e.preventDefault() }]
			}
		});

		(screen.getByRole('radio', { name: 'List', exact: true }).element() as HTMLElement).click();

		expect(onChange).not.toHaveBeenCalled();
	});
});

describe('SegmentedControl container handler forwarding', () => {
	it('forwards a consumer onKeyDown while keeping arrow-key navigation', async () => {
		const onKeyDown = vi.fn();
		const onChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange,
				onkeydown: onKeyDown,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});

		(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');

		expect(onKeyDown).toHaveBeenCalled();
		// Built-in navigation still ran.
		expect(onChange).toHaveBeenCalledWith('list');
	});

	it('lets a consumer onKeyDown opt out of built-in navigation via preventDefault', async () => {
		const onChange = vi.fn();
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange,
				onkeydown: (e: KeyboardEvent) => e.preventDefault(),
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});

		(screen.getByRole('radio', { name: 'Grid', exact: true }).element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}');

		expect(onChange).not.toHaveBeenCalled();
	});
});

describe('pressed state', () => {
	it('paints the pressed overlay on a segment while it is pressed', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});
		// The unselected segment is the one a press can change; it carries the
		// system's hover and pressed overlay.
		expect(hasPressedArm(screen.getByRole('radio', { name: 'List', exact: true }).element())).toBe(
			true
		);
		// The selected segment keeps its raised surface as it is.
		expect(hasPressedArm(screen.getByRole('radio', { name: 'Grid', exact: true }).element())).toBe(
			false
		);
	});

	it('does not press a disabled segment', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List', isDisabled: true }
				]
			}
		});
		expect(hasPressedArm(screen.getByRole('radio', { name: 'List', exact: true }).element())).toBe(
			false
		);
	});
});

describe('selection motion', () => {
	function renderControl(onChange: (value: string) => void = vi.fn()) {
		return render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' },
					{ value: 'icon', label: 'Icon', isLabelHidden: true, icon: true }
				]
			}
		});
	}

	it('keeps the pointer presentation as it was: no lens, the theme’s transitions', async () => {
		const screen = await renderControl();
		const group = screen.getByRole('radiogroup').element();
		expect(group.style.getPropertyValue('--_segmented-lens-visibility')).toBe('');
		expect(
			getComputedStyle(screen.getByRole('radio', { name: 'List', exact: true }).element())
				.transitionProperty
		).toContain('background-color');
	});

	it('one touch model: a finger on any engine (no iOS check) gets the touch presentation, and a tap still selects', async () => {
		const spy = mockCoarsePointer();
		try {
			const onChange = vi.fn();
			const screen = await renderControl(onChange);
			// The lens is the radiogroup's own pseudo-elements, so the touch
			// presentation shows as its styles: no CSS transition on the segments.
			expect(
				getComputedStyle(screen.getByRole('radio', { name: 'List', exact: true }).element())
					.transitionProperty
			).toBe('none');
			await userEvent.click(screen.getByRole('radio', { name: 'List', exact: true }));
			expect(onChange).toHaveBeenCalledWith('list');
		} finally {
			spy.mockRestore();
		}
	});

	it('touch presentation: as many elements as under a mouse; selection unchanged', async () => {
		const mouse = await renderControl();
		const mouseCount = mouse.container.querySelectorAll('*').length;
		const spy = mockCoarsePointer();
		try {
			const onChange = vi.fn();
			const screen = await renderControl(onChange);
			expect(screen.container.querySelectorAll('*').length).toBe(mouseCount);
			const list = [...screen.container.querySelectorAll<HTMLElement>('[role="radio"]')].find(
				(radio) => radio.textContent?.trim() === 'List'
			)!;
			list.click();
			expect(onChange).toHaveBeenCalledWith('list');
		} finally {
			spy.mockRestore();
		}
	});

	it('touch presentation: the segments a press can change keep the shared press paint, and nothing dims (the record owner’s decision)', async () => {
		const spy = mockCoarsePointer();
		try {
			const screen = await renderControl();
			for (const name of ['List', 'Icon']) {
				const segment = screen.getByRole('radio', { name, exact: true }).element();
				expect(segment.hasAttribute('data-astryx-pressable')).toBe(true);
				expect(hasPressedArm(segment)).toBe(true);
			}
			// The selected segment never paints a press.
			expect(
				screen
					.getByRole('radio', { name: 'Grid', exact: true })
					.element()
					.hasAttribute('data-astryx-pressable')
			).toBe(false);
		} finally {
			spy.mockRestore();
		}
	});

	it('a mouse keeps the shared press paint on the segments a press can change', async () => {
		const screen = await renderControl();
		for (const name of ['List', 'Icon']) {
			expect(
				screen
					.getByRole('radio', { name, exact: true })
					.element()
					.hasAttribute('data-astryx-pressable')
			).toBe(true);
		}
		// The selected segment never paints a press.
		expect(
			screen
				.getByRole('radio', { name: 'Grid', exact: true })
				.element()
				.hasAttribute('data-astryx-pressable')
		).toBe(false);
	});

	it('touch presentation: a value change starts the slide, StrictMode included', async () => {
		const spy = mockCoarsePointer();
		const boxes: Record<string, [number, number]> = {
			grid: [2, 96],
			list: [102, 96]
		};
		const rects = vi
			.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
			.mockImplementation(function (this: HTMLElement) {
				const [left, width] =
					this.getAttribute('role') === 'radiogroup'
						? [0, 200]
						: (boxes[this.dataset.value ?? ''] ?? [0, 0]);
				return {
					left,
					top: 2,
					width,
					height: 28,
					right: left + width,
					bottom: 30,
					x: left,
					y: 2,
					toJSON: () => ({})
				} as DOMRect;
			});
		try {
			const items = [
				{ value: 'grid', label: 'Grid' },
				{ value: 'list', label: 'List' }
			];
			const screen = await render(SegmentedControlProbe, {
				props: { label: 'View', value: 'grid', onChange: noop, items }
			});
			const group = screen.getByRole('radiogroup').element();
			// The rects are stubbed; the track's real layout width must agree, or
			// the lens divides its boxes by an ancestor-scale guess.
			Object.defineProperty(group, 'offsetWidth', { configurable: true, value: 200 });
			await screen.rerender({ label: 'View', value: 'list', onChange: noop, items });
			// Svelte has no StrictMode remount; the slide starts on the same
			// controller across a value change. The lens takes the destination's
			// box, painted from the selected surface.
			expect(group.style.getPropertyValue('--_segmented-lens-visibility')).toBe('visible');
			expect(group.style.getPropertyValue('--_segmented-lens-width')).toBe('96px');
			// Laid out on the destination's box, where it lands centered.
			expect(group.style.getPropertyValue('--_segmented-lens-left')).toBe('102px');
		} finally {
			rects.mockRestore();
			spy.mockRestore();
		}
	});
});

describe("SegmentedControl keeps a caller's aria-describedby", () => {
	it('describes the radiogroup by the caller ids', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				'aria-describedby': 'caller-help',
				items: [{ value: 'grid', label: 'Grid' }]
			}
		});
		const help = document.createElement('span');
		help.id = 'caller-help';
		help.textContent = 'Applies to every board';
		screen.container.append(help);
		expect(
			screen.getByRole('radiogroup').element().getAttribute('aria-describedby')?.split(' ')
		).toContain('caller-help');
	});

	it('describes the disabled radiogroup by the caller ids and then the reason', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				isDisabled: true,
				disabledMessage: 'Choose a project to switch views',
				'aria-describedby': 'caller-help',
				items: [{ value: 'grid', label: 'Grid' }]
			}
		});
		const help = document.createElement('span');
		help.id = 'caller-help';
		help.textContent = 'Applies to every board';
		screen.container.append(help);
		const tooltip = tooltipIn(screen.container)!;
		expect(
			screen.getByRole('radiogroup').element().getAttribute('aria-describedby')?.split(' ')
		).toEqual(['caller-help', tooltip.id]);
	});
});

// Neither jsdom nor a Chromium test page can emulate forced-colors rendering, so
// this asserts that the compiled output includes the forced-colors rules; visual
// behavior needs manual verification under Windows High Contrast. See
// `forced-colors.ts` for why the scan is scoped to the rendered subtree here and
// global upstream.
describe('forced colors (WCAG 1.4.11)', () => {
	it('compiles forced-colors overrides so the selected segment survives Windows High Contrast', async () => {
		const screen = await render(SegmentedControlProbe, {
			props: {
				label: 'View mode',
				value: 'grid',
				onChange: noop,
				items: [
					{ value: 'grid', label: 'Grid' },
					{ value: 'list', label: 'List' }
				]
			}
		});
		const css = forcedColorsCssIn(screen.container);
		// The painted surface fill and shadow are stripped; Highlight/
		// HighlightText marks the selected segment.
		expect(css).toContain('background-color: highlight;');
		expect(css).toContain('color: highlighttext;');
		// The segment is a <button>; without opting out of UA remapping it keeps
		// the native ButtonFace surface and ignores the Highlight fill, leaving
		// HighlightText text on a white surface. forced-color-adjust: none makes
		// both render as authored.
		expect(cssIn(screen.container)).toContain('forced-color-adjust: none;');
	});
});
