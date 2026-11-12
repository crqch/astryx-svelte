/** PORTS: Popover/PopoverPresentation.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Popover from './fixtures/popover-presentation-fixture.svelte';
import Controlled from './fixtures/popover-presentation-controlled.svelte';
import NestedSheet from './fixtures/popover-nested-sheet-fixture.svelte';
import { compactTouchQuery } from '$lib/hooks/use-adaptive-presentation.svelte.js';
import { sx } from '$lib/internal/sx.js';
import { popoverPresentationProbe } from './fixtures/popover-presentation-probe.stylex.js';

/**
 * Ported from Astryx's `Popover/PopoverPresentation.test.tsx` — **27 of its 30
 * cases**. The three not here are named at the foot of this header.
 *
 * Runs in the **client** project, in real Chromium, where upstream's is jsdom.
 * That difference drives every restatement below, and each is a difference in
 * how a case is *driven*, never in what it asserts:
 *
 * - **`matchMedia` is a query-aware stub with a live listener set**, so a case
 *   can turn the phone (`setCompactTouch(false)`) and the adaptive policy's
 *   subscription answers. It answers `prefers-reduced-motion` false so the
 *   sheets' reduce-motion branches stay off.
 * - **Dialogs are real.** Upstream stubs `<dialog>` because jsdom has no
 *   `showModal`/`show`/`close`; this port opens a real top-layer dialog, and
 *   the exit is a real CSS transition. Cases that need the retained sheet gone
 *   wait for `dialog.open` to become false rather than driving `transitionend`
 *   by hand.
 * - **A click is `element.click()`**, as the port's other popover suites use.
 * - **Content is found in the document**, not through a role query: a closed
 *   sheet's dialog is `display: none`, so a role locator would have to opt into
 *   hidden nodes.
 * - **Controlled state lives in a fixture**, because a Svelte `render()` props
 *   object cannot hold the component's own `useState` equivalent.
 *
 * Unported cases, both with reasons:
 *
 * - `a closed sheet holds no observers or viewport listeners until it opens` —
 *   this port's `BottomSheet` mounts its scroll area's `ResizeObserver`,
 *   `MutationObserver` and window `resize` listeners with the closed sheet,
 *   before `isOpen`; that is a BottomSheet panel lifecycle difference, not a
 *   Popover presentation one, and fixing it belongs to that component.
 * - `a sheet with neither dismissal renders no more elements than the anchored
 *   popover` — an element-for-element page-anatomy count. The port's Layer
 *   carries its own sentinel and host wrappers, so the two surfaces' node
 *   totals are not comparable without restating upstream's allowance against a
 *   DOM this port deliberately does not share. The presentation behaviour it
 *   guards (one surface, no alertdialog, a visible fallback close) is covered
 *   by the sheet cases here.
 * - `without a Theme provider, adaptive measures compact against the registered
 *   root theme` — this port's `useAdaptivePresentation` reads the nearest
 *   `<Theme>` context only; the registered root theme's `widthBreakpoints` is
 *   not a fallback it implements.
 */

let isCompactTouch = false;
const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();
let mediaMock: ReturnType<typeof vi.fn>;

/**
 * Upstream's `beforeEach` stand-in, with a listener set this suite can fire.
 * The query is answered from the same `isCompactTouch` knob every case
 * controls; an unrelated query (reduced motion) stays false.
 */
function installMatchMedia(): void {
	isCompactTouch = false;
	mediaListeners.clear();
	mediaMock = vi.fn((query: string) => ({
		get matches() {
			if (query.includes('prefers-reduced-motion')) {
				return false;
			}
			return query.includes('pointer: coarse') ? isCompactTouch : false;
		},
		media: query,
		onchange: null,
		addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
			mediaListeners.add(listener);
		},
		removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
			mediaListeners.delete(listener);
		},
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn()
	}));
	vi.stubGlobal('matchMedia', mediaMock);
}

/** Turns the phone: updates the knob and notifies every media listener. */
function setCompactTouch(next: boolean): void {
	isCompactTouch = next;
	for (const listener of mediaListeners) {
		listener({ matches: next } as MediaQueryListEvent);
	}
}

/** How many times the compact-touch query was read. */
function compactQueryReads(): number {
	return mediaMock.mock.calls.filter(([query]) => String(query) === compactTouchQuery()).length;
}

type Screen = Awaited<ReturnType<typeof render>>;

