/** PORTS: Typeahead/Typeahead.test.tsx */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import BaseTypeahead from '$lib/components/typeahead/base-typeahead.svelte';
import Typeahead from '$lib/components/typeahead/typeahead.svelte';
import Fixture from './fixtures/base-typeahead-fixture.svelte';
import I18nFixture from './fixtures/typeahead-i18n-fixture.svelte';
import LaneFixture from './fixtures/base-typeahead-lane-fixture.svelte';
import ControlledFixture from './fixtures/typeahead-controlled-fixture.svelte';
import DialogFixture from './fixtures/typeahead-dialog-fixture.svelte';
import RequiredFixture from './fixtures/typeahead-required-fixture.svelte';
import StatusFixture from './fixtures/typeahead-status-fixture.svelte';
import FormFixture from './fixtures/typeahead-form-fixture.svelte';
import DisabledTabFixture from './fixtures/typeahead-disabled-tab-fixture.svelte';
import InputGroupFixture from './fixtures/typeahead-input-group-fixture.svelte';
import type { SearchableItem, SearchSource } from '$lib/components/typeahead/types.js';
import { __resetLiveRegionsForTest } from '$lib/hooks/use-announce.js';
import * as core from '$lib/index.js';
import baseTypeaheadSource from '$lib/components/typeahead/base-typeahead.svelte?raw';

/**
 * Astryx's `Typeahead/Typeahead.test.tsx` at the 0.7.13 pin, ported case for
 * case where this port's seams and harness allow it.
 *
 * ## The unported cases, in upstream's order
 *
 * - `BaseTypeahead press inside and outside`: *removes its document listeners
 *   when the field unmounts with the list open*. Outside-press listening is
 *   owned by the shared Layer/dismissal stack here, not by `BaseTypeahead`, so
 *   the assertion (spying for `BaseTypeahead`'s own pointerdown/up/cancel
 *   removals) names a React-era implementation. The unmount path is exercised
 *   by every closing case in this file, which leaves no layer behind.
 * - The same block: *keeps the list open on a press in its input inside a
 *   shadow root*. `BaseTypeahead` finds its layer with `document.getElementById`
 *   and vitest-browser-svelte has no render-into-a-shadow-root option; the
 *   arrangement needs a shadow-root-aware id lookup and a mount seam this port
 *   does not have.
 * - `Typeahead`: *names the token button, the Tab stop while a value shows, by
 *   the field label and the value*. `Token` reads a closed prop list and
 *   exposes no `aria-labelledby`/`aria-describedby` seam (see
 *   `port/debts.md`), so the token's accessible name is its value alone.
 * - `Typeahead`: *names the token button with a caller aria-labelledby as the
 *   input is named*. Same `Token` naming seam.
 * - `Typeahead`: *forwards DOM props and ref to the combobox input while
 *   preserving edit and blur behavior*. The 0.7.13 `container*`/`control*`
 *   DOM-prop routing is not ported: `Typeahead`'s own rest props stop at the
 *   field, and the input is reached through an attachment rather than a ref.
 * - `Typeahead`: *forwards DOM props and ref to the input inside InputGroup,
 *   with control\* on the surface*. Same unported routing.
 * - `BaseTypeahead hasEntriesOnFocus`: *does not commit a loading cycle for an
 *   empty synchronous bootstrap*. Upstream counts React commits with
 *   `Profiler`; Svelte has no commit-count counterpart. The behaviour the
 *   `Profiler` was there to prove (a synchronous bootstrap reports no loading)
 *   is ported alongside it.
 * - The same block: *keeps the loading state under StrictMode for a pending
 *   autofocus bootstrap*. StrictMode's deliberate double render is React-only.
 * - The same block: *clears loading and aria-busy when source is replaced in a
 *   transition that suspends and retries*. React `Suspense` and
 *   `startTransition` have no Svelte counterpart.
 * - The same block: *keeps the in-flight search when a replacement source
 *   renders in a transition that never commits*. Same discarded-render
 *   semantics.
 * - The same block: *keeps a read that the replacement source starts earlier in
 *   the commit that replaces it*. The case asserts React insertion/layout
 *   effect ordering in one commit; Svelte's effect order is different and has
 *   no equivalent seam.
 * - `emptySearchText rename` (four cases: an element renders; the removed
 *   `emptySearchResultsText` is not read, on `Typeahead` and on
 *   `BaseTypeahead`; the element's text is announced). The 0.7.13 rename and
 *   widening to a `ReactNode`/`Snippet` is not ported: both components still
 *   expose the old string prop, and `Tokenizer`/`CommandPalette` consume it.
 *   That is an unported API surface, not a test-only translation.
 *
 * Everything else is ported, including the 0.7.13 field restructure's own
 * cases: the content lane, the end lane and its in-flow controls, busy-indicator
 * ownership, trailing-key delivery, the token overlay, min-query behaviour,
 * source replacement, disabled-field interaction, pointer highlight and the
 * token keyboard model.
 *
 * Runs in the **client (real Chromium)** project. Upstream's `beforeAll`/
 * `beforeEach` stubs for `showPopover`/`hidePopover`/`:popover-open` are
 * therefore GONE — Chromium implements all of it natively — and its
 * `h = {hidden: true}` companion survives as a container `querySelector` where
 * the node really is inside a closed (`display: none`) popover.
 *
 * Mechanical translations, each following a pattern an earlier suite set:
 *
 * - `render` is async — always awaited; `rerender` is `screen.rerender`.
 * - `fireEvent.change(input, {target: {value}})` becomes `setQuery()` below: a
 *   native value assignment plus a bubbling `input` event, which is exactly what
 *   React's synthetic `change` on a text input is. It deliberately does *not*
 *   focus, as upstream's does not.
 * - `fireEvent.focus/blur` become the real `.focus()`/`.blur()`; a blur carrying
 *   a `relatedTarget` becomes a dispatched `FocusEvent`, since only the browser
 *   can set that property on a genuine focus move.
 * - `fireEvent.keyDown(input, {key})` becomes a dispatched `KeyboardEvent`.
 *   Upstream's is a synthetic dispatch onto an input it never focused, which
 *   `userEvent.keyboard` — a real key press routed to the focused element —
 *   would not reproduce.
 * - `act()` has no counterpart — a `$state` write flushes on its own and
 *   `vi.waitFor`/`expect.element` retry.
 * - `anchorRef` is `anchorEl` (an element, not a `RefObject` — the shape
 *   `Popover` settled), so the two anchor cases go through
 *   `base-typeahead-fixture.svelte` rather than building the wrapper by hand.
 * - A case that renders JSX around the component gets a fixture: the i18n
 *   provider, the busy lane, the controlled edit-mode value, the host Dialog,
 *   the required/status field trees, the form, the InputGroup and the
 *   before-the-field control are `fixtures/typeahead-*.svelte`.
 *
 * RESTATED cases carry an inline comment: the `user.paste` cases (the driver
 * has no paste; `fill` produces the same single-input-event value change), the
 * `blocks typing` and disabled-click cases (Playwright refuses to act on a
 * `readonly`/`aria-disabled` element, so the browser's own focus/key dispatch
 * is used), the mouse-click bootstrap case (a real click *is* the four-event
 * sequence upstream synthesises), the native-attribute assertions that replace
 * `toBeDisabled` (vitest-browser's is Playwright's ARIA computation, which
 * counts `aria-disabled`), the popover-attribute and outside-press cases (a
 * real Chromium light-dismisses `popover="auto"`; upstream's manual popover
 * does not), the declared-style reads (Chrome resolves `auto` and unitless
 * zero to used values where jsdom reports the declaration), and the
 * `search(query)` call assertions (this port's `SearchSource` takes one
 * argument, so the second `expect.anything()` has no counterpart).
 *
 * (`use-typeahead.test.ts` is a different suite entirely — the type-to-select
 * hook `DropdownMenu` uses. It was renamed off this filename when the component
 * landed, and has since moved to the server project.)
 */

const fruits: SearchableItem[] = [
	{ id: '1', label: 'Apple' },
	{ id: '2', label: 'Banana' },
	{ id: '3', label: 'Cherry' },
	{ id: '4', label: 'Date' },
	{ id: '5', label: 'Elderberry' }
];

const fruitSource: SearchSource = {
	search: (query: string) =>
		fruits.filter((f) => f.label.toLowerCase().includes(query.toLowerCase())),
	bootstrap: () => fruits.slice(0, 3)
};

/** Upstream's `fireEvent.change(input, {target: {value}})`. */
function setQuery(input: HTMLInputElement, value: string): void {
	const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
	setter?.call(input, value);
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Upstream's `fireEvent.blur(input, {relatedTarget})`. */
function blurTo(input: HTMLInputElement, relatedTarget: Element | null): void {
	input.dispatchEvent(new FocusEvent('blur', { relatedTarget, bubbles: false }));
}

function comboboxIn(container: HTMLElement): HTMLInputElement {
	const el = container.querySelector('input[role="combobox"]');
	if (!(el instanceof HTMLInputElement)) throw new Error('expected a role="combobox" input');
	return el;
}

function optionsIn(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
}

function optionNamed(container: HTMLElement, text: string): HTMLElement {
	const el = optionsIn(container).find((o) => o.textContent?.trim() === text);
	if (!el) throw new Error(`no option named "${text}"`);
	return el;
}

function tooltipIn(container: HTMLElement): HTMLElement {
	const el = container.querySelector('[role="tooltip"]');
	if (!(el instanceof HTMLElement)) throw new Error('expected a role="tooltip" element');
	return el;
}

function listboxIn(container: HTMLElement): HTMLElement | null {
	return container.querySelector<HTMLElement>('[role="listbox"]');
}

function tokenButtonIn(container: HTMLElement, label: string): HTMLElement {
	const el = Array.from(container.querySelectorAll<HTMLElement>('.astryx-token button')).find(
		(button) => button.textContent?.trim() === label
	);
	if (!el) throw new Error(`no token button labelled "${label}"`);
	return el;
}

function tokenIn(container: HTMLElement): HTMLElement {
	const el = container.querySelector<HTMLElement>('.astryx-token');
	if (!el) throw new Error('no token');
	return el;
}

function tokenLabelIn(container: HTMLElement, label: string): HTMLElement {
	const el = Array.from(tokenIn(container).querySelectorAll<HTMLElement>('span')).find(
		(span) => span.textContent?.trim() === label
	);
	if (!el) throw new Error(`no token label "${label}"`);
	return el;
}

/**
 * Upstream's `press(target)` — a synthetic press with no click. Kept synthetic
 * because the point of several cases is which press the field ignores.
 */
function press(target: Element): void {
	target.dispatchEvent(
		new PointerEvent('pointerdown', {
			bubbles: true,
			composed: true,
			pointerId: 1,
			isPrimary: true
		})
	);
	target.dispatchEvent(
		new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, isPrimary: true })
	);
}

