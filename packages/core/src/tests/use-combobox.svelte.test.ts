/** PORTS: Selector/useCombobox.test.tsx */

// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file use-combobox.test.ts
 * @input Uses vitest, the browser, useCombobox and the layer dismissal stack
 * @output Unit tests for useCombobox over a single-line field the caller renders
 * @position Tests; validates the field props, keys and pointer model of
 *   hooks.ts against spec:AST-075 FR1–FR6
 *
 * SYNC: When useCombobox's field props or keys change, update these tests.
 *
 * Astryx's `Selector/useCombobox.test.tsx`, ported declaration for declaration
 * under upstream's names, except the accessibility-pattern `it.each` named
 * below. Runs in the **client (real Chromium)** project, because the keyboard
 * and pointer model needs real focus and hover.
 *
 * ## The one dropped declaration
 *
 * `input, list shown: $open` — the two-row `it.each` under
 * `useCombobox field props — the reusable Combobox contract`. It drives
 * `expectAccessibilitySpec` from the `@astryxdesign/a11y-spec` package, which
 * this repository does not depend on. The pattern coverage it would add is
 * worth adding once that package is available; nothing else in the file uses
 * it.
 *
 * ## Translations
 *
 * - Upstream's `Picker`, `Trigger` and `Layer` become
 *   `combobox-field-fixture.svelte`, `combobox-trigger-fixture.svelte` and
 *   `combobox-layer-fixture.svelte`: each wraps content, which is a snippet
 *   here and cannot be authored in a `render()` props object. `useRef` becomes
 *   `bind:this`.
 * - `fireEvent.keyDown` / `fireEvent.mouseDown` become real dispatched events
 *   (the `use-layer-dismissal` precedent), returning `!defaultPrevented` — the
 *   same boolean Testing Library's `fireEvent` returns.
 * - Playwright's locators match `name` as a substring, so every string name
 *   passes `exact: true`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { resetLayerStackForTests } from '$lib/components/layer/layer-stack.js';
import Picker from './fixtures/combobox-field-fixture.svelte';
import Trigger from './fixtures/combobox-trigger-fixture.svelte';
import Layer from './fixtures/combobox-layer-fixture.svelte';

afterEach(() => {
	resetLayerStackForTests();
});

function keyDown(target: Element, init: KeyboardEventInit & { keyCode?: number }): boolean {
	const event = new KeyboardEvent('keydown', {
		bubbles: true,
		cancelable: true,
		...init
	});
	if (init.keyCode != null) {
		Object.defineProperty(event, 'keyCode', { value: init.keyCode });
	}
	target.dispatchEvent(event);
	return !event.defaultPrevented;
}

function mouseDown(target: Element): boolean {
	const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return !event.defaultPrevented;
}

describe('useCombobox field props — roles and state (FR1–FR3)', () => {
	it('a hidden list leaves the field collapsed with nothing to reference', async () => {
		const screen = await render(Picker, { props: { isInitiallyOpen: false } });
		const box = screen.getByRole('combobox', { exact: true }).element();
		expect(box).toHaveAttribute('role', 'combobox');
		expect(box).toHaveAttribute('aria-autocomplete', 'list');
		expect(box).toHaveAttribute('aria-expanded', 'false');
		expect(box).not.toHaveAttribute('aria-controls');
		expect(box).not.toHaveAttribute('aria-activedescendant');
	});

	it('a shown list expands the field and names the listbox', async () => {
		const screen = await render(Picker);
		const box = screen.getByRole('combobox', { exact: true }).element();
		const listbox = screen.getByRole('listbox', { name: 'People', exact: true }).element();
		expect(box).toHaveAttribute('aria-expanded', 'true');
		expect(box).toHaveAttribute('aria-controls', listbox.id);
		expect(screen.getByRole('option').elements()).toHaveLength(3);
		// No option is active until the person moves to one.
		expect(box).not.toHaveAttribute('aria-activedescendant');
	});

	it('an open list with no options renders no listbox, so the field stays collapsed', async () => {
		const screen = await render(Picker, { props: { options: [] } });
		const box = screen.getByRole('combobox', { exact: true }).element();
		expect(screen.getByRole('listbox').query()).toBeNull();
		expect(box).toHaveAttribute('aria-expanded', 'false');
		expect(box).not.toHaveAttribute('aria-controls');
	});

	it('moving the active option keeps focus in the field and names it (FR1)', async () => {
		const screen = await render(Picker);
		const box = screen.getByRole('combobox', { exact: true }).element();
		await userEvent.click(screen.getByRole('combobox', { exact: true }));

		await userEvent.keyboard('{ArrowDown}');
		expect(box).toHaveFocus();
		expect(box).toHaveAttribute('aria-activedescendant', option('Ada').element().id);
		expect(option('Ada').element()).toHaveAttribute('aria-selected', 'true');
		expect(option('Cy').element()).toHaveAttribute('aria-selected', 'false');

		// The disabled option is skipped, and the arrows wrap at either end.
		await userEvent.keyboard('{ArrowDown}');
		expect(box).toHaveAttribute('aria-activedescendant', option('Cy').element().id);
		await userEvent.keyboard('{ArrowDown}');
		expect(box).toHaveAttribute('aria-activedescendant', option('Ada').element().id);
		await userEvent.keyboard('{ArrowUp}');
		expect(box).toHaveAttribute('aria-activedescendant', option('Cy').element().id);
		expect(box).toHaveFocus();
		expect(option('Bea').element()).toHaveAttribute('aria-disabled', 'true');

		function option(name: string) {
			return screen.getByRole('option', { name, exact: true });
		}
	});

	it('ArrowUp with nothing active starts at the last option', async () => {
		const screen = await render(Picker);
		const box = screen.getByRole('combobox', { exact: true }).element();
		await userEvent.click(screen.getByRole('combobox', { exact: true }));
		await userEvent.keyboard('{ArrowUp}');
		expect(box).toHaveAttribute(
			'aria-activedescendant',
			screen.getByRole('option', { name: 'Cy', exact: true }).element().id
		);
	});
});