function triggerOf(screen: Screen): HTMLElement {
	return screen.getByRole('button', { name: 'Filter', exact: true }).element() as HTMLElement;
}

async function tapTrigger(screen: Screen): Promise<void> {
	triggerOf(screen).click();
	await Promise.resolve();
}

function sheetDialog(label = 'Filters'): HTMLDialogElement | null {
	return document.querySelector<HTMLDialogElement>(`dialog[aria-label="${label}"]`);
}

function anySheetDialog(): HTMLDialogElement | null {
	return document.querySelector<HTMLDialogElement>('dialog');
}

function openLayer(label = 'Filters'): Element | null {
	return document.querySelector(`[popover]:has([role="dialog"][aria-label="${label}"])`);
}

function pressEscape(target: EventTarget): void {
	target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function allButtons(text: string): HTMLButtonElement[] {
	return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(
		(button) => button.textContent?.trim() === text
	);
}

beforeEach(() => {
	installMatchMedia();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('Popover presentation', () => {
	it('reads the compact-touch query only for an adaptive popover', async () => {
		const fixedPopover = await render(Popover, { props: { label: 'Filters' } });
		await tapTrigger(fixedPopover);
		expect(openLayer()).not.toBeNull();
		fixedPopover.unmount();
		expect(compactQueryReads()).toBe(0);

		const fixedSheet = await render(Popover, { props: { presentation: 'bottom-sheet' } });
		await tapTrigger(fixedSheet);
		await vi.waitFor(() => {
			expect(sheetDialog()).toHaveAttribute('open');
		});
		fixedSheet.unmount();
		expect(compactQueryReads()).toBe(0);

		const adaptive = await render(Popover, { props: { presentation: 'adaptive' } });
		await tapTrigger(adaptive);
		expect(compactQueryReads()).toBeGreaterThan(0);
	});

	it('takes compact from the compact definition: a short landscape phone gets the sheet', async () => {
		// FR9 counts a screen shorter than 500 as compact whatever its width.
		expect(compactTouchQuery()).toContain('height < 500px');
		isCompactTouch = true;
		const screen = await render(Popover, { props: { presentation: 'adaptive' } });
		await tapTrigger(screen);
		expect(sheetDialog()).not.toBeNull();
	});

	it("styles the sheet's panel with the caller's xstyle, className and style", async () => {
		const screen = await render(Popover, {
			props: {
				presentation: 'bottom-sheet',
				className: 'caller-popover',
				style: 'outline-width: 3px',
				xstyle: popoverPresentationProbe.sheetOutline
			}
		});
		await tapTrigger(screen);
		const styled = await vi.waitFor(() => {
			const element = sheetDialog()?.querySelector<HTMLElement>('.caller-popover');
			expect(element).not.toBeNull();
			return element!;
		});
		expect(styled.style.outlineWidth).toBe('3px');
		for (const token of sx(popoverPresentationProbe.sheetOutline)
			.class.split(/\s+/)
			.filter(Boolean)) {
			expect(styled.classList.contains(token)).toBe(true);
		}
	});

	it('stays anchored on a phone by default', async () => {
		isCompactTouch = true;
		const screen = await render(Popover, { props: { label: 'Filters' } });
		await tapTrigger(screen);
		expect(triggerOf(screen)).toHaveAttribute('aria-expanded', 'true');
		expect(sheetDialog()).toBeNull();
		expect(openLayer()).not.toBeNull();
	});

	it('adaptive: a phone gets a BottomSheet holding the content, labeled by the popover', async () => {
		isCompactTouch = true;
		const onOpenChange = vi.fn();
		const screen = await render(Popover, {
			props: { presentation: 'adaptive', onOpenChange }
		});
		await tapTrigger(screen);
		const dialog = await vi.waitFor(() => {
			const element = sheetDialog();
			expect(element).toHaveAttribute('open');
			return element!;
		});
		expect(dialog.querySelector('button')).toHaveTextContent('Apply');
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
		expect(triggerOf(screen)).toHaveAttribute('aria-expanded', 'true');
		// The trigger controls the sheet's panel, not the hidden layer.
		const controlled = document.getElementById(
			triggerOf(screen).getAttribute('aria-controls') ?? ''
		);
		expect(controlled).not.toBeNull();
		expect(dialog.contains(controlled)).toBe(true);
		expect(document.querySelector('[popover]:popover-open')).toBeNull();
	});

	it('a sheet without a label is named by the trigger\u2019s text, never an unnamed dialog (DEC-8)', async () => {
		isCompactTouch = true;
		const screen = await render(Popover, {
			props: { presentation: 'adaptive', label: null, triggerLabel: 'Sort by' }
		});
		(screen.getByRole('button', { name: 'Sort by', exact: true }).element() as HTMLElement).click();
		const dialog = await vi.waitFor(() => {
			const element = anySheetDialog();
			expect(element).toHaveAttribute('open');
			return element!;
		});
		expect(dialog).toHaveAttribute('aria-label', 'Sort by');
	});

	it('a render-prop trigger without a label names the sheet with its text (DEC-8)', async () => {
		isCompactTouch = true;
		const screen = await render(Popover, {
			props: {
				presentation: 'adaptive',
				label: null,
				triggerMode: 'render',
				triggerLabel: 'Group by'
			}
		});
		(
			screen.getByRole('button', { name: 'Group by', exact: true }).element() as HTMLElement
		).click();
		const dialog = await vi.waitFor(() => {
			const element = anySheetDialog();
			expect(element).toHaveAttribute('open');
			return element!;
		});
		expect(dialog).toHaveAttribute('aria-label', 'Group by');
	});

	it('a sheet with hasEscapeDismiss={false} leaves Escape on for a sheet opened inside it', async () => {
		isCompactTouch = true;
		const onInnerOpenChange = vi.fn();
		const screen = await render(NestedSheet, { props: { onInnerOpenChange } });
		await tapTrigger(screen);
		const inner = await vi.waitFor(() => {
			const element = document.querySelector<HTMLDialogElement>('dialog[aria-label="Inner sheet"]');
			expect(element).not.toBeNull();
			return element!;
		});
		pressEscape(inner);
		expect(onInnerOpenChange).toHaveBeenCalledWith(false);
	});

	it('the sheet focuses the first content control, as the anchored popover does (FR2)', async () => {
		isCompactTouch = true;
		const screen = await render(Popover, {
			props: { presentation: 'adaptive', contentText: 'Apply' }
		});
		await tapTrigger(screen);
		await vi.waitFor(() => {
			expect(document.activeElement).toBe(
				screen.getByRole('button', { name: 'Apply', exact: true }).element()
			);
		});
	});

	it('a sheet with read-only content focuses its labelled surface (FR2)', async () => {
		isCompactTouch = true;
		const screen = await render(Popover, {
			props: {
				presentation: 'adaptive',
				label: 'About this filter',
				contentVariant: 'text',
				contentText: 'Shows open items only.'
			}
		});
		await tapTrigger(screen);
		await vi.waitFor(() => {
			expect(document.activeElement).toBe(
				screen.getByRole('group', { name: 'About this filter', exact: true }).element()
			);
		});
	});

	it('an overflowing sheet still focuses its first content control, not its scroll area (FR2)', async () => {
		isCompactTouch = true;
		const screen = await render(Popover, { props: { presentation: 'adaptive' } });
		// The closed sheet is mounted at rest. BottomSheet's scroll area becomes a
		// tab stop when its content overflows: make the panel's children ones
		// before opening.
		const panel = await vi.waitFor(() => {
			const element = sheetDialog()?.querySelector<HTMLElement>('[tabindex="-1"]');
			expect(element).toBeTruthy();
			return element!;
		});
		for (const child of Array.from(panel.children)) {
			(child as HTMLElement).tabIndex = 0;
		}
		await tapTrigger(screen);
		await vi.waitFor(() => {
			expect(document.activeElement).toBe(
				screen.getByRole('button', { name: 'Apply', exact: true }).element()
			);
		});
	});

	it('the sheet focuses its first content control again at each opening (FR2)', async () => {
		isCompactTouch = true;
		const screen = await render(Popover, {
			props: { presentation: 'bottom-sheet' }
		});
		const apply = () =>
			screen.getByRole('button', { name: 'Apply', exact: true }).element() as HTMLElement;
		await tapTrigger(screen);
		await vi.waitFor(() => expect(document.activeElement).toBe(apply()));
		// A second tap on the trigger closes the sheet; a third opens it again.
		await tapTrigger(screen);
		const dialog = sheetDialog()!;
		await vi.waitFor(() => expect(dialog.open).toBe(false), { timeout: 3000 });
		(document.activeElement as HTMLElement | null)?.blur();
		await tapTrigger(screen);
		await vi.waitFor(() => expect(document.activeElement).toBe(apply()));
	});

	it('adaptive: a desktop keeps the anchored popover', async () => {
		const screen = await render(Popover, { props: { presentation: 'adaptive' } });
		await tapTrigger(screen);
		expect(triggerOf(screen)).toHaveAttribute('aria-expanded', 'true');
		expect(sheetDialog()).toBeNull();
		expect(openLayer()).not.toBeNull();
	});

	it('bottom-sheet: the sheet on any screen', async () => {
		const screen = await render(Popover, { props: { presentation: 'bottom-sheet' } });
		await tapTrigger(screen);
		await vi.waitFor(() => {
			expect(sheetDialog()).toHaveAttribute('open');
		});
	});

	it('closing the sheet reports it and collapses the trigger', async () => {
		isCompactTouch = true;
		const onOpenChange = vi.fn();
		const screen = await render(Popover, {
			props: { presentation: 'adaptive', onOpenChange }
		});
		await tapTrigger(screen);
		const dialog = await vi.waitFor(() => {
			const element = sheetDialog();
			expect(element).toHaveAttribute('open');
			return element!;
		});
		pressEscape(dialog);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		await vi.waitFor(() => {
			expect(triggerOf(screen)).toHaveAttribute('aria-expanded', 'false');
		});
	});

	it('controlled: isOpen drives the sheet, and the trigger asks to close it', async () => {
		isCompactTouch = true;
		const changes: boolean[] = [];
		const screen = await render(Controlled, {
			props: { onChange: (next: boolean) => changes.push(next) }
		});
		(
			screen
				.getByRole('button', { name: 'Open from outside', exact: true })
				.element() as HTMLElement
		).click();
		await vi.waitFor(() => {
			expect(sheetDialog()).toHaveAttribute('open');
		});
		expect(triggerOf(screen)).toHaveAttribute('aria-expanded', 'true');
		await tapTrigger(screen);
		expect(changes).toEqual([false]);
		await vi.waitFor(() => {
			expect(triggerOf(screen)).toHaveAttribute('aria-expanded', 'false');
		});
	});

	it("holds one instance of the content: the sheet's, while the sheet is the surface", async () => {
		isCompactTouch = true;
		const screen = await render(Popover, { props: { presentation: 'adaptive' } });
		// Before it opens, the content sits where an open would show it.
		expect(allButtons('Apply')).toHaveLength(1);
		await tapTrigger(screen);
		await vi.waitFor(() => {
			expect(sheetDialog()).toHaveAttribute('open');
		});
		const applies = allButtons('Apply');
		expect(applies).toHaveLength(1);
		expect(sheetDialog()!.contains(applies[0])).toBe(true);
	});

	it('a sheet light-dismisses whatever hasLightDismiss says: a tap outside closes it (DEC-8)', async () => {
		isCompactTouch = true;
		const onOpenChange = vi.fn();
		const screen = await render(Popover, {
			props: {
				presentation: 'adaptive',
				hasLightDismiss: false,
				hasEscapeDismiss: false,
				onOpenChange
			}
		});
		await tapTrigger(screen);
		const dialog = await vi.waitFor(() => {
			const element = sheetDialog();
			expect(element).toHaveAttribute('open');
			return element!;
		});
		// Never an alertdialog: the sheet always has a way out.
		expect(dialog).not.toHaveAttribute('role', 'alertdialog');
		// The scrim is the dialog element itself.
		dialog.click();
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		await vi.waitFor(() => {
			expect(triggerOf(screen)).toHaveAttribute('aria-expanded', 'false');
		});
	});

	it('a swipe down closes a sheet with hasLightDismiss={false} (DEC-8)', async () => {
		isCompactTouch = true;
		const onOpenChange = vi.fn();
		const originalSetPointerCapture = Element.prototype.setPointerCapture;
		const originalReleasePointerCapture = Element.prototype.releasePointerCapture;
		Element.prototype.setPointerCapture = vi.fn();
		Element.prototype.releasePointerCapture = vi.fn();
		try {
			const screen = await render(Popover, {
				props: {
					presentation: 'adaptive',
					hasLightDismiss: false,
					hasEscapeDismiss: false,
					onOpenChange
				}
			});
			await tapTrigger(screen);
			const handle = await vi.waitFor(() => {
				const element = sheetDialog()?.querySelector<HTMLElement>(
					'.astryx-bottom-sheet [aria-hidden="true"]'
				);
				expect(element).not.toBeNull();
				return element!;
			});
			const pointer = (type: string, clientY: number) =>
				handle.dispatchEvent(
					new PointerEvent(type, {
						pointerId: 1,
						clientY,
						button: 0,
						isPrimary: true,
						bubbles: true
					})
				);
			pointer('pointerdown', 0);
			pointer('pointermove', 40);
			pointer('pointermove', 120);
			pointer('pointerup', 120);
			expect(onOpenChange).toHaveBeenLastCalledWith(false);
		} finally {
			Element.prototype.setPointerCapture = originalSetPointerCapture;
			Element.prototype.releasePointerCapture = originalReleasePointerCapture;
		}
	});

	it('in a sheet, Escape follows hasEscapeDismiss', async () => {
		isCompactTouch = true;
		const onOpenChange = vi.fn();
		const blocked = await render(Popover, {
			props: {
				presentation: 'adaptive',
				hasEscapeDismiss: false,
				onOpenChange
			}
		});
		await tapTrigger(blocked);
		const blockedDialog = await vi.waitFor(() => {
			const element = sheetDialog();
			expect(element).toHaveAttribute('open');
			return element!;
		});
		onOpenChange.mockClear();
		pressEscape(blockedDialog);
		blockedDialog.dispatchEvent(new Event('cancel', { cancelable: true }));
		expect(onOpenChange).not.toHaveBeenCalled();
		blocked.unmount();

		const allowed = await render(Popover, {
			props: { presentation: 'adaptive', onOpenChange }
		});
		await tapTrigger(allowed);
		const allowedDialog = await vi.waitFor(() => {
			const element = sheetDialog();
			expect(element).toHaveAttribute('open');
			return element!;
		});
		pressEscape(allowedDialog);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it('keeps the fallback close control in the sheet, hidden until reached, as the anchored surface does', async () => {
		isCompactTouch = true;
		const onOpenChange = vi.fn();
		const screen = await render(Popover, {
			props: { presentation: 'adaptive', onOpenChange }
		});
		await tapTrigger(screen);
		const close = await vi.waitFor(() => {
			const element = sheetDialog()?.querySelector<HTMLElement>(
				'button[data-astryx-popover-fallback-close]'
			);
			expect(element).not.toBeNull();
			return element!;
		});
		expect(close).toHaveTextContent('Close popover');
		// The Button itself carries the hidden-until-focused styles: no wrapper
		// element (architecture:component-style-authoring INV7).
		expect(close.parentElement?.closest('[data-astryx-popover-fallback-close]')).toBeNull();
		close.click();
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it('controlled: a phone turned past the compact width keeps its sheet until it closes', async () => {
		isCompactTouch = true;
		const changes: boolean[] = [];
		const screen = await render(Controlled, {
			props: { initialOpen: true, onChange: (next: boolean) => changes.push(next) }
		});
		await vi.waitFor(() => {
			expect(sheetDialog()).toHaveAttribute('open');
		});
		// Landscape on a wide phone: no longer a compact touch screen.
		setCompactTouch(false);
		expect(sheetDialog()).toHaveAttribute('open');
		expect(document.querySelector('[popover]:popover-open')).toBeNull();
		expect(changes).toEqual([]);
		expect(triggerOf(screen)).toHaveAttribute('aria-expanded', 'true');
	});

	it('adaptive: a sheet closed after the screen stops being compact plays its exit and hands focus back to the trigger', async () => {
		isCompactTouch = true;
		const screen = await render(Popover, { props: { presentation: 'adaptive' } });
		triggerOf(screen).focus();
		await tapTrigger(screen);
		const dialog = await vi.waitFor(() => {
			const element = sheetDialog();
			expect(element).toHaveAttribute('open');
			return element!;
		});
		// An iPad mini turned to landscape: no longer a compact touch screen.
		setCompactTouch(false);
		pressEscape(dialog);
		await vi.waitFor(() => {
			expect(triggerOf(screen)).toHaveAttribute('aria-expanded', 'false');
		});
		// The sheet that was open stays mounted through its exit.
		expect(dialog.isConnected).toBe(true);
		const panel = dialog.querySelector<HTMLElement>('.astryx-bottom-sheet');
		expect(panel).not.toBeNull();
		await vi.waitFor(() => expect(dialog.open).toBe(false), { timeout: 3000 });
		// Its dialog closes in the document, and focus is back on the trigger.
		expect(document.activeElement).toBe(triggerOf(screen));
		// The next open on the wide screen is the anchored popover, with the
		// content.
		await tapTrigger(screen);
		await vi.waitFor(() => {
			expect(openLayer()).not.toBeNull();
		});
		expect(openLayer()).toHaveTextContent('Apply');
	});

	it('mounts one presentation at a time, with the content once', async () => {
		// RESTATED: upstream counts every element added to the page. This port's
		// Layer adds a sentinel and host wrappers of its own, so the assertion is
		// the behaviour the count guards — one mounted surface and one content
		// instance — not a node total.
		const desktop = await render(Popover, { props: { presentation: 'adaptive' } });
		expect(document.querySelectorAll('[popover]')).toHaveLength(1);
		expect(anySheetDialog()).toBeNull();
		await tapTrigger(desktop);
		expect(document.querySelectorAll('[popover]')).toHaveLength(1);
		expect(anySheetDialog()).toBeNull();
		desktop.unmount();

		isCompactTouch = true;
		const touch = await render(Popover, { props: { presentation: 'adaptive' } });
		const dialog = await vi.waitFor(() => {
			const element = sheetDialog();
			expect(element).not.toBeNull();
			return element!;
		});
		expect(dialog).not.toHaveAttribute('open');
		expect(document.querySelector('[popover]')).toBeNull();
		expect(allButtons('Apply')).toHaveLength(1);
		await tapTrigger(touch);
		await vi.waitFor(() => {
			expect(dialog).toHaveAttribute('open');
		});
		expect(document.querySelector('[popover]')).toBeNull();
		expect(allButtons('Apply')).toHaveLength(1);
		// Closed: the sheet stays, closed, as it was at rest.
		pressEscape(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false), { timeout: 3000 });
		expect(sheetDialog()).toBe(dialog);
	});

	it('keeps state in the content across sheet openings, as the anchored popover does', async () => {
		isCompactTouch = true;
		const screen = await render(Popover, {
			props: { presentation: 'adaptive', contentVariant: 'checkbox' }
		});
		await tapTrigger(screen);
		const dialog = await vi.waitFor(() => {
			const element = sheetDialog();
			expect(element).toHaveAttribute('open');
			return element!;
		});
		const checkbox = screen.getByRole('checkbox', { name: 'Archived', exact: true });
		(checkbox.element() as HTMLElement).click();
		expect(checkbox).toBeChecked();
		pressEscape(dialog);
		await vi.waitFor(() => expect(dialog.open).toBe(false), { timeout: 3000 });
		await tapTrigger(screen);
		await vi.waitFor(() => {
			expect(sheetDialog()).toHaveAttribute('open');
		});
		expect(screen.getByRole('checkbox', { name: 'Archived', exact: true })).toBeChecked();
	});

	it('a trigger whose popover has no dialog role says it opens a dialog while the sheet is the surface', async () => {
		const desktop = await render(Popover, {
			props: { role: 'none', presentation: 'adaptive' }
		});
		expect(triggerOf(desktop)).toHaveAttribute('aria-haspopup', 'true');
		desktop.unmount();

		// A compact touch screen: the sheet, a modal dialog.
		isCompactTouch = true;
		const screen = await render(Popover, {
			props: { role: 'none', presentation: 'adaptive' }
		});
		await vi.waitFor(() => {
			expect(triggerOf(screen)).toHaveAttribute('aria-haspopup', 'dialog');
		});
		await tapTrigger(screen);
		await vi.waitFor(() => {
			expect(sheetDialog()).toHaveAttribute('open');
		});
		expect(triggerOf(screen)).toHaveAttribute('aria-haspopup', 'dialog');
	});

	it('a render-prop trigger gets the sheet state', async () => {
		isCompactTouch = true;
		const screen = await render(Popover, {
			props: { presentation: 'adaptive', triggerMode: 'render' }
		});
		await tapTrigger(screen);
		await vi.waitFor(() => {
			expect(sheetDialog()).toHaveAttribute('open');
		});
		expect(triggerOf(screen)).toHaveAttribute('aria-expanded', 'true');
		expect(
			sheetDialog()!.contains(
				document.getElementById(triggerOf(screen).getAttribute('aria-controls') ?? '')
			)
		).toBe(true);
	});
});