function liveRegionText(): string {
	return document.querySelector('[data-astryx-live-region="polite"]')?.textContent ?? '';
}

function busySpinnerIn(container: HTMLElement): HTMLElement | null {
	return container.querySelector<HTMLElement>('[role="img"][aria-label="Loading"]');
}

/**
 * The specified value of a property from the stylesheet rule that applies to
 * `element`. Chrome resolves `auto` margins and unitless zeroes to used values,
 * so a computed-style read cannot see the declaration upstream's jsdom read.
 */
function declaredStyleFor(element: Element, property: string): string | null {
	function walk(rules: CSSRuleList): string | null {
		for (const rule of Array.from(rules)) {
			if (rule instanceof CSSStyleRule) {
				try {
					if (element.matches(rule.selectorText)) {
						const value = rule.style.getPropertyValue(property);
						if (value !== '') {
							return value;
						}
					}
				} catch {
					// A selector with a private-looking escape can still be rejected
					// by `matches`; another rule may carry the declaration.
				}
			}
			const nested = (rule as CSSGroupingRule).cssRules;
			if (nested) {
				const found = walk(nested);
				if (found !== null) {
					return found;
				}
			}
		}
		return null;
	}
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			const found = walk(sheet.cssRules);
			if (found !== null) {
				return found;
			}
		} catch {
			// A cross-origin sheet is not readable; the injected one is.
		}
	}
	return null;
}

afterEach(() => {
	__resetLiveRegionsForTest();
	vi.restoreAllMocks();
});

describe('BaseTypeahead', () => {
	it('renders input with combobox role', async () => {
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {} }
		});
		expect(comboboxIn(screen.container)).toBeInTheDocument();
	});

	it('renders placeholder text', async () => {
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				placeholder: 'Pick a fruit...'
			}
		});
		await expect.element(screen.getByPlaceholder('Pick a fruit...')).toBeInTheDocument();
	});

	it('sets aria-expanded=false initially', async () => {
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {} }
		});
		expect(comboboxIn(screen.container)).toHaveAttribute('aria-expanded', 'false');
	});

	it('shows results on input change', async () => {
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {} }
		});
		const input = comboboxIn(screen.container);
		setQuery(input, 'App');

		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
		expect(screen.container.querySelector('[role="listbox"]')).toBeInTheDocument();
	});

	it('announces the result count to a live region (comboboxes-6)', async () => {
		const screen = await render(I18nFixture, {
			props: {
				locale: 'fr',
				overrides: {
					fr: {
						'@astryx.typeahead.resultCount':
							'{count, number} {count, plural, one {résultat} other {résultats}}'
					}
				},
				searchSource: fruitSource
			}
		});
		const input = comboboxIn(screen.container);
		// "Ap" matches Apple only — the singular ICU branch.
		setQuery(input, 'Ap');

		await vi.waitFor(() => {
			// Exact, so the plural branch ("1 résultats") would fail.
			expect(liveRegionText()).toBe('1 résultat');
		});
	});

	it('announces the plural result count', async () => {
		const screen = await render(I18nFixture, {
			props: {
				locale: 'fr',
				overrides: {
					fr: {
						'@astryx.typeahead.resultCount':
							'{count, number} {count, plural, one {résultat} other {résultats}}'
					}
				},
				searchSource: fruitSource
			}
		});
		const input = comboboxIn(screen.container);
		// "err" matches Cherry and Elderberry.
		setQuery(input, 'err');

		await vi.waitFor(() => {
			expect(liveRegionText()).toBe('2 résultats');
		});
	});

	it('speaks the result count from a provider catalog', async () => {
		const screen = await render(I18nFixture, {
			props: {
				locale: 'fr',
				messages: {
					fr: {
						'@astryx.typeahead.resultCount': {
							defaultMessage: '{count, number} {count, plural, one {résultat} other {résultats}}'
						}
					}
				},
				searchSource: fruitSource
			}
		});
		const input = comboboxIn(screen.container);
		setQuery(input, 'err');

		await vi.waitFor(() => {
			// Same key through the catalog path rather than `overrides`.
			expect(liveRegionText()).toBe('2 résultats');
		});
	});

	it('announces "no results found" when the search is empty (comboboxes-6)', async () => {
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				debounceMs: 0,
				emptySearchResultsText: 'No results found'
			}
		});
		setQuery(comboboxIn(screen.container), 'zzzzz');

		await vi.waitFor(() => {
			expect(document.querySelector('[data-astryx-live-region="polite"]')).toHaveTextContent(
				'No results found'
			);
		});
	});

	it('exposes the empty state as a themeable target', async () => {
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				debounceMs: 0,
				emptySearchResultsText: 'No results found'
			}
		});
		setQuery(comboboxIn(screen.container), 'zzzzz');

		await vi.waitFor(() => {
			const emptyState = screen.container.querySelector('.astryx-typeahead-empty-state');
			expect(emptyState).not.toBeNull();
			expect(emptyState).toHaveTextContent('No results found');
		});
	});

	describe('empty results active descendant (#4059)', () => {
		it('does not set aria-activedescendant when search has 0 results', async () => {
			const screen = await render(BaseTypeahead, {
				props: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
			});
			const input = comboboxIn(screen.container);
			setQuery(input, 'zzzzz');

			await vi.waitFor(() => {
				expect(input).not.toHaveAttribute('aria-activedescendant');
			});

			// Press ArrowDown — should NOT set aria-activedescendant to option-0
			input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
			expect(input).not.toHaveAttribute('aria-activedescendant');

			// Press Home — should NOT set aria-activedescendant
			input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
			expect(input).not.toHaveAttribute('aria-activedescendant');
		});
	});

	describe('IME composition guard (#4828)', () => {
		it('does not select the highlighted result on a composing Enter', async () => {
			const onChange = vi.fn();
			const screen = await render(BaseTypeahead, {
				props: { searchSource: fruitSource, value: null, onChange, debounceMs: 0 }
			});
			const input = comboboxIn(screen.container);
			setQuery(input, 'App');
			await vi.waitFor(() => {
				expect(input).toHaveAttribute('aria-expanded', 'true');
			});

			// The browser fires this composing keydown for the Enter that commits
			// an IME candidate (isComposing: true, or legacy keyCode 229) before
			// compositionend writes the pending syllable into the input. Without
			// the guard this both selects the highlighted result AND clears the
			// input via handleSelect, so the syllable that compositionend then
			// writes lands in an emptied field instead of being part of the word.
			input.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })
			);
			expect(onChange).not.toHaveBeenCalled();
			expect(input).toHaveValue('App');

			input.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true })
			);
			expect(onChange).not.toHaveBeenCalled();
			expect(input).toHaveValue('App');

			// A real, non-composing Enter still selects normally.
			input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
			expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Apple' }));
		});
	});

	it('disables input when isDisabled', async () => {
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {}, isDisabled: true }
		});
		expect(comboboxIn(screen.container)).toBeDisabled();
	});

	it('uses anchorRef for dropdown positioning', async () => {
		// `anchorRef` is `anchorEl` here — an element rather than a `RefObject`, the
		// shape `Popover`'s own anchor settled.
		const anchor = document.createElement('div');
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {}, anchorEl: anchor }
		});
		// Component renders without error — anchor is wired up internally
		expect(comboboxIn(screen.container)).toBeInTheDocument();
	});

	it('does not select every result when items lack ids', async () => {
		const idlessItems = [{ label: 'Alpha' }, { label: 'Beta' }] as unknown as SearchableItem[];
		const idlessSource: SearchSource = {
			search: () => idlessItems,
			bootstrap: () => idlessItems
		};

		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: idlessSource,
				value: idlessItems[0],
				onChange: () => {},
				hasEntriesOnFocus: true,
				debounceMs: 0
			}
		});

		comboboxIn(screen.container).focus();

		await vi.waitFor(() => {
			expect(optionsIn(screen.container)).toHaveLength(2);
		});

		const options = optionsIn(screen.container);
		expect(options[0]).toHaveAttribute('aria-selected', 'true');
		expect(options[1]).toHaveAttribute('aria-selected', 'false');
	});
});