describe('useCombobox field props — keys (FR4)', () => {
	it('Enter picks only an active option, and only then stops the field’s own Enter', async () => {
		const onSelect = vi.fn();
		const onFieldKeyDown = vi.fn();
		const screen = await render(Picker, { props: { onSelect, onFieldKeyDown } });
		const box = screen.getByRole('combobox', { exact: true });
		await userEvent.click(box);

		// Nothing active: Enter is the field's own, such as a submit.
		expect(keyDown(box.element(), { key: 'Enter' })).toBe(true);
		expect(onSelect).not.toHaveBeenCalled();
		expect(onFieldKeyDown).toHaveBeenCalledTimes(1);

		await userEvent.keyboard('{ArrowDown}');
		expect(keyDown(box.element(), { key: 'Enter' })).toBe(false);
		expect(onSelect).toHaveBeenCalledWith('ada');
		// The arrow and the pick never reached the field's handler.
		expect(onFieldKeyDown).toHaveBeenCalledTimes(1);
		// Picking hides the list; focus never left the field.
		await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
		expect(box.element()).toHaveFocus();
	});

	it('Escape hides the list without dismissing the enclosing layer on the same press', async () => {
		const onDismiss = vi.fn();
		const screen = await render(Layer, { props: { onDismiss } });
		await userEvent.click(screen.getByRole('combobox', { exact: true }));

		await userEvent.keyboard('{Escape}');
		expect(screen.getByRole('listbox').query()).toBeNull();
		expect(onDismiss).not.toHaveBeenCalled();

		// With the list hidden, Escape belongs to the layer again.
		await userEvent.keyboard('{Escape}');
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('Escape also hides an open list that has no options', async () => {
		const onClose = vi.fn();
		const screen = await render(Picker, { props: { options: [], onClose } });
		expect(
			keyDown(screen.getByRole('combobox', { exact: true }).element(), { key: 'Escape' })
		).toBe(false);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it.each(['shiftKey', 'ctrlKey', 'altKey', 'metaKey'] as const)(
		'Escape held with %s still hides the list first and leaves the enclosing layer open',
		async (modifier) => {
			const onDismiss = vi.fn();
			const screen = await render(Layer, { props: { onDismiss } });
			const box = screen.getByRole('combobox', { exact: true }).element();
			box.focus();
			expect(keyDown(box, { key: 'Escape', [modifier]: true })).toBe(false);
			await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
			expect(onDismiss).not.toHaveBeenCalled();

			// With the list hidden, the same chord belongs to the layer again.
			keyDown(box, { key: 'Escape', [modifier]: true });
			expect(onDismiss).toHaveBeenCalledTimes(1);
		}
	);

	it('ArrowDown shows a hidden list in a single-line field', async () => {
		const screen = await render(Picker, { props: { isInitiallyOpen: false } });
		const box = screen.getByRole('combobox', { exact: true });
		await userEvent.click(box);
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(screen.getByRole('listbox')).toBeInTheDocument();
		expect(box.element()).toHaveAttribute('aria-expanded', 'true');
		expect(box.element()).toHaveAttribute(
			'aria-activedescendant',
			screen.getByRole('option', { name: 'Ada', exact: true }).element().id
		);
	});

	it('ArrowDown leaves a hidden list alone when there is nothing to show', async () => {
		const onOpen = vi.fn();
		const screen = await render(Picker, {
			props: { options: [], isInitiallyOpen: false, onOpen }
		});
		expect(
			keyDown(screen.getByRole('combobox', { exact: true }).element(), { key: 'ArrowDown' })
		).toBe(true);
		expect(onOpen).not.toHaveBeenCalled();
	});

	it('keys other than the arrows, Enter and Escape reach the field while the list is shown', async () => {
		const onFieldKeyDown = vi.fn();
		const screen = await render(Picker, { props: { onFieldKeyDown } });
		const box = screen.getByRole('combobox', { exact: true }).element();
		await userEvent.click(screen.getByRole('combobox', { exact: true }));
		await userEvent.keyboard('{ArrowDown}');
		const active = box.getAttribute('aria-activedescendant');

		// Home and End stay with the caret: their combobox meaning is undecided.
		for (const key of ['Home', 'End', 'PageDown', 'Tab', ' ', 'a']) {
			expect(keyDown(box, { key })).toBe(true);
		}
		expect(onFieldKeyDown).toHaveBeenCalledTimes(6);
		expect(box).toHaveAttribute('aria-activedescendant', active);
		await expect.element(screen.getByRole('listbox')).toBeInTheDocument();
	});

	it('a chord such as Shift+Enter is the field’s own command', async () => {
		const onSelect = vi.fn();
		const screen = await render(Picker, { props: { onSelect } });
		const box = screen.getByRole('combobox', { exact: true }).element();
		await userEvent.click(screen.getByRole('combobox', { exact: true }));
		await userEvent.keyboard('{ArrowDown}');
		expect(keyDown(box, { key: 'Enter', shiftKey: true })).toBe(true);
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('leaves onKeyDown with the trigger model it already had', async () => {
		const screen = await render(Trigger);
		const button = screen.getByRole('button', { name: 'Pick', exact: true }).element();
		button.focus();
		await userEvent.keyboard('{End}');
		expect(button).toHaveAttribute('aria-activedescendant', 'trigger-item-2');
	});
});

describe('useCombobox field props — input-method composition (FR5)', () => {
	it('a composing key neither moves, picks nor hides', async () => {
		const onSelect = vi.fn();
		const onClose = vi.fn();
		const screen = await render(Picker, { props: { onSelect, onClose } });
		const box = screen.getByRole('combobox', { exact: true }).element();
		await userEvent.click(screen.getByRole('combobox', { exact: true }));
		await userEvent.keyboard('{ArrowDown}');
		const active = screen.getByRole('option', { name: 'Ada', exact: true }).element().id;

		for (const init of [
			{ key: 'ArrowDown', isComposing: true },
			{ key: 'Enter', isComposing: true },
			{ key: 'Escape', isComposing: true },
			{ key: 'Enter', keyCode: 229 }
		]) {
			expect(keyDown(box, init)).toBe(true);
		}
		expect(box).toHaveAttribute('aria-activedescendant', active);
		expect(onSelect).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();

		// Once the composition ends, Enter picks again.
		keyDown(box, { key: 'Enter' });
		expect(onSelect).toHaveBeenCalledWith('ada');
	});
});

describe('useCombobox field props — pointer (FR6)', () => {
	it('hovering makes an option active and pressing picks it, with focus kept in the field', async () => {
		const onSelect = vi.fn();
		const screen = await render(Picker, { props: { onSelect } });
		const box = screen.getByRole('combobox', { exact: true });
		await userEvent.click(box);

		await userEvent.hover(screen.getByRole('option', { name: 'Cy', exact: true }));
		expect(box.element()).toHaveAttribute(
			'aria-activedescendant',
			screen.getByRole('option', { name: 'Cy', exact: true }).element().id
		);
		expect(box.element()).toHaveFocus();

		// A disabled option never becomes active and cannot be picked.
		await userEvent.hover(screen.getByRole('option', { name: 'Bea', exact: true }));
		expect(box.element()).toHaveAttribute(
			'aria-activedescendant',
			screen.getByRole('option', { name: 'Cy', exact: true }).element().id
		);
		// Playwright refuses to click an `aria-disabled` element, where
		// Testing Library's userEvent clicks it and lets the handler ignore it.
		// A native click is the same press without the actionability gate.
		screen
			.getByRole('option', { name: 'Bea', exact: true })
			.element()
			.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
		expect(onSelect).not.toHaveBeenCalled();
		expect(box.element()).toHaveFocus();

		await userEvent.click(screen.getByRole('option', { name: 'Cy', exact: true }));
		expect(onSelect).toHaveBeenCalledWith('cy');
		expect(box.element()).toHaveFocus();
		await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
	});

	it('a press on the listbox itself keeps focus in the field', async () => {
		const screen = await render(Picker);
		const box = screen.getByRole('combobox', { exact: true }).element();
		box.focus();
		expect(mouseDown(screen.getByRole('listbox').element())).toBe(false);
		expect(mouseDown(screen.getByRole('option', { name: 'Ada', exact: true }).element())).toBe(
			false
		);
	});
});
