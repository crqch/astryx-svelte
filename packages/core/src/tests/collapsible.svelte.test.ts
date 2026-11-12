/** PORTS: Collapsible/Collapsible.test.tsx */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createAttachmentKey } from 'svelte/attachments';
import CollapsibleProbe from './fixtures/collapsible-probe.svelte';
import CollapsibleGroupProbe from './fixtures/collapsible-group-probe.svelte';
import { cssIn } from './forced-colors.js';

/**
 * Astryx's `Collapsible/Collapsible.test.tsx`, ported case for case at the
 * **0.7.13** pin, the version this port targets.
 *
 * One case is not here, named rather than silently dropped:
 * `exposes a displayName for devtools`. Svelte has no `displayName` surface, so
 * there is nothing to assert; the standing translation is recorded in the
 * header rather than in a skipped body.
 *
 * This file also keeps earlier-pin coverage of the uncontrolled open state
 * (`is open by default`, `honors defaultIsOpen`, toggling by click and by
 * keyboard, and content visibility). Those cases no longer appear in
 * upstream's suite — it now asserts the chevron rotation for the same area —
 * but they are real behaviour here and remain useful. The pin's current cases
 * are all present, and the one named above is the only upstream case absent.
 *
 * Because `Collapsible`'s `children` is a `Snippet` and cannot be authored in a
 * `.ts` test, every standalone case renders through `collapsible-probe.svelte`
 * (body described by `body`/`childTestId`/`bodyButton` props and an optional
 * `Elsewhere` sibling) and every group case through
 * `collapsible-group-probe.svelte` (items described by an array). See those files.
 *
 * `act()` has no counterpart — a `$state` write flushes on its own and
 * `expect.element` retries. `render` is async (`vitest-browser-svelte` v3), so it
 * is always awaited. `.element()` is cast to `HTMLElement` before DOM-only methods
 * (svelte-check requirement).
 *
 * Translations (each noted at its case, assertions unchanged where possible):
 * - `exposes a displayName for devtools` — DROPPED. Svelte has no `displayName`
 *   surface; `Context` keeps its name private. Named per the count contract.
 * - `forwards a ref to the root element` — COUNTERPART. There is no `ref` prop here;
 *   the way a consumer reaches the root is an attachment travelling through the rest
 *   props. It receives the element (asserted `instanceof HTMLDivElement`, matching
 *   upstream's `expect.any(HTMLDivElement)`), which is strictly more than proving a
 *   callback ran.
 * - `paints the pressed overlay on the trigger row while it is pressed` — the
 *   upstream `hasPressedArm` helper reads jsdom's injected sheets globally; this
 *   port uses `cssIn`, the scoped helper every pressed-state case here uses, so
 *   the rule has to be on the trigger's own compiled classes.
 */

/** The stylesheet's declarations for this element, whitespace-normalized. */
function declaredCss(element: Element): string {
	return cssIn(element).replace(/\s+/g, ' ');
}

/** Whether the element's own rules paint the system pressed overlay on :active. */
function hasPressedArm(element: Element): boolean {
	const css = declaredCss(element);
	return css.includes(':active') && css.includes('--color-overlay-pressed');
}

/**
 * Resolves the content region a trigger controls via aria-controls, so tests
 * assert the real disclosure linkage rather than guessing at DOM structure.
 */
function contentFor(trigger: HTMLElement): HTMLElement {
	const id = trigger.getAttribute('aria-controls');
	expect(id).toBeTruthy();
	const el = document.getElementById(id as string);
	expect(el).not.toBeNull();
	return el as HTMLElement;
}