describe('BaseTypeahead press inside and outside', () => {
	async function openList() {
		const screen = await render(Fixture, {
			props: {
				variant: 'outside',
				typeahead: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
			}
		});
		const input = comboboxIn(screen.container);
		input.focus();
		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
		return { screen, input };
	}

	it('keeps the list open on a press in its own input', async () => {
		const { screen, input } = await openList();
		press(input);
		// RESTATED: the list is a native `popover="auto"` here, kept open through
		// the press by the field rather than by a manual popover. A real click on
		// the still-focused input would be the browser's outside press for an
		// auto popover, so the synthetic press is the whole case.
		expect(input).toHaveAttribute('aria-expanded', 'true');
		expect(listboxIn(screen.container)?.closest('[popover]')).toHaveAttribute('popover', 'auto');
	});

	it('keeps the list open on a press in the list', async () => {
		const { screen, input } = await openList();
		press(optionsIn(screen.container)[0]);
		expect(input).toHaveAttribute('aria-expanded', 'true');
	});

	it('closes the list on a press outside the field and the list', async () => {
		const { input } = await openList();
		// RESTATED: a synthetic press cannot trigger the browser's own light
		// dismiss, so the outside press is a real click on a control kept clear
		// of the open layer.
		const elsewhere = document.createElement('button');
		elsewhere.type = 'button';
		elsewhere.textContent = 'Elsewhere';
		elsewhere.style.cssText =
			'position: fixed; inset-block-end: 0; inset-inline-start: 0; z-index: 2147483647';
		document.body.appendChild(elsewhere);
		try {
			await userEvent.click(elsewhere);
			await vi.waitFor(() => {
				expect(input).toHaveAttribute('aria-expanded', 'false');
			});
		} finally {
			elsewhere.remove();
		}
	});

	it('keeps the list open when a scroll starts outside (pointercancel)', async () => {
		const { screen, input } = await openList();
		const elsewhere = screen.getByRole('button', { name: 'Outside', exact: true }).element();
		elsewhere.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
		elsewhere.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, composed: true }));
		expect(input).toHaveAttribute('aria-expanded', 'true');
	});

	it('inside a Dialog, keeps the list on an input press and closes only the list on a press elsewhere in the dialog', async () => {
		const onDialogChange = vi.fn();
		const screen = await render(DialogFixture, {
			props: { searchSource: fruitSource, onDialogChange }
		});
		const input = comboboxIn(screen.container);
		input.focus();
		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
		press(input);
		expect(input).toHaveAttribute('aria-expanded', 'true');
		// RESTATED: the dialog layout does not guarantee the text sits clear of
		// an open layer, so the press lands on a control kept at the dialog's
		// bottom-left corner.
		const dialog = screen.container.querySelector('dialog') as HTMLDialogElement;
		const elsewhere = document.createElement('button');
		elsewhere.type = 'button';
		elsewhere.textContent = 'Elsewhere';
		elsewhere.style.cssText =
			'position: fixed; inset-block-end: 0; inset-inline-start: 0; z-index: 2147483647';
		dialog.appendChild(elsewhere);
		try {
			await userEvent.click(elsewhere);
			await vi.waitFor(() => {
				expect(input).toHaveAttribute('aria-expanded', 'false');
			});
		} finally {
			elsewhere.remove();
		}
		expect(onDialogChange).not.toHaveBeenCalled();
	});
});

describe('BaseTypeahead focus-out', () => {
	it('closes the dropdown when focus leaves the input', async () => {
		const screen = await render(Fixture, {
			props: {
				variant: 'outside',
				typeahead: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
			}
		});
		const input = comboboxIn(screen.container);
		setQuery(input, 'App');

		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		// Focus moves to an element outside the field/dropdown → menu closes.
		blurTo(input, screen.getByRole('button', { name: 'Outside', exact: true }).element());

		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'false');
		});
	});

	it('closes the list on the Tab keydown, before the blur it produces', async () => {
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
		});
		const input = comboboxIn(screen.container);
		input.focus();
		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		// No blur is fired here on purpose: dismissing from the blur instead lets
		// the popover close mid-focus-move, which Chrome answers by dropping
		// focus to <body>.
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'false');
		});
	});

	it('Tab from the input with the list open moves focus to the next control', async () => {
		const screen = await render(Fixture, {
			props: {
				variant: 'outside',
				typeahead: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
			}
		});
		const input = comboboxIn(screen.container);
		input.focus();
		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		await userEvent.tab();
		expect(screen.getByRole('button', { name: 'Outside', exact: true })).toHaveFocus();
	});

	it('keeps the dropdown open when focus moves into the anchor wrapper', async () => {
		const screen = await render(Fixture, {
			props: {
				variant: 'anchor',
				typeahead: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
			}
		});
		const input = comboboxIn(screen.container);
		setQuery(input, 'App');

		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		// A sibling control inside the field (e.g. a clear button) receives focus.
		blurTo(input, screen.getByRole('button', { name: 'Sibling', exact: true }).element());

		// Menu stays open because focus is still within the field.
		expect(input).toHaveAttribute('aria-expanded', 'true');
	});

	it('does not close when a dropdown option receives focus', async () => {
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
		});
		const input = comboboxIn(screen.container);
		setQuery(input, 'App');

		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		blurTo(input, optionsIn(screen.container)[0]);

		expect(input).toHaveAttribute('aria-expanded', 'true');
	});
});

describe('Typeahead', () => {
	it('asks a touch keyboard for its Search key and no autocorrection, and Enter still picks the highlighted result', async () => {
		const onChange = vi.fn();
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: null,
				onChange,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);
		expect(input).toHaveAttribute('enterkeyhint', 'search');
		expect(input).toHaveAttribute('autocorrect', 'off');

		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Apple' }));
	});

	describe('out-of-order async results', () => {
		it('discards a stale response that resolves after a newer query', async () => {
			const resolvers = new Map<string, (items: SearchableItem[]) => void>();
			const rawSource: SearchSource = {
				search: async (query: string) =>
					new Promise<SearchableItem[]>((resolve) => {
						resolvers.set(query, resolve);
					}),
				bootstrap: () => []
			};

			const screen = await render(Typeahead, {
				props: {
					label: 'Fruit',
					searchSource: rawSource,
					value: null,
					onChange: () => {},
					debounceMs: 0
				}
			});

			const input = comboboxIn(screen.container);
			setQuery(input, 'a');
			setQuery(input, 'ap');

			// The newer query resolves first…
			await vi.waitFor(() => {
				expect(resolvers.get('ap')).toBeDefined();
			});
			resolvers.get('ap')!([{ id: 'apple', label: 'Apple' }]);
			await vi.waitFor(() => {
				expect(screen.container).toHaveTextContent('Apple');
			});

			// …then the abandoned query's slow response arrives and must be
			// discarded rather than overwriting the current results.
			resolvers.get('a')!([
				{ id: 'avocado', label: 'Avocado' },
				{ id: 'apricot', label: 'Apricot' }
			]);
			await vi.waitFor(() => {
				expect(screen.container).toHaveTextContent('Apple');
			});
			expect(screen.container).not.toHaveTextContent('Avocado');
		});

		it('discards a response from a source that was replaced while it was in flight', async () => {
			let resolveOld: ((items: SearchableItem[]) => void) | null = null;
			const oldSource: SearchSource = {
				search: async () =>
					new Promise<SearchableItem[]>((resolve) => {
						resolveOld = resolve;
					}),
				bootstrap: () => []
			};
			const newSource: SearchSource = {
				search: () => [{ id: 'banana', label: 'Banana' }],
				bootstrap: () => []
			};

			const screen = await render(Typeahead, {
				props: {
					label: 'Fruit',
					searchSource: oldSource,
					value: null,
					onChange: () => {},
					debounceMs: 0
				}
			});
			let input = comboboxIn(screen.container);
			setQuery(input, 'a');
			await vi.waitFor(() => expect(resolveOld).not.toBeNull());

			// The source is swapped while the old search is still pending and no
			// new query is typed. The stale response must not populate a menu that
			// now reads from a different source.
			await screen.rerender({
				label: 'Fruit',
				searchSource: newSource,
				value: null,
				onChange: () => {},
				debounceMs: 0
			});
			resolveOld!([{ id: 'apple', label: 'Apple' }]);
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(screen.container).not.toHaveTextContent('Apple');

			// Work started against the new source still lands normally.
			input = comboboxIn(screen.container);
			setQuery(input, 'ba');
			await vi.waitFor(() => {
				expect(screen.container).toHaveTextContent('Banana');
			});
		});
	});

	it('renders with label', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: null, onChange: () => {} }
		});
		await expect.element(screen.getByLabelText('Fruit', { exact: true })).toBeInTheDocument();
	});

	it('renders description text', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				description: 'Pick your favorite fruit',
				searchSource: fruitSource,
				value: null,
				onChange: () => {}
			}
		});
		await expect
			.element(screen.getByText('Pick your favorite fruit', { exact: true }))
			.toBeInTheDocument();
	});

	it('shows required indicator', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				isRequired: true,
				searchSource: fruitSource,
				value: null,
				onChange: () => {}
			}
		});
		await expect.element(screen.getByText(/Required/)).toBeInTheDocument();
	});

	it('exposes the resolved required state on the combobox (FormLayout FR5, AR2)', async () => {
		const screen = await render(RequiredFixture, { props: { searchSource: fruitSource } });
		const inputFor = (label: string): HTMLInputElement => {
			const labelEl = Array.from(screen.container.querySelectorAll('label')).find((candidate) =>
				candidate.textContent?.trim().startsWith(label)
			);
			const id = labelEl?.getAttribute('for');
			const input = id ? screen.container.querySelector<HTMLInputElement>(`#${id}`) : null;
			if (!input) throw new Error(`no input labelled "${label}"`);
			return input;
		};
		expect(inputFor('Plain')).not.toHaveAttribute('aria-required');
		expect(inputFor('Explicit')).toHaveAttribute('aria-required', 'true');
		// The form default hides the visible marker, so assistive technology
		// must still hear the field as required.
		expect(inputFor('By default')).toHaveAttribute('aria-required', 'true');
		expect(inputFor('Opted out')).not.toHaveAttribute('aria-required');
	});

	it('marks the combobox invalid for an error status only (WCAG 4.1.2)', async () => {
		const screen = await render(StatusFixture, { props: { searchSource: fruitSource } });
		const combobox = (name: string): HTMLInputElement => {
			const el = screen.container.querySelector<HTMLInputElement>(
				`input[role="combobox"][aria-label="${name}"]`
			);
			if (el) return el;
			const labelEl = Array.from(screen.container.querySelectorAll('label')).find((candidate) =>
				candidate.textContent?.trim().startsWith(name)
			);
			const id = labelEl?.getAttribute('for');
			const input = id ? screen.container.querySelector<HTMLInputElement>(`#${id}`) : null;
			if (!input) throw new Error(`no combobox named "${name}"`);
			return input;
		};
		expect(combobox('None')).not.toHaveAttribute('aria-invalid');
		expect(combobox('Warned')).not.toHaveAttribute('aria-invalid');
		expect(combobox('Failed')).toHaveAttribute('aria-invalid', 'true');
	});

	it("keeps a caller's own aria-invalid and aria-required when the field's own state is off", async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Caller',
				'aria-invalid': 'true',
				'aria-required': 'true',
				searchSource: fruitSource,
				value: null,
				onChange: () => {}
			}
		});
		const input = comboboxIn(screen.container);
		expect(input).toHaveAttribute('aria-invalid', 'true');
		expect(input).toHaveAttribute('aria-required', 'true');
	});

	it('renders error status message', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				status: { type: 'error' as const, message: 'Selection required' }
			}
		});
		await expect
			.element(screen.getByText('Selection required', { exact: true }))
			.toBeInTheDocument();
	});

	it('shows selected value as a token', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		await expect.element(screen.getByText(fruits[0].label, { exact: true })).toBeInTheDocument();
	});

	it('shows clear button when hasClear and value is selected', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: fruits[0],
				onChange: () => {},
				hasClear: true
			}
		});
		await expect
			.element(screen.getByRole('button', { name: 'Clear selection', exact: true }))
			.toBeInTheDocument();
	});

	it('does not show clear button when hasClear is false', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: fruits[0],
				onChange: () => {},
				hasClear: false
			}
		});
		expect(
			screen.container.querySelector('[aria-label="Clear selection"]')
		).not.toBeInTheDocument();
	});

	it('calls onChange with null when clear button is clicked', async () => {
		const onChange = vi.fn();
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: fruits[0],
				onChange,
				hasClear: true
			}
		});
		await userEvent.click(screen.getByRole('button', { name: 'Clear selection', exact: true }));
		expect(onChange).toHaveBeenCalledWith(null);
	});
});

describe('Typeahead size', () => {
	it('renders with size="lg"', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				size: 'lg' as const
			}
		});
		await expect.element(screen.getByLabelText('Fruit', { exact: true })).toBeInTheDocument();
	});
});

describe('BaseTypeahead hasEntriesOnFocus', () => {
	it('shows bootstrap results on mouse click', async () => {
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				hasEntriesOnFocus: true,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		// RESTATED: a real click *is* the pointerdown → focus → pointerup → click
		// sequence upstream has to synthesise one `fireEvent` at a time.
		await userEvent.click(input);

		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
	});

	it('shows bootstrap results on keyboard focus', async () => {
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				hasEntriesOnFocus: true,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		// Keyboard focus — no pointer events
		input.focus();

		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
	});

	it('does not report loading for synchronous bootstrap results', async () => {
		const onLoadingChange = vi.fn();
		const screen = await render(LaneFixture, {
			props: {
				searchSource: fruitSource,
				hasEntriesOnFocus: true,
				onBusyChange: onLoadingChange
			}
		});
		const input = comboboxIn(screen.container);
		input.focus();
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
		expect(onLoadingChange).not.toHaveBeenCalled();
	});

	it('clears a pending search loading state before synchronous bootstrap', async () => {
		let settleSearch: (items: SearchableItem[]) => void = () => {};
		const searchSource: SearchSource = {
			search: async () =>
				new Promise<SearchableItem[]>((resolve) => {
					settleSearch = resolve;
				}),
			bootstrap: () => []
		};
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource,
				value: null,
				onChange: () => {},
				hasEntriesOnFocus: true,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);
		setQuery(input, 'a');
		await vi.waitFor(() => {
			expect(busySpinnerIn(screen.container)).not.toBeNull();
		});

		setQuery(input, '');
		await vi.waitFor(() => {
			expect(busySpinnerIn(screen.container)).toBeNull();
		});

		settleSearch(fruits.slice(0, 1));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(input).toHaveAttribute('aria-expanded', 'false');
	});

	it('keeps the loading state for an asynchronous bootstrap', async () => {
		let settle: (items: SearchableItem[]) => void = () => {};
		const bootstrap = vi.fn(
			async () =>
				new Promise<SearchableItem[]>((resolve) => {
					settle = resolve;
				})
		);
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: { search: () => [], bootstrap },
				value: null,
				onChange: () => {},
				hasEntriesOnFocus: true
			}
		});
		const input = comboboxIn(screen.container);
		input.focus();
		await vi.waitFor(() => {
			expect(busySpinnerIn(screen.container)).not.toBeNull();
		});

		settle([]);
		await vi.waitFor(() => {
			expect(busySpinnerIn(screen.container)).toBeNull();
		});
	});

	it('clears the loading state when the search source is replaced during an in-flight load', async () => {
		let settle: (items: SearchableItem[]) => void = () => {};
		const bootstrap = vi.fn(
			async () =>
				new Promise<SearchableItem[]>((resolve) => {
					settle = resolve;
				})
		);
		const initialSource: SearchSource = { search: () => [], bootstrap };
		const replacementSource: SearchSource = { search: () => [], bootstrap: () => [] };

		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: initialSource,
				value: null,
				onChange: () => {},
				hasEntriesOnFocus: true
			}
		});
		const input = comboboxIn(screen.container);
		input.focus();
		await vi.waitFor(() => {
			expect(busySpinnerIn(screen.container)).not.toBeNull();
		});

		await screen.rerender({
			searchSource: replacementSource,
			value: null,
			onChange: () => {},
			hasEntriesOnFocus: true
		});
		await vi.waitFor(() => {
			expect(busySpinnerIn(screen.container)).toBeNull();
		});

		settle([]);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(busySpinnerIn(screen.container)).toBeNull();
	});

	it('reopens on click when the input was already focused and the dropdown closed without a blur (#6845)', async () => {
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				hasEntriesOnFocus: true,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);
		await userEvent.click(input);
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'false');
		});
		expect(input).toHaveFocus();

		await userEvent.click(input);
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
	});

	it('does not double-fire an async bootstrap source on a single first click (#6848 review)', async () => {
		const bootstrap = vi.fn(async (): Promise<SearchableItem[]> => {
			await Promise.resolve();
			return fruits.slice(0, 3);
		});
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: { search: () => [], bootstrap },
				value: null,
				onChange: () => {},
				hasEntriesOnFocus: true,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);
		await userEvent.click(input);
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
		expect(bootstrap).toHaveBeenCalledTimes(1);
	});

	it('re-shows results on refocus when results already exist', async () => {
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				hasEntriesOnFocus: true,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		// Initial focus to load bootstrap results
		input.focus();
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		// Blur to close, then refocus
		input.blur();
		input.focus();

		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
	});
});

describe('BaseTypeahead minQueryLength', () => {
	it('does not search or open the menu below the threshold', async () => {
		const search = vi.fn((query: string) =>
			fruits.filter((fruit) => fruit.label.toLowerCase().includes(query.toLowerCase()))
		);
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: { search, bootstrap: () => [] },
				value: null,
				onChange: () => {},
				minQueryLength: 3,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		setQuery(input, 'Ap');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(search).not.toHaveBeenCalled();
		expect(input).toHaveAttribute('aria-expanded', 'false');

		// Positive control: the third character crosses the threshold, so the
		// same harness does see the search and the open menu.
		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
		expect(search).toHaveBeenCalledExactlyOnceWith('App');
	});

	it('closes the menu again when the query falls back below the threshold', async () => {
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				minQueryLength: 3,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		setQuery(input, 'Ap');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'false');
		});
	});

	it('does not fall back to bootstrap entries on ArrowDown below the threshold', async () => {
		const bootstrap = vi.fn(() => fruits.slice(0, 3));
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: { search: () => [], bootstrap },
				value: null,
				onChange: () => {},
				hasEntriesOnFocus: true,
				minQueryLength: 3,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		input.focus();
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
		bootstrap.mockClear();

		// Typing below the threshold closes the bootstrap menu...
		setQuery(input, 'Ap');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'false');
		});

		// ...and ArrowDown must not re-open it with entries that ignore the
		// two characters already typed.
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(bootstrap).not.toHaveBeenCalled();
		expect(input).toHaveAttribute('aria-expanded', 'false');
	});

	it('searches on the first character when minQueryLength is not set', async () => {
		const search = vi.fn(() => fruits.slice(0, 1));
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: { search, bootstrap: () => [] },
				value: null,
				onChange: () => {},
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		setQuery(input, 'A');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
		expect(search).toHaveBeenCalledExactlyOnceWith('A');
	});

	it('stops reporting "Loading" when the query falls below the threshold mid-search', async () => {
		let settle: (items: SearchableItem[]) => void = () => {};
		const search = vi.fn(
			async () =>
				new Promise<SearchableItem[]>((resolve) => {
					settle = resolve;
				})
		);
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: { search, bootstrap: () => [] },
				value: null,
				onChange: () => {},
				minQueryLength: 3,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(busySpinnerIn(screen.container)).not.toBeNull();
		});
		expect(input).toHaveAttribute('aria-busy', 'true');

		setQuery(input, 'Ap');
		settle(fruits.slice(0, 1));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(busySpinnerIn(screen.container)).toBeNull();
		expect(input).not.toHaveAttribute('aria-busy');
		expect(input).toHaveAttribute('aria-expanded', 'false');
	});
});