describe('Collapsible', () => {
	describe('structure and rendering', () => {
		it('renders the trigger content inside a button', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'Details', body: 'Body' }
			});
			const button = screen.getByRole('button');
			await expect.element(button).toHaveTextContent('Details');
			expect((button.element() as HTMLElement).tagName).toBe('BUTTON');
		});

		it('renders the trigger button with an explicit type="button"', async () => {
			// Prevents implicit form submission when used inside a <form>.
			const screen = await render(CollapsibleProbe, { props: { trigger: 'T', body: 'c' } });
			await expect.element(screen.getByRole('button')).toHaveAttribute('type', 'button');
		});

		it('renders children inside the controlled content region', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'Section', childTestId: 'child', body: 'Hello' }
			});
			const button = screen.getByRole('button').element() as HTMLElement;
			const content = contentFor(button);
			expect(content.contains(screen.getByTestId('child').element())).toBe(true);
		});

		it('links the trigger to its content via aria-controls', async () => {
			const screen = await render(CollapsibleProbe, { props: { trigger: 'T', body: 'Body' } });
			const button = screen.getByRole('button').element() as HTMLElement;
			const content = contentFor(button);
			expect(button.getAttribute('aria-controls')).toBe(content.id);
		});

		it('renders the stable astryx-collapsible class on the root', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'c', 'data-testid': 'root' }
			});
			await expect.element(screen.getByTestId('root')).toHaveClass('astryx-collapsible');
		});

		it('renders the stable astryx-collapsible-trigger class on the trigger button', async () => {
			const screen = await render(CollapsibleProbe, { props: { trigger: 'T', body: 'c' } });
			await expect.element(screen.getByRole('button')).toHaveClass('astryx-collapsible-trigger');
		});

		it('renders the stable astryx-collapsible-content class on the content area', async () => {
			const screen = await render(CollapsibleProbe, { props: { trigger: 'T', body: 'c' } });
			const button = screen.getByRole('button').element() as HTMLElement;
			const content = contentFor(button);
			expect(content).toHaveClass('astryx-collapsible-content');
		});

		it('renders a ReactNode trigger, not just a string', async () => {
			const screen = await render(CollapsibleProbe, { props: { richTrigger: true, body: 'c' } });
			await expect.element(screen.getByTestId('rich')).toBeInTheDocument();
		});
	});

	describe('uncontrolled open state', () => {
		it('is open by default (aria-expanded="true")', async () => {
			const screen = await render(CollapsibleProbe, { props: { trigger: 'T', body: 'Body' } });
			await expect.element(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
		});

		it('honors defaultIsOpen={false} (starts collapsed)', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'Body', defaultIsOpen: false }
			});
			await expect.element(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
		});

		it('toggles open/closed when the trigger is clicked', async () => {
			const screen = await render(CollapsibleProbe, { props: { trigger: 'T', body: 'Body' } });
			const button = screen.getByRole('button');

			await expect.element(button).toHaveAttribute('aria-expanded', 'true');
			await userEvent.click(button);
			await expect.element(button).toHaveAttribute('aria-expanded', 'false');
			await userEvent.click(button);
			await expect.element(button).toHaveAttribute('aria-expanded', 'true');
		});

		it('opens a default-collapsed instance on click', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'Body', defaultIsOpen: false }
			});
			const button = screen.getByRole('button');
			await userEvent.click(button);
			await expect.element(button).toHaveAttribute('aria-expanded', 'true');
		});

		it('toggles via keyboard activation (Enter and Space)', async () => {
			const screen = await render(CollapsibleProbe, { props: { trigger: 'T', body: 'Body' } });
			const button = screen.getByRole('button');
			const buttonEl = button.element() as HTMLElement;

			buttonEl.focus();
			await expect.element(button).toHaveFocus();

			await userEvent.keyboard('{Enter}');
			await expect.element(button).toHaveAttribute('aria-expanded', 'false');
			await userEvent.keyboard(' ');
			await expect.element(button).toHaveAttribute('aria-expanded', 'true');
		});

		it('hides the content region (display:none) only when collapsed', async () => {
			const screen = await render(CollapsibleProbe, { props: { trigger: 'T', body: 'Body' } });
			const button = screen.getByRole('button');
			const content = contentFor(button.element() as HTMLElement);

			// Open: not display:none.
			await expect.element(content).not.toHaveStyle({ display: 'none' });
			await userEvent.click(button);
			// Collapsed: hidden via the contentHidden style.
			await expect.element(content).toHaveStyle({ display: 'none' });
		});

		it('rotates the chevron indicator between open and closed states', async () => {
			const screen = await render(CollapsibleProbe, { props: { trigger: 'T', body: 'Body' } });
			const button = screen.getByRole('button');
			// The chevron lives in the last span of the trigger button.
			const chevron = (button.element() as HTMLElement).querySelectorAll('span')[1];
			const openClass = chevron.getAttribute('class');

			await userEvent.click(button);
			await expect.element(button).toHaveAttribute('aria-expanded', 'false');
			const closedClass = chevron.getAttribute('class');
			expect(closedClass).not.toEqual(openClass);
		});
	});

	describe('controlled open state', () => {
		it('reflects the isOpen prop', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'Body', isOpen: false }
			});
			await expect.element(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');

			await screen.rerender({ trigger: 'T', body: 'Body', isOpen: true });
			await expect.element(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
		});

		it('calls onOpenChange with the negated state on click', async () => {
			const onOpenChange = vi.fn();
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'Body', isOpen: false, onOpenChange }
			});
			await userEvent.click(screen.getByRole('button'));
			expect(onOpenChange).toHaveBeenCalledTimes(1);
			expect(onOpenChange).toHaveBeenCalledWith(true);
		});

		it('does not self-update when controlled without onOpenChange', async () => {
			// A controlled instance is driven entirely by the isOpen prop; a click
			// must not flip the visual state on its own.
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'Body', isOpen: false }
			});
			const button = screen.getByRole('button');
			await userEvent.click(button);
			await expect.element(button).toHaveAttribute('aria-expanded', 'false');
		});

		it('stays put until the parent updates isOpen', async () => {
			const onOpenChange = vi.fn();
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'Body', isOpen: false, onOpenChange }
			});
			const button = screen.getByRole('button');
			await userEvent.click(button);
			// Still closed — parent hasn't re-rendered with the new value yet.
			await expect.element(button).toHaveAttribute('aria-expanded', 'false');

			await screen.rerender({ trigger: 'T', body: 'Body', isOpen: true, onOpenChange });
			await expect.element(button).toHaveAttribute('aria-expanded', 'true');
		});
	});

	describe('disabled state', () => {
		it('marks the trigger aria-disabled and drops it from the tab order', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'Body', isDisabled: true }
			});
			const button = screen.getByRole('button');
			await expect.element(button).toHaveAttribute('aria-disabled', 'true');
			await expect.element(button).toHaveAttribute('tabindex', '-1');
			// Never the native disabled attribute — it stays focusable/perceivable.
			// RESTATED: upstream asserts `not.toBeDisabled()`. In this browser project
			// jest-dom's `toBeDisabled` treats `aria-disabled="true"` as disabled
			// (React's does not), so it would assert the matcher's heuristic rather
			// than the component. The title's real claim — no *native* disabled
			// attribute — is checked directly, which is what upstream meant.
			await expect.element(button).not.toHaveAttribute('disabled');
		});

		it('is enabled by default (no aria-disabled, stays in tab order)', async () => {
			const screen = await render(CollapsibleProbe, { props: { trigger: 'T', body: 'Body' } });
			const button = screen.getByRole('button');
			await expect.element(button).not.toHaveAttribute('aria-disabled');
			await expect.element(button).not.toHaveAttribute('tabindex', '-1');
		});

		it('does not toggle when the trigger is clicked while disabled', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'Body', isDisabled: true, defaultIsOpen: true }
			});
			const button = screen.getByRole('button');
			await expect.element(button).toHaveAttribute('aria-expanded', 'true');
			// aria-disabled makes Playwright's actionability refuse a userEvent.click,
			// which would assert the heuristic rather than the component's guard; the
			// click is delivered natively (upstream's fireEvent.click) so handleToggle
			// still runs and hits the isDisabled guard.
			(button.element() as HTMLElement).click();
			await expect.element(button).toHaveAttribute('aria-expanded', 'true');
		});

		it('does not fire onOpenChange while disabled', async () => {
			const onOpenChange = vi.fn();
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'Body', isDisabled: true, onOpenChange }
			});
			(screen.getByRole('button').element() as HTMLElement).click();
			expect(onOpenChange).not.toHaveBeenCalled();
		});

		it('does not collapse an already-open item — content stays visible', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'Body', isDisabled: true, defaultIsOpen: true }
			});
			const content = contentFor(screen.getByRole('button').element() as HTMLElement);
			await expect.element(content).not.toHaveStyle({ display: 'none' });
		});

		it('does not toggle its group item when disabled', async () => {
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'single',
					items: [
						{ trigger: 'A', value: 'a', body: 'Body A', isDisabled: true },
						{ trigger: 'B', value: 'b', body: 'Body B' }
					]
				}
			});
			const triggerA = screen.getByRole('button', { name: /A/ });
			(triggerA.element() as HTMLElement).click();
			await expect.element(triggerA).toHaveAttribute('aria-expanded', 'false');
		});
	});

	describe('prop forwarding', () => {
		// Counterpart to upstream's `forwards a ref to the root element`; see the
		// file header. An attachment through the rest props is how a consumer reaches
		// the root here, and it receives the element rather than only proving a call.
		it('forwards a ref to the root element', async () => {
			const attached = vi.fn();
			await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'c', [createAttachmentKey()]: attached }
			});
			expect(attached).toHaveBeenCalledOnce();
			expect(attached.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
		});

		it('passes through data-testid and other DOM props to the root', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'T', body: 'c', 'data-testid': 'root', 'data-custom': 'x' }
			});
			await expect.element(screen.getByTestId('root')).toHaveAttribute('data-custom', 'x');
		});

		// DROPPED: `exposes a displayName for devtools`. Svelte has no displayName
		// surface; there is nothing to assert. Named per the count contract.
	});

	describe('inside CollapsibleGroup (single mode)', () => {
		it('opens the item matching defaultValue and closes the rest', async () => {
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'single',
					defaultValue: 'b',
					items: [
						{ trigger: 'A', value: 'a', body: 'Body A' },
						{ trigger: 'B', value: 'b', body: 'Body B' }
					]
				}
			});
			const a = screen.getByRole('button', { name: /A/ });
			const b = screen.getByRole('button', { name: /B/ });
			await expect.element(a).toHaveAttribute('aria-expanded', 'false');
			await expect.element(b).toHaveAttribute('aria-expanded', 'true');
		});

		it('opening one item closes the previously open item', async () => {
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'single',
					defaultValue: 'a',
					items: [
						{ trigger: 'A', value: 'a', body: 'Body A' },
						{ trigger: 'B', value: 'b', body: 'Body B' }
					]
				}
			});
			const a = screen.getByRole('button', { name: /A/ });
			const b = screen.getByRole('button', { name: /B/ });
			await expect.element(a).toHaveAttribute('aria-expanded', 'true');

			await userEvent.click(b);
			await expect.element(a).toHaveAttribute('aria-expanded', 'false');
			await expect.element(b).toHaveAttribute('aria-expanded', 'true');
		});

		it('clicking the open item closes it (single mode allows all-closed)', async () => {
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'single',
					defaultValue: 'a',
					items: [{ trigger: 'A', value: 'a', body: 'Body A' }]
				}
			});
			const a = screen.getByRole('button');
			await userEvent.click(a);
			await expect.element(a).toHaveAttribute('aria-expanded', 'false');
		});

		it('fires the group onChange with the newly opened value', async () => {
			const onChange = vi.fn();
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'single',
					onChange,
					items: [{ trigger: 'A', value: 'a', body: 'Body A' }]
				}
			});
			await userEvent.click(screen.getByRole('button'));
			expect(onChange).toHaveBeenCalledWith('a');
		});
	});

	describe('inside CollapsibleGroup (multiple mode)', () => {
		it('allows several items open at once', async () => {
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'multiple',
					defaultValue: ['a'],
					items: [
						{ trigger: 'A', value: 'a', body: 'Body A' },
						{ trigger: 'B', value: 'b', body: 'Body B' }
					]
				}
			});
			const a = screen.getByRole('button', { name: /A/ });
			const b = screen.getByRole('button', { name: /B/ });
			await expect.element(a).toHaveAttribute('aria-expanded', 'true');
			await expect.element(b).toHaveAttribute('aria-expanded', 'false');

			await userEvent.click(b);
			// Opening B does not close A in multiple mode.
			await expect.element(a).toHaveAttribute('aria-expanded', 'true');
			await expect.element(b).toHaveAttribute('aria-expanded', 'true');
		});

		it('fires onChange with the full array of open values', async () => {
			const onChange = vi.fn();
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'multiple',
					defaultValue: ['a'],
					onChange,
					items: [
						{ trigger: 'A', value: 'a', body: 'Body A' },
						{ trigger: 'B', value: 'b', body: 'Body B' }
					]
				}
			});
			await userEvent.click(screen.getByRole('button', { name: /B/ }));
			expect(onChange).toHaveBeenCalledWith(['a', 'b']);
		});
	});

	describe('group presentation (dividers + density)', () => {
		it('reflects group density as a data attribute on items when dividers are enabled', async () => {
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'single',
					hasDividers: true,
					density: 'compact',
					items: [{ trigger: 'A', value: 'a', body: 'Body A', 'data-testid': 'item-a' }]
				}
			});
			await expect.element(screen.getByTestId('item-a')).toHaveAttribute('data-density', 'compact');
		});

		it('omits density data attribute when standalone (no group)', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'A', body: 'Body', 'data-testid': 'item' }
			});
			await expect.element(screen.getByTestId('item')).not.toHaveAttribute('data-density');
		});

		it('reflects the visual axes and states on their owning theme targets', async () => {
			// Two roots in one test, as upstream renders one fragment: the group's
			// presentation targets and a standalone item's defaults side by side.
			await render(CollapsibleGroupProbe, {
				props: {
					type: 'single',
					hasDividers: true,
					density: 'compact',
					chevronPosition: 'start',
					defaultValue: 'open',
					items: [
						{ trigger: 'Open', value: 'open', body: 'Open body', 'data-testid': 'open-item' },
						{
							trigger: 'Disabled',
							value: 'disabled',
							body: 'Disabled body',
							isDisabled: true,
							'data-testid': 'disabled-item'
						}
					]
				}
			});
			await render(CollapsibleProbe, {
				props: {
					trigger: 'Standalone',
					defaultIsOpen: false,
					body: 'Standalone body',
					'data-testid': 'standalone-item'
				}
			});

			const openRoot = document.querySelector<HTMLElement>('[data-testid="open-item"]')!;
			const openTrigger = openRoot.querySelector('button')!;
			const openContent = contentFor(openTrigger);
			expect(openRoot).toHaveAttribute('data-density', 'compact');
			expect(openRoot).toHaveAttribute('data-divided', 'divided');
			expect(openTrigger).toHaveAttribute('data-density', 'compact');
			expect(openTrigger).toHaveAttribute('data-chevron-position', 'start');
			expect(openTrigger).toHaveAttribute('data-open', 'open');
			expect(openTrigger).not.toHaveAttribute('data-disabled');
			expect(openContent).toHaveAttribute('data-density', 'compact');
			expect(openContent).toHaveAttribute('data-open', 'open');

			const disabledRoot = document.querySelector<HTMLElement>('[data-testid="disabled-item"]')!;
			const disabledTrigger = disabledRoot.querySelector('button')!;
			expect(disabledTrigger).toHaveAttribute('data-disabled', 'disabled');
			expect(disabledTrigger).not.toHaveAttribute('data-open');
			expect(contentFor(disabledTrigger)).not.toHaveAttribute('data-open');

			const standaloneRoot = document.querySelector<HTMLElement>(
				'[data-testid="standalone-item"]'
			)!;
			const standaloneTrigger = standaloneRoot.querySelector('button')!;
			const standaloneContent = contentFor(standaloneTrigger);
			expect(standaloneRoot).not.toHaveAttribute('data-density');
			expect(standaloneRoot).not.toHaveAttribute('data-divided');
			expect(standaloneTrigger).toHaveAttribute('data-chevron-position', 'end');
			expect(standaloneTrigger).not.toHaveAttribute('data-density');
			expect(standaloneTrigger).not.toHaveAttribute('data-open');
			expect(standaloneTrigger).not.toHaveAttribute('data-disabled');
			expect(standaloneContent).not.toHaveAttribute('data-density');
			expect(standaloneContent).not.toHaveAttribute('data-open');
		});
	});

	describe('chevron position', () => {
		/**
		 * Placement is a DOM order question. Both the label and the chevron render
		 * as spans, so they are told apart by what they hold — the chevron is the
		 * one carrying the svg — and compared by position rather than tag.
		 */
		function triggerParts(container: HTMLElement, testId: string) {
			const root = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
			const button = root.querySelector('button')!;
			const children = [...button.children] as HTMLElement[];
			return {
				chevronIndex: children.findIndex((el) => el.querySelector('svg')),
				labelIndex: children.findIndex((el) => el.textContent?.trim() !== ''),
				glyph: button.querySelector('svg')?.innerHTML
			};
		}

		it('puts the chevron after the label by default', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'A', body: 'Body', 'data-testid': 'item' }
			});
			const { chevronIndex, labelIndex } = triggerParts(screen.container, 'item');
			expect(chevronIndex).toBeGreaterThan(labelIndex);
		});

		it('puts the chevron before the label when position is start', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'A', chevronPosition: 'start', body: 'Body', 'data-testid': 'item' }
			});
			const { chevronIndex, labelIndex } = triggerParts(screen.container, 'item');
			expect(chevronIndex).toBeLessThan(labelIndex);
		});

		it('swaps the glyph with the side, not just the position', async () => {
			// A leading arrow points into the row and turns down; a trailing one
			// points down and flips up. Reusing one glyph for both would leave a
			// closed leading chevron pointing the wrong way, so the two positions
			// must not render the same art.
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'A', body: 'Body', 'data-testid': 'at-end' }
			});
			await render(CollapsibleProbe, {
				props: {
					trigger: 'A',
					chevronPosition: 'start',
					body: 'Body',
					'data-testid': 'at-start'
				}
			});
			const endGlyph = triggerParts(screen.container, 'at-end').glyph;
			const startGlyph = triggerParts(document.body, 'at-start').glyph;
			expect(endGlyph).toBeTruthy();
			expect(startGlyph).toBeTruthy();
			expect(startGlyph).not.toBe(endGlyph);
		});

		it('takes the position from the surrounding group', async () => {
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'single',
					chevronPosition: 'start',
					items: [{ trigger: 'A', value: 'a', body: 'Body', 'data-testid': 'item' }]
				}
			});
			const { chevronIndex, labelIndex } = triggerParts(screen.container, 'item');
			expect(chevronIndex).toBeLessThan(labelIndex);
		});

		it('lets an item override the group position', async () => {
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'single',
					chevronPosition: 'start',
					items: [
						{
							trigger: 'A',
							value: 'a',
							chevronPosition: 'end',
							body: 'Body',
							'data-testid': 'item'
						}
					]
				}
			});
			const { chevronIndex, labelIndex } = triggerParts(screen.container, 'item');
			expect(chevronIndex).toBeGreaterThan(labelIndex);
		});

		it('gives the label the rest of the row when the chevron leads', async () => {
			// The trigger is `space-between`. With the chevron trailing that is what
			// separates the two, but with it leading there is nothing to absorb the
			// free space, so an unfilled label would be thrown to the far edge with
			// a gap behind the arrow. It also has to grow for a trigger that spreads
			// its own contents to have a row to spread across.
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'A', chevronPosition: 'start', body: 'Body', 'data-testid': 'item' }
			});
			const root = screen.container.querySelector<HTMLElement>('[data-testid="item"]')!;
			const button = root.querySelector('button')!;
			const label = [...button.children].find((el) => el.textContent?.trim() !== '');
			expect(label).toHaveStyle('flex-grow: 1');
		});

		it('does not leak the group position into a nested collapsible', async () => {
			// Collapsible resets the presentation context around its children, so a
			// collapsible nested in an item's body keeps its own default.
			const screen = await render(CollapsibleGroupProbe, {
				props: {
					type: 'single',
					defaultValue: 'a',
					chevronPosition: 'start',
					items: [
						{
							trigger: 'A',
							value: 'a',
							nestedTrigger: 'B',
							body: 'Body',
							'data-testid': 'outer'
						}
					]
				}
			});
			const { chevronIndex, labelIndex } = triggerParts(screen.container, 'inner');
			expect(chevronIndex).toBeGreaterThan(labelIndex);
		});
	});

	describe('pressed state', () => {
		it('paints the pressed overlay on the trigger row while it is pressed', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'Details', body: 'Body' }
			});
			expect(hasPressedArm(screen.getByRole('button').element())).toBe(true);
		});

		it('does not press a disabled trigger', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'Details', body: 'Body', isDisabled: true }
			});
			expect(hasPressedArm(screen.getByRole('button').element())).toBe(false);
		});
	});

	describe('Collapsible close focus (AR4)', () => {
		it('moves focus inside the content to the trigger when it closes', async () => {
			const screen = await render(CollapsibleProbe, {
				props: {
					trigger: 'Details',
					bodyButton: 'Inside',
					isOpen: true,
					onOpenChange: () => {},
					elsewhere: true
				}
			});
			const inside = screen.getByRole('button', { name: 'Inside', exact: true }).element();
			(inside as HTMLElement).focus();
			await screen.rerender({
				trigger: 'Details',
				bodyButton: 'Inside',
				isOpen: false,
				onOpenChange: () => {},
				elsewhere: true
			});
			await expect
				.element(screen.getByRole('button', { name: 'Details', exact: true }))
				.toHaveFocus();
		});

		it('moves no focus that is outside the content', async () => {
			const screen = await render(CollapsibleProbe, {
				props: {
					trigger: 'Details',
					bodyButton: 'Inside',
					isOpen: true,
					onOpenChange: () => {},
					elsewhere: true
				}
			});
			const elsewhere = screen.getByRole('button', { name: 'Elsewhere', exact: true }).element();
			(elsewhere as HTMLElement).focus();
			await screen.rerender({
				trigger: 'Details',
				bodyButton: 'Inside',
				isOpen: false,
				onOpenChange: () => {},
				elsewhere: true
			});
			expect(elsewhere).toHaveFocus();
		});

		it('keeps focus on the trigger when the trigger closes it', async () => {
			const screen = await render(CollapsibleProbe, {
				props: { trigger: 'Details', bodyButton: 'Inside' }
			});
			const trigger = screen.getByRole('button', { name: 'Details', exact: true });
			await userEvent.click(trigger);
			await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
			await expect.element(trigger).toHaveFocus();
		});

		it('moves no focus when it opens', async () => {
			const screen = await render(CollapsibleProbe, {
				props: {
					trigger: 'Details',
					bodyButton: 'Inside',
					isOpen: false,
					onOpenChange: () => {},
					elsewhere: true
				}
			});
			const elsewhere = screen.getByRole('button', { name: 'Elsewhere', exact: true }).element();
			(elsewhere as HTMLElement).focus();
			await screen.rerender({
				trigger: 'Details',
				bodyButton: 'Inside',
				isOpen: true,
				onOpenChange: () => {},
				elsewhere: true
			});
			expect(elsewhere).toHaveFocus();
		});
	});
});