describe('BaseTypeahead hasSearched reset', () => {
	it('does not show "No results found" after selecting an item and re-entering', async () => {
		const onChange = vi.fn();
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange, debounceMs: 0 }
		});
		const input = comboboxIn(screen.container);

		// Type a query that returns results
		setQuery(input, 'Apple');
		await vi.waitFor(() => {
			expect(optionsIn(screen.container)).toHaveLength(1);
		});

		// Select the item
		optionNamed(screen.container, 'Apple').click();
		expect(onChange).toHaveBeenCalledWith(fruits[0]);

		// Re-render with the selected value
		await screen.rerender({ searchSource: fruitSource, value: fruits[0], onChange, debounceMs: 0 });

		// Focus the input again — "No results found" should NOT appear
		input.focus();

		// The empty state text should not be visible since hasSearched was reset
		expect(screen.container).not.toHaveTextContent('No results found');
	});

	it('resets hasSearched when query is cleared without hasEntriesOnFocus', async () => {
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
		});
		const input = comboboxIn(screen.container);

		// Type a query that returns no results
		setQuery(input, 'xyz');
		await vi.waitFor(() => {
			expect(screen.container).toHaveTextContent('No results found');
		});

		// Clear the query
		setQuery(input, '');

		// "No results found" should disappear since hasSearched is reset
		await vi.waitFor(() => {
			expect(screen.container).not.toHaveTextContent('No results found');
		});
	});

	it('resets hasSearched and does not announce "No results found" when search source is replaced during a pending search', async () => {
		let settle: (items: SearchableItem[]) => void = () => {};
		const initialSource: SearchSource = {
			search: vi.fn(
				async () =>
					new Promise<SearchableItem[]>((resolve) => {
						settle = resolve;
					})
			),
			bootstrap: () => []
		};
		const replacementSource: SearchSource = {
			search: vi.fn(async () => []),
			bootstrap: () => []
		};

		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: initialSource,
				value: null,
				onChange: () => {},
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		// Type a query that starts an asynchronous search
		setQuery(input, 'abc');
		expect(initialSource.search).toHaveBeenCalledWith('abc');

		// Replace the search source while the search is still pending
		await screen.rerender({
			searchSource: replacementSource,
			value: null,
			onChange: () => {},
			debounceMs: 0
		});

		// Settle the abandoned search
		settle([]);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(liveRegionText()).not.toContain('No results found');
		expect(screen.container).not.toHaveTextContent('No results found');
	});
});

describe('BaseTypeahead popover after selection', () => {
	it('does not show an empty popover after selecting an item with hasEntriesOnFocus', async () => {
		const onChange = vi.fn();
		const screen = await render(BaseTypeahead, {
			props: {
				searchSource: fruitSource,
				value: null,
				onChange,
				hasEntriesOnFocus: true,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		// Focus to open bootstrap results
		input.focus();
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		// Select an item — popover should close
		optionNamed(screen.container, 'Apple').click();
		expect(onChange).toHaveBeenCalledWith(fruits[0]);

		// After selection, input is refocused but popover should NOT reopen with an
		// empty menu. The focus handler should be suppressed.
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'false');
		});
	});
});

describe('Typeahead edit mode', () => {
	// iOS raises the software keyboard only for a focus made while the browser
	// still dispatches the person's tap, so the focus must not wait for a frame.
	it.each([
		['the token', (container: HTMLElement) => tokenLabelIn(container, fruits[0].label)],
		['the field around it', (container: HTMLElement) => tokenIn(container)]
	])('focuses the input with the label selected inside the tap on %s', async (_name, target) => {
		const onChangeQuery = vi.fn();
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: fruits[0],
				onChange: vi.fn(),
				onChangeQuery
			}
		});
		const input = comboboxIn(screen.container);
		// The event the browser is dispatching when focus() runs.
		const focusedDuring: (string | undefined)[] = [];
		const focus = HTMLElement.prototype.focus;
		Object.defineProperty(input, 'focus', {
			configurable: true,
			value(options?: FocusOptions) {
				focusedDuring.push(window.event?.type);
				focus.call(input, options);
			}
		});

		target(screen.container).click();

		// No frame has run: the focus, the text and its selection are all in
		// place by the time the tap's own dispatch returns.
		expect(input).toHaveFocus();
		expect(input.value).toBe(fruits[0].label);
		expect(input.selectionStart).toBe(0);
		expect(input.selectionEnd).toBe(fruits[0].label.length);
		expect(focusedDuring.length).toBeGreaterThan(0);
		expect(focusedDuring.every((type) => type === 'click')).toBe(true);
		expect(onChangeQuery).toHaveBeenLastCalledWith(fruits[0].label);
	});

	// The base sees the label as its query by the time the focus lands, so a
	// hasEntriesOnFocus field searches the label instead of opening its
	// bootstrap entries, and Enter cannot commit a bootstrap item.
	it('with hasEntriesOnFocus, editing the value searches its label instead of opening the bootstrap entries', async () => {
		const onChange = vi.fn();
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: fruits[3],
				onChange,
				hasEntriesOnFocus: true,
				debounceMs: 0
			}
		});
		const input = comboboxIn(screen.container);

		tokenLabelIn(screen.container, fruits[3].label).click();

		expect(input).toHaveFocus();
		expect(input.value).toBe(fruits[3].label);
		// Let any bootstrap or search settle (debounceMs is 0).
		await new Promise((resolve) => setTimeout(resolve, 20));

		// Apple is the first bootstrap entry, which the label does not match.
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(onChange).not.toHaveBeenCalledWith(fruits[0]);
	});

	it('enters edit mode on token container click', async () => {
		const onChange = vi.fn();
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange }
		});

		// Click the token to enter edit mode. Upstream reaches it with
		// `getByText(label).closest('div')`; the stable `astryx-token` class is the
		// same element by a name that cannot drift with the markup.
		(screen.container.querySelector('.astryx-token') as HTMLElement).click();

		// onChange should NOT have been called (value is preserved for restore)
		expect(onChange).not.toHaveBeenCalled();
	});

	it('empties the input when cleared while editing the selected value (#7038)', async () => {
		const onChangeQuery = vi.fn();
		const screen = await render(ControlledFixture, {
			props: {
				searchSource: fruitSource,
				initialValue: fruits[0],
				onChangeQuery
			}
		});
		const input = comboboxIn(screen.container);

		// Enter edit mode: the token gives way to the label as editable text
		tokenIn(screen.container).click();
		await vi.waitFor(() => expect(input.value).toBe(fruits[0].label));

		await userEvent.click(screen.getByRole('button', { name: 'Clear selection', exact: true }));

		// The value and the visible text agree: nothing selected, nothing typed
		await vi.waitFor(() => expect(input.value).toBe(''));
		expect(onChangeQuery).toHaveBeenLastCalledWith('');
		expect(input).toHaveFocus();
	});

	// Escape and blur restore the token but leave the edit-mode label in the
	// base's query, so a clear from the restored token faces the same stale text.
	it.each([
		[
			'Escape',
			(input: HTMLInputElement) =>
				input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		],
		['blur', (input: HTMLInputElement) => input.blur()]
	])(
		'empties the input when cleared after %s restored the token (#7038)',
		async (_name, leaveEditMode) => {
			const onChangeQuery = vi.fn();
			const screen = await render(ControlledFixture, {
				props: {
					searchSource: fruitSource,
					initialValue: fruits[0],
					onChangeQuery
				}
			});
			const input = comboboxIn(screen.container);

			tokenIn(screen.container).click();
			await vi.waitFor(() => expect(input.value).toBe(fruits[0].label));

			leaveEditMode(input);
			await vi.waitFor(() => {
				expect(
					screen.getByRole('button', { name: 'Clear selection', exact: true }).element()
				).toBeInTheDocument();
			});

			await userEvent.click(screen.getByRole('button', { name: 'Clear selection', exact: true }));

			await vi.waitFor(() => expect(input.value).toBe(''));
			expect(onChangeQuery).toHaveBeenLastCalledWith('');
		}
	);

	it('does not report a query change when cleared outside edit mode', async () => {
		const onChangeQuery = vi.fn();
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: fruits[0],
				onChange: vi.fn(),
				onChangeQuery,
				hasClear: true
			}
		});

		await userEvent.click(screen.getByRole('button', { name: 'Clear selection', exact: true }));

		expect(onChangeQuery).not.toHaveBeenCalled();
	});

	it('restores token on blur without action', async () => {
		const onChange = vi.fn();
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange }
		});
		const input = comboboxIn(screen.container);

		// Enter edit mode
		(screen.container.querySelector('.astryx-token') as HTMLElement).click();

		// Blur without selecting anything
		input.blur();

		// onChange should not have been called — value restored
		expect(onChange).not.toHaveBeenCalled();
	});

	// FR8: Escape with the list shown hides the list and edit mode stays; with
	// the list hidden it restores the Token and focuses its button, so focus
	// never falls to the page body.
	it('hides the list on the first Escape, then restores the Token and focuses its button', async () => {
		const screen = await render(ControlledFixture, {
			props: { searchSource: fruitSource, initialValue: fruits[0] }
		});
		const input = comboboxIn(screen.container);

		await userEvent.click(tokenLabelIn(screen.container, fruits[0].label));
		await vi.waitFor(() => {
			expect(input.value).toBe(fruits[0].label);
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});

		await userEvent.keyboard('{Escape}');
		expect(input).toHaveAttribute('aria-expanded', 'false');
		expect(input).toHaveFocus();
		expect(input).not.toHaveAttribute('tabindex', '-1');

		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => {
			expect(tokenButtonIn(screen.container, fruits[0].label)).toHaveFocus();
		});
		expect(input).toHaveAttribute('tabindex', '-1');
		expect(document.activeElement).not.toBe(document.body);
	});

	it('does not exit edit mode on a composing Escape (IME)', async () => {
		const onChange = vi.fn();
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange }
		});

		// Enter edit mode by clicking the token; the input uncollapses and
		// rejoins the Tab order (tabindex is cleared).
		tokenIn(screen.container).click();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		const input = comboboxIn(screen.container);
		expect(input).not.toHaveAttribute('tabindex', '-1');

		// BaseTypeahead invokes this external handler before its own IME guard, so
		// a composing Escape (isComposing / legacy keyCode 229) — which an IME uses
		// to cancel the pending candidate — must not exit edit mode here.
		input.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true })
		);
		expect(comboboxIn(screen.container)).not.toHaveAttribute('tabindex', '-1');
		input.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', keyCode: 229, bubbles: true })
		);
		expect(comboboxIn(screen.container)).not.toHaveAttribute('tabindex', '-1');

		// A real, non-composing Escape still exits edit mode: the token is
		// restored and the collapsed input drops back out of the Tab order.
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await vi.waitFor(() => {
			expect(comboboxIn(screen.container)).toHaveAttribute('tabindex', '-1');
		});
	});
});

describe('Typeahead Backspace and Delete on the token', () => {
	it.each(['Backspace', 'Delete'])(
		'%s on the token clears the value as the clear button does, announces it, and focuses the empty input',
		async (key) => {
			const onChange = vi.fn();
			const screen = await render(Typeahead, {
				props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange }
			});
			const button = tokenButtonIn(screen.container, fruits[0].label);
			button.focus();
			button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
			expect(onChange).toHaveBeenCalledTimes(1);
			expect(onChange).toHaveBeenCalledWith(null);
			const input = comboboxIn(screen.container);
			expect(input).toHaveFocus();
			expect(input.value).toBe('');
			await vi.waitFor(() => {
				expect(liveRegionText()).toBe(`Cleared ${fruits[0].label}`);
			});
		}
	);

	it('Backspace on the token starts editing when there is no clear button', async () => {
		const onChange = vi.fn();
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: fruits[0],
				onChange,
				hasClear: false
			}
		});
		const button = tokenButtonIn(screen.container, fruits[0].label);
		button.focus();
		button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
		expect(onChange).not.toHaveBeenCalled();
		const input = comboboxIn(screen.container);
		expect(input).toHaveFocus();
		expect(input.value).toBe(fruits[0].label);
	});

	it('other keys and a disabled field leave the value alone', async () => {
		const onChange = vi.fn();
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange }
		});
		tokenButtonIn(screen.container, fruits[0].label).dispatchEvent(
			new KeyboardEvent('keydown', { key: 'a', bubbles: true })
		);
		await screen.rerender({
			label: 'Fruit',
			searchSource: fruitSource,
			value: fruits[0],
			onChange,
			isDisabled: true
		});
		tokenButtonIn(screen.container, fruits[0].label).dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })
		);
		expect(onChange).not.toHaveBeenCalled();
	});
});
describe('Typeahead collapsed input tab order', () => {
	it('removes the invisible input from the Tab order while a token is shown', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		// While the token is shown the input is collapsed (width 0 / opacity 0); it
		// must stay programmatically focusable for token interactions but must not
		// be an invisible Tab stop (WCAG 2.4.3 / 2.4.7).
		expect(comboboxIn(screen.container)).toHaveAttribute('tabindex', '-1');
	});

	it('Tab from the token skips the invisible input', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		// Focus the token's internal button, then Tab away — focus must not land on
		// the visually hidden combobox input.
		screen.getByRole('button', { name: fruits[0].label, exact: true }).element().focus();
		await userEvent.tab();
		expect(comboboxIn(screen.container)).not.toHaveFocus();
	});

	it('keeps the input in the Tab order when no token is shown', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: null, onChange: () => {} }
		});
		expect(comboboxIn(screen.container)).not.toHaveAttribute('tabindex');
	});

	it('restores the input to the Tab order in edit mode', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		// Entering edit mode removes the token and uncollapses the input. Upstream
		// reaches the token with `getByText(label).closest('div')`; the stable
		// `astryx-token` class is the same element, as in `Typeahead edit mode`.
		(screen.container.querySelector('.astryx-token') as HTMLElement).click();

		await vi.waitFor(() => {
			expect(comboboxIn(screen.container)).not.toHaveAttribute('tabindex');
		});
	});
});

describe('BaseTypeahead paste behavior', () => {
	it('pasting text triggers search results like typing', async () => {
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
		});

		// RESTATED: vitest-browser's driver has no `paste`; `fill` sets the value in
		// a single input event, which is what a paste produces.
		await userEvent.fill(comboboxIn(screen.container), 'App');

		await vi.waitFor(() => {
			expect(screen.container).toHaveTextContent('Apple');
		});
	});

	it('pasting non-matching text shows no results', async () => {
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
		});

		// RESTATED as above.
		await userEvent.fill(comboboxIn(screen.container), 'xyz');

		await vi.waitFor(() => {
			expect(screen.container).toHaveTextContent('No results found');
		});
	});

	it('scrolls the highlighted option into view during arrow navigation', async () => {
		const scrollIntoView = vi.fn();
		const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
		Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
			configurable: true,
			value: scrollIntoView
		});
		try {
			const screen = await render(BaseTypeahead, {
				props: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
			});

			const input = comboboxIn(screen.container);
			// RESTATED as above — `fill` in place of `paste`.
			await userEvent.fill(input, 'e'); // matches multiple fruits, opens listbox
			await vi.waitFor(() => {
				expect(input).toHaveAttribute('aria-expanded', 'true');
			});

			scrollIntoView.mockClear();
			await userEvent.keyboard('{ArrowDown}');
			await userEvent.keyboard('{ArrowDown}');

			await vi.waitFor(() => {
				expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
			});
		} finally {
			if (original) {
				Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original);
			}
		}
	});

	it('highlights on hover without scrolling, keyboard still scrolls (#6077)', async () => {
		// Hover must highlight only: scrollIntoView under a stationary pointer
		// moves the next option under it, re-highlighting and scrolling again —
		// a runaway auto-scroll loop with no user input.
		const scrollIntoView = vi.fn();
		const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
		Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
			configurable: true,
			value: scrollIntoView
		});
		try {
			const screen = await render(BaseTypeahead, {
				props: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
			});
			const input = comboboxIn(screen.container);
			// RESTATED: `fill` in place of upstream's `paste`.
			await userEvent.fill(input, 'e');
			await vi.waitFor(() => {
				expect(input).toHaveAttribute('aria-expanded', 'true');
			});

			scrollIntoView.mockClear();
			const options = optionsIn(screen.container);
			options[1].dispatchEvent(
				new PointerEvent('pointermove', { bubbles: true, screenX: 156, screenY: 156 })
			);
			options[1].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

			await vi.waitFor(() => {
				expect(input.getAttribute('aria-activedescendant')).toBe(options[1].id);
			});
			expect(scrollIntoView).not.toHaveBeenCalled();

			await userEvent.keyboard('{ArrowDown}');
			expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
		} finally {
			if (original) {
				Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original);
			}
		}
	});
});

describe('BaseTypeahead highlight under a resting pointer', () => {
	it('keeps the keyboard highlight when an option appears under the pointer, and follows pointer movement', async () => {
		// A menu that opens or reflows under a pointer the user is not moving
		// fires mouseenter on the option that lands beneath it. Taking the
		// highlight from that would make Enter pick an option the user never
		// pointed at; only real pointer movement moves the highlight.
		const screen = await render(BaseTypeahead, {
			props: { searchSource: fruitSource, value: null, onChange: () => {}, debounceMs: 0 }
		});
		const input = comboboxIn(screen.container);
		// RESTATED: `fill` in place of upstream's `paste`.
		await userEvent.fill(input, 'e');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-expanded', 'true');
		});
		const options = optionsIn(screen.container);
		expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);

		options[2].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
		options[2].dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, screenX: 163, screenY: 163 })
		);
		expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);

		options[2].dispatchEvent(
			new PointerEvent('pointermove', { bubbles: true, screenX: 170, screenY: 170 })
		);
		options[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
		await vi.waitFor(() => {
			expect(input.getAttribute('aria-activedescendant')).toBe(options[2].id);
		});
	});
});

describe('Typeahead disabledMessage', () => {
	it('shows the reason tooltip on hover when disabled with a reason', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Assignee',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				isDisabled: true,
				disabledMessage: 'You need the Editor role'
			}
		});

		// The field itself, by its own class: the input no longer sits directly
		// inside it — it is in the content lane that bounds the value — and
		// `mouseenter` does not bubble, so the hover has to land on the element
		// the tooltip is actually bound to.
		const container = screen.container.querySelector('.astryx-typeahead') as HTMLElement;
		const tooltip = tooltipIn(screen.container);
		expect(tooltip).toHaveTextContent('You need the Editor role');

		container.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
		await vi.waitFor(() => {
			expect(tooltip.matches(':popover-open')).toBe(true);
		});

		container.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
		await vi.waitFor(() => {
			expect(tooltip.matches(':popover-open')).toBe(false);
		});
	});

	it('shows the reason tooltip on keyboard focus', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Assignee',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				isDisabled: true,
				disabledMessage: 'You need the Editor role'
			}
		});

		const tooltip = tooltipIn(screen.container);
		await userEvent.tab();
		expect(comboboxIn(screen.container)).toHaveFocus();
		await vi.waitFor(() => {
			expect(tooltip.matches(':popover-open')).toBe(true);
		});
	});

	it('does not render a tooltip when not disabled', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Assignee',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				disabledMessage: 'You need the Editor role'
			}
		});
		expect(screen.container.querySelector('[role="tooltip"]')).not.toBeInTheDocument();
	});

	it('does not render a tooltip when disabled without a reason', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Assignee',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				isDisabled: true
			}
		});
		expect(screen.container.querySelector('[role="tooltip"]')).not.toBeInTheDocument();
	});

	it('keeps the input focusable via aria-disabled when a reason is provided', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Assignee',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				isDisabled: true,
				disabledMessage: 'You need the Editor role'
			}
		});
		const input = comboboxIn(screen.container);
		// RESTATED: native-attribute assertion — vitest-browser's `toBeDisabled` is
		// Playwright's ARIA computation, which counts `aria-disabled`.
		expect(input).not.toHaveAttribute('disabled');
		expect(input).toHaveAttribute('aria-disabled', 'true');
		expect(input).toHaveAttribute('readonly');
	});

	it('links the reason tooltip from the input via aria-describedby', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Assignee',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				isDisabled: true,
				disabledMessage: 'You need the Editor role'
			}
		});
		const input = comboboxIn(screen.container);
		const tooltip = tooltipIn(screen.container);
		expect(input.getAttribute('aria-describedby')).toContain(tooltip.id);
	});

	it('blocks typing and selection while focusable-disabled', async () => {
		const onChange = vi.fn();
		const screen = await render(Typeahead, {
			props: {
				label: 'Assignee',
				searchSource: fruitSource,
				value: null,
				onChange,
				isDisabled: true,
				disabledMessage: 'You need the Editor role'
			}
		});

		const input = comboboxIn(screen.container);
		// RESTATED: the input is `readonly`, and Playwright refuses to `fill`/`type`
		// into a non-editable element. Focusing and pressing keys is the same user
		// action without the driver's editability precondition — and it is the
		// browser's own readonly handling that must swallow the text, which is what
		// the case is about.
		input.focus();
		await userEvent.keyboard('App');
		expect(input).toHaveValue('');
		expect(input).toHaveAttribute('aria-expanded', 'false');
		expect(onChange).not.toHaveBeenCalled();
	});

	it('opens no list and picks nothing while focusable-disabled (spec:AST-085 FR2)', async () => {
		const onChange = vi.fn();
		const screen = await render(Typeahead, {
			props: {
				label: 'Assignee',
				searchSource: fruitSource,
				value: null,
				onChange,
				hasEntriesOnFocus: true,
				isDisabled: true,
				disabledMessage: 'You need the Editor role'
			}
		});
		const input = comboboxIn(screen.container);
		// RESTATED: Playwright refuses to click an element it computes as
		// disabled (it counts `aria-disabled`), while the browser itself still
		// dispatches the click to the readonly input. Focus plus a DOM click is
		// the same user action without the driver's precondition.
		input.focus();
		input.click();
		input.click();
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(input).toHaveAttribute('aria-expanded', 'false');
		expect(optionsIn(screen.container)).toHaveLength(0);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('does not reopen on a click into the still-focused input once disabled', async () => {
		const field = (isDisabled: boolean) => ({
			label: 'Assignee',
			searchSource: fruitSource,
			value: null,
			onChange: () => {},
			hasEntriesOnFocus: true,
			isDisabled,
			disabledMessage: isDisabled ? 'You need the Editor role' : undefined
		});
		const screen = await render(Typeahead, { props: field(false) });
		const input = comboboxIn(screen.container);
		await userEvent.click(input);
		await vi.waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
		// A pick closes the list and leaves focus in the input.
		await userEvent.click(optionsIn(screen.container)[0]);
		await vi.waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'false'));
		await screen.rerender(field(true));
		const disabled = comboboxIn(screen.container);
		// RESTATED: Playwright will not click an `aria-disabled` element; a DOM
		// click is the browser's own dispatch to the readonly input.
		disabled.focus();
		disabled.click();
		disabled.click();
		expect(disabled).toHaveAttribute('aria-expanded', 'false');
	});

	it('picks nothing from a list opened before the field became disabled, and lets it close', async () => {
		const onChange = vi.fn();
		const onSubmit = vi.fn();
		const screen = await render(FormFixture, {
			props: { searchSource: fruitSource, onChange, onSubmit }
		});
		const input = comboboxIn(screen.container);
		await userEvent.click(input);
		await vi.waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
		await userEvent.keyboard('{ArrowDown}');

		await screen.rerender({
			searchSource: fruitSource,
			onChange,
			onSubmit,
			isDisabled: true,
			// No reason: the tooltip adds a top-layer reveal this case does not
			// exercise, and the list dismissal is the subject.
			disabledMessage: ''
		});
		// Let the disabled-reason tooltip's focus reveal settle before the keys.
		await new Promise((resolve) => setTimeout(resolve, 50));
		// The open list stays in the DOM (hidden from the accessibility tree).
		await userEvent.keyboard('{Enter}');
		await userEvent.click(optionsIn(screen.container)[0]);
		expect(onChange).not.toHaveBeenCalled();
		// Enter on the still-open list does not submit the form.
		expect(onSubmit).not.toHaveBeenCalled();
		await userEvent.keyboard('{Escape}');
		expect(input).toHaveAttribute('aria-expanded', 'false');
	});

	it('does not open a list for a search that settles after the field became disabled', async () => {
		let resolveSearch: (items: SearchableItem[]) => void = () => {};
		const pendingSource: SearchSource = {
			search: async () =>
				new Promise((resolve) => {
					resolveSearch = resolve;
				}),
			bootstrap: () => []
		};
		const field = (isDisabled: boolean) => ({
			label: 'Assignee',
			searchSource: pendingSource,
			value: null,
			onChange: () => {},
			debounceMs: 0,
			isDisabled,
			disabledMessage: isDisabled ? 'You need the Editor role' : undefined
		});
		const screen = await render(Typeahead, { props: field(false) });
		const input = comboboxIn(screen.container);
		input.focus();
		await userEvent.keyboard('ap');
		await screen.rerender(field(true));
		resolveSearch(fruits);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(comboboxIn(screen.container)).toHaveAttribute('aria-expanded', 'false');
	});

	it('keeps its tab stop when disabled without a reason', async () => {
		const onChange = vi.fn();
		const screen = await render(DisabledTabFixture, {
			props: { searchSource: fruitSource, onChange }
		});
		const input = comboboxIn(screen.container);
		// RESTATED: vitest-browser's `toBeDisabled` is Playwright's ARIA
		// computation, which counts `aria-disabled`; the upstream claim is that
		// the native attribute is absent.
		expect(input).not.toHaveAttribute('disabled');
		expect(input).toHaveAttribute('aria-disabled', 'true');
		expect(input).toHaveAttribute('readonly');

		screen.getByRole('button', { name: 'Before', exact: true }).element().focus();
		await userEvent.tab();
		expect(input).toHaveFocus();
		await userEvent.keyboard('Apple{Enter}');
		expect(input).toHaveValue('');
		expect(input).toHaveAttribute('aria-expanded', 'false');
		expect(onChange).not.toHaveBeenCalled();
	});

	it('drops a search answer that arrives after the field became disabled', async () => {
		let settle: (items: SearchableItem[]) => void = () => {};
		const searchSource: SearchSource = {
			search: async () =>
				new Promise<SearchableItem[]>((resolve) => {
					settle = resolve;
				}),
			bootstrap: () => []
		};
		const props = {
			label: 'Assignee',
			searchSource,
			value: null,
			onChange: () => {},
			debounceMs: 0
		};
		const screen = await render(Typeahead, { props });
		const input = comboboxIn(screen.container);
		setQuery(input, 'Ap');
		await vi.waitFor(() => {
			expect(busySpinnerIn(screen.container)).not.toBeNull();
		});

		await screen.rerender({ ...props, isDisabled: true });
		expect(busySpinnerIn(screen.container)).toBeNull();
		settle(fruits.slice(0, 1));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(input).toHaveAttribute('aria-expanded', 'false');
		expect(liveRegionText()).toBe('');
		// The dropped query has no outcome: no empty state either.
		expect(screen.container).not.toHaveTextContent('No results found');
	});
});

describe('busy indicator ownership', () => {
	/** A source that stays in flight until the test settles it. */
	function pendingSource() {
		let settle: (items: SearchableItem[]) => void = () => {};
		return {
			source: {
				search: async () =>
					new Promise<SearchableItem[]>((resolve) => {
						settle = resolve;
					}),
				bootstrap: () => []
			} satisfies SearchSource,
			settle: (items: SearchableItem[] = []) => settle(items)
		};
	}

	it('renders its own indicator for a direct caller', async () => {
		const { source, settle } = pendingSource();
		const screen = await render(BaseTypeahead, {
			props: { searchSource: source, value: null, onChange: () => {}, debounceMs: 0 }
		});
		const input = comboboxIn(screen.container);

		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(busySpinnerIn(screen.container)).not.toBeNull();
		});
		// A Spinner, not the static clock glyph this used to render.
		expect(busySpinnerIn(screen.container)?.querySelector('svg')).toBeInTheDocument();

		settle();
		await vi.waitFor(() => {
			expect(busySpinnerIn(screen.container)).toBeNull();
		});
	});

	it('hands the indicator over to a field that takes it, and renders none itself', async () => {
		const { source, settle } = pendingSource();
		const onLoadingChange = vi.fn();
		const screen = await render(LaneFixture, {
			props: { searchSource: source, onBusyChange: onLoadingChange }
		});
		const input = comboboxIn(screen.container);

		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(input).toHaveAttribute('aria-busy', 'true');
		});
		expect(busySpinnerIn(screen.container)).toBeNull();
		expect(onLoadingChange).toHaveBeenLastCalledWith(true);

		settle();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(onLoadingChange).toHaveBeenLastCalledWith(false);
	});

	it('keeps the busy handoff out of the exported prop surface', async () => {
		// The handoff travels through a context, so nothing named for it may
		// reach the barrel or the base's props.
		expect(Object.keys(core)).not.toContain('BusyIndicatorLaneProvider');
		expect(Object.keys(core)).not.toContain('useBusyIndicatorLane');
		expect(baseTypeaheadSource).not.toContain('__onLoadingChange');
	});

	it('reports each transition once, and reports nothing when nothing changed', async () => {
		// Edge-triggered on purpose. Every keystroke below the query threshold
		// clears the flag, and an unconditional report would hand the wrapper a
		// `false` per character — each one a state write on a field that is
		// re-rendering as the user types.
		const { source, settle } = pendingSource();
		const onLoadingChange = vi.fn();
		const screen = await render(LaneFixture, {
			props: { searchSource: source, minQueryLength: 3, onBusyChange: onLoadingChange }
		});
		const input = comboboxIn(screen.container);

		// Below the threshold: no search, so nothing to report.
		setQuery(input, 'A');
		setQuery(input, 'Ap');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(onLoadingChange).not.toHaveBeenCalled();

		setQuery(input, 'App');
		await vi.waitFor(() => {
			expect(onLoadingChange).toHaveBeenCalledTimes(1);
		});
		expect(onLoadingChange).toHaveBeenCalledWith(true);

		// Back below the threshold: one report out, not one per keystroke.
		setQuery(input, 'Ap');
		setQuery(input, 'A');
		setQuery(input, '');
		settle();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(onLoadingChange).toHaveBeenCalledTimes(2);
		expect(onLoadingChange).toHaveBeenLastCalledWith(false);
	});
});

describe('Typeahead statusVariant forwarding', () => {
	it('defaults to attached (status renders with data-variant="attached")', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				status: { type: 'error', message: 'Required' }
			}
		});
		expect(screen.container.querySelector('.astryx-field-status')).toHaveAttribute(
			'data-variant',
			'attached'
		);
	});

	it('forwards statusVariant="detached" to the underlying Field status', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				status: { type: 'error', message: 'Required' },
				statusVariant: 'detached'
			}
		});
		expect(screen.container.querySelector('.astryx-field-status')).toHaveAttribute(
			'data-variant',
			'detached'
		);
	});
});

describe('end controls stay in flow', () => {
	// The fix for the transform bug, expressed as a rule rather than a
	// measurement: these controls are ordinary flex siblings of the input, so
	// they take up room and nothing has to reserve it for them. Chrome resolves
	// layout here, so the mechanism is asserted instead of the geometry.
	it('renders the clear button without taking it out of flow', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		const field = screen.container.querySelector('.astryx-typeahead');
		const clear = screen.getByRole('button', { name: 'Clear selection', exact: true }).element();
		expect(field).toContainElement(clear);
		// The controls sit in a lane that is itself an ordinary in-flow child of
		// the field — not a box positioned over it.
		const lane = clear.parentElement as HTMLElement;
		expect(lane.parentElement).toBe(field);
		expect(getComputedStyle(lane).position).not.toBe('absolute');
	});

	it('never reserves room with a measured width', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		expect(screen.container.querySelector('[style*="--_tokenizer-end-lane-width"]')).toBeNull();
	});

	it('holds the controls at the inline end when a token shows', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		const clear = screen.getByRole('button', { name: 'Clear selection', exact: true }).element();
		const lane = clear.parentElement as HTMLElement;
		// RESTATED: Chrome resolves `auto` to the used margin, so the declared
		// value is read from the rule that applies to the lane.
		expect(declaredStyleFor(lane, 'margin-inline-start')).toBe('auto');
	});

	it('keeps the field on one row so the controls cannot be pushed off it', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		const field = screen.container.querySelector('.astryx-typeahead') as HTMLElement;
		expect(getComputedStyle(field).flexWrap).not.toBe('wrap');
	});

	it('keeps the input in flow while a token shows, so the field keeps its width', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		const input = comboboxIn(screen.container);
		const style = getComputedStyle(input);
		expect(style.position).not.toBe('absolute');
		expect(style.width).not.toBe('0px');
		expect(style.flex).not.toBe('0 0 0');
	});

	it('paints the token over the input rather than beside it', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		const token = screen.container.querySelector('.astryx-token') as HTMLElement;
		expect(getComputedStyle(token).position).toBe('absolute');
	});

	it('lets the token take the pointer that the hidden input would swallow', async () => {
		const screen = await render(Typeahead, {
			props: { label: 'Fruit', searchSource: fruitSource, value: fruits[0], onChange: () => {} }
		});
		expect(getComputedStyle(comboboxIn(screen.container)).pointerEvents).toBe('none');
	});
});

describe('the value is bounded by the content lane', () => {
	const renderWithValue = () =>
		render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: fruits[0],
				onChange: () => {},
				hasClear: true
			}
		});

	it('puts the input and the token in one lane, inside the field', async () => {
		const screen = await renderWithValue();
		const field = screen.container.querySelector('.astryx-typeahead');
		const input = comboboxIn(screen.container);
		const token = screen.container.querySelector('.astryx-token') as HTMLElement;

		const lane = input.parentElement as HTMLElement;
		expect(lane).not.toBe(field);
		expect(lane.parentElement).toBe(field);
		// The token's containing block is the lane, which is what bounds it.
		expect(token.parentElement).toBe(lane);
		expect(getComputedStyle(lane).position).toBe('relative');
	});

	it('lets the lane yield its whole width, so a narrow field cannot overflow', async () => {
		const screen = await renderWithValue();
		const lane = comboboxIn(screen.container).parentElement as HTMLElement;
		const style = getComputedStyle(lane);
		// RESTATED: Chrome reports unitless zero as `0px`.
		expect(parseFloat(style.minWidth)).toBe(0);
		expect(style.flexGrow).toBe('1');
		// Nothing states a width: a narrow parent gets all of it back.
		expect(
			(screen.container.querySelector('.astryx-typeahead') as HTMLElement).style.minWidth
		).toBe('');
	});

	it("anchors the token at the lane's end, not just its start", async () => {
		const screen = await renderWithValue();
		const token = screen.container.querySelector('.astryx-token') as HTMLElement;
		const style = getComputedStyle(token);
		// RESTATED: Chrome reports unitless zero as `0px`.
		expect(parseFloat(style.insetInlineEnd)).toBe(0);
		// RESTATED: Chrome resolves `fit-content` and `auto` to used values, so
		// the declared pair is read from the rule that applies to the token.
		expect(declaredStyleFor(token, 'width')).toBe('fit-content');
		expect(declaredStyleFor(token, 'margin-inline-end')).toBe('auto');
	});
});

describe('Typeahead consumer key handler order', () => {
	it('runs onKeyDown on the input after built-in key handling, so it cannot cancel navigation', async () => {
		let currentTarget: EventTarget | null = null;
		const onKeyDown = vi.fn((event: KeyboardEvent) => {
			currentTarget = event.currentTarget;
			event.preventDefault();
		});
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				debounceMs: 0,
				hasEntriesOnFocus: true,
				onKeyDown
			}
		});
		const input = comboboxIn(screen.container);
		input.focus();
		await vi.waitFor(() => {
			expect(optionsIn(screen.container).length).toBeGreaterThan(0);
		});
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		expect(onKeyDown).toHaveBeenCalledOnce();
		expect(currentTarget).toBe(input);
		expect(input).toHaveAttribute('aria-activedescendant');
	});
});

describe('Typeahead consumer key handler target', () => {
	it('still runs onKeyDown for keys on the clear button', async () => {
		const onKeyDown = vi.fn();
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: fruits[0],
				onChange: () => {},
				onKeyDown
			}
		});
		screen
			.getByRole('button', { name: 'Clear selection', exact: true })
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(onKeyDown).toHaveBeenCalledOnce();
	});

	it('runs onKeyDown once for a key on the input', async () => {
		const onKeyDown = vi.fn();
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				onKeyDown
			}
		});
		comboboxIn(screen.container).dispatchEvent(
			new KeyboardEvent('keydown', { key: 'a', bubbles: true })
		);
		expect(onKeyDown).toHaveBeenCalledOnce();
	});
});

describe('Typeahead caller aria-labelledby', () => {
	it('names the input by its label and a caller aria-labelledby', async () => {
		const screen = await render(Typeahead, {
			props: {
				label: 'Fruit',
				searchSource: fruitSource,
				value: null,
				onChange: () => {},
				'aria-labelledby': 'billing-heading'
			}
		});
		const heading = document.createElement('span');
		heading.id = 'billing-heading';
		heading.textContent = 'Billing';
		screen.container.prepend(heading);
		await expect
			.element(screen.getByRole('combobox', { name: 'Fruit Billing', exact: true }))
			.toBeInTheDocument();
	});

	it('names a grouped input by the group, its label, and a caller aria-labelledby', async () => {
		const screen = await render(InputGroupFixture, { props: { searchSource: fruitSource } });
		await expect
			.element(screen.getByRole('combobox', { name: 'Contact Fruit Billing', exact: true }))
			.toBeInTheDocument();
	});
});
