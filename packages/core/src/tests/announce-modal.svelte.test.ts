/** PORTS: hooks/useAnnounce.modal.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render } from 'vitest-browser-svelte';
import Lightbox from '$lib/components/lightbox/lightbox.svelte';
import { __resetLiveRegionsForTest } from '$lib/hooks/use-announce.js';
import AnnounceOwner from './fixtures/announce-owner.svelte';
import AnnounceModalHarness from './fixtures/announce-modal-harness.svelte';

/**
 * Ported from Astryx's `hooks/useAnnounce.modal.test.tsx` at the 0.7.13 pin.
 *
 * This is the **client** project, in real Chromium. Upstream's jsdom suite
 * stubs `showModal()`/`show()`/`close()` and patches `matches(':modal')`; here
 * the native methods and `:modal` are the real behaviour the route reads, so
 * the suite uses them. `fireEvent` becomes `.element().click()`, and a Svelte
 * DOM flush is a microtask, so a click is followed by `tick()` before an
 * assertion that reads the DOM.
 *
 * ## Restatements, and why
 *
 * - **`BottomSheetSwitcher` shares one `<dialog>` in this port where upstream
 *   gives each step its own.** The two switcher cases therefore read the one
 *   shared dialog's region and assert the leaving step's wrapper is `inert`,
 *   rather than reading a region out of a per-step dialog. The behaviour under
 *   test — where the words are heard and that the leaving step's words are not
 *   lost — is upstream's; the element the region belongs to is the shared
 *   dialog this port actually has.
 * - **`watches every open modal through one shared observer`** asserts the
 *   watched set rather than React's child-first order: Svelte starts the outer
 *   Dialog's provider effect before the inner one, so `presented` is
 *   parent-first. There is still exactly one observer for both.
 * - **The busy cases use the ported `useBusyAnnouncement`**, which upstream's
 *   suite covers as an internal. `enclosingModalDialog` routes by the owner's
 *   element, so a busy start inside an app-owned `<dialog>` nested in a Dialog
 *   lands in the app modal, not the outer one.
 * - **The switcher cases' sheet panels carry `data-testid`** so the test can
 *   reach the inert wrapper by element while its content is out of the
 *   accessibility tree, as upstream reaches its hidden step by element.
 *
 * No case is dropped: every declaration in upstream's file has a case here.
 */

const shared = (politeness = 'polite') =>
	document.querySelector(`[data-astryx-live-region="${politeness}"]`);
const regionIn = (dialog: Element, politeness = 'polite') =>
	dialog.querySelector(`:scope > [data-astryx-modal-live-region="${politeness}"]`);

async function nextFrame() {
	await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function expose() {
	await tick();
	await nextFrame();
	await nextFrame();
}

function dialogNamed(container: ParentNode, name: string): HTMLDialogElement {
	const dialog = [...container.querySelectorAll('dialog')].find(
		(candidate) => candidate.getAttribute('aria-label') === name
	);
	if (dialog == null) {
		throw new Error(`dialog ${name} not found`);
	}
	return dialog;
}

function button(container: ParentNode, name: string): HTMLElement {
	const found =
		[...container.querySelectorAll('button')].find(
			(candidate) => candidate.textContent?.trim() === name
		) ??
		([...container.querySelectorAll('button')].find(
			(candidate) => candidate.getAttribute('aria-label') === name
		) as HTMLButtonElement | undefined);
	if (found == null) {
		throw new Error(`button ${name} not found`);
	}
	return found;
}

function sheetLayer(panel: HTMLElement): HTMLElement {
	const layer = panel.parentElement;
	if (layer == null) {
		throw new Error('sheet layer not found');
	}
	return layer;
}

beforeEach(() => {
	__resetLiveRegionsForTest();
});

afterEach(() => {
	__resetLiveRegionsForTest();
	vi.unstubAllGlobals();
});

/** A `MutationObserver` counting the provider's presentation watch. */
function stubCountingObserver() {
	const original = globalThis.MutationObserver;
	const observed: Node[] = [];
	const disconnected: number[] = [];
	const watchers = new Set<MutationObserver>();
	const isPresentationWatch = (options?: MutationObserverInit) =>
		options?.attributeFilter?.join() === 'open,inert,aria-hidden';
	class Counting extends original {
		isWatch = false;
		override observe(target: Node, options?: MutationObserverInit) {
			if (isPresentationWatch(options)) {
				this.isWatch = true;
				observed.push(target);
				watchers.add(this);
			}
			super.observe(target, options);
		}
		override disconnect() {
			if (this.isWatch) {
				disconnected.push(1);
			}
			super.disconnect();
		}
	}
	vi.stubGlobal('MutationObserver', Counting);
	return { observed, disconnected, watchers };
}

describe('useAnnounce inside Astryx modals (spec:AST-086 FR14)', () => {
	it('uses the shared channel outside any modal', async () => {
		const screen = await render(AnnounceOwner);
		button(screen.container, 'Say').click();
		await nextFrame();
		expect(shared()).toHaveTextContent('Added Design');
		expect(document.querySelector('[data-astryx-modal-live-region]')).toBeNull();
	});

	it.each([
		['Dialog', 'owner-dialog'],
		['modal BottomSheet', 'owner-sheet'],
		['modal Drawer', 'owner-drawer']
	] as const)(
		'routes a caller inside an open %s into that dialog, not the shared channel',
		async (_name, scenario) => {
			const screen = await render(AnnounceModalHarness, { props: { scenario } });
			const dialog = screen.container.querySelector('dialog')!;
			await expose();
			expect(dialog.matches(':modal')).toBe(true);
			button(screen.container, 'Say').click();
			// Inserted empty (FR3), filled on the next frame.
			const region = regionIn(dialog);
			expect(region).not.toBeNull();
			expect(region).toHaveAttribute('role', 'status');
			expect(region).toHaveAttribute('aria-live', 'polite');
			expect(region).toHaveTextContent('');
			await nextFrame();
			expect(region).toHaveTextContent('Added Design');
			expect(shared()?.textContent ?? '').toBe('');
		}
	);

	it("routes a caller inside a Popover's bottom-sheet presentation into that sheet", async () => {
		const screen = await render(AnnounceModalHarness, { props: { scenario: 'popover-sheet' } });
		button(screen.container, 'Filter').click();
		await expect
			.element(screen.getByRole('button', { name: 'Say', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('dialog', { name: 'Filters', exact: true }))
			.toBeInTheDocument();
		const dialog = dialogNamed(screen.container, 'Filters');
		button(screen.container, 'Say').click();
		await expose();
		expect(regionIn(dialog)).toHaveTextContent('Added Design');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it("routes a caller inside a DropdownMenu's bottom-sheet presentation into that sheet", async () => {
		const screen = await render(AnnounceModalHarness, { props: { scenario: 'dropdown-sheet' } });
		(screen.getByRole('button', { name: /Project actions/ }).element() as HTMLElement).click();
		await expect
			.element(screen.getByRole('dialog', { name: 'Project actions', exact: true }))
			.toBeInTheDocument();
		const dialog = dialogNamed(screen.container, 'Project actions');
		button(screen.container, 'Say').click();
		await expose();
		expect(regionIn(dialog)).toHaveTextContent('Added Design');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('holds no MutationObserver for a dialog closed at rest; observes from the open intent until the real close (runtime INV5)', async () => {
		const { observed, disconnected } = stubCountingObserver();
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'sheet-rest', isOpen: false }
		});
		expect(observed).toHaveLength(0);
		await screen.rerender({ scenario: 'sheet-rest', isOpen: true });
		await expose();
		expect(observed).toHaveLength(1);
		expect(observed[0]).toBe(dialogNamed(screen.container, 'Rest'));
		const before = disconnected.length;
		await screen.rerender({ scenario: 'sheet-rest', isOpen: false });
		// The sheet runs its exit, then closes the dialog for real.
		const panel = document.querySelector<HTMLElement>('.astryx-bottom-sheet')!;
		await tick();
		panel.dispatchEvent(
			new TransitionEvent('transitionend', { propertyName: 'transform', bubbles: true })
		);
		await expose();
		await expose();
		expect(disconnected.length).toBeGreaterThan(before);
	});

	it('watches every open modal through one shared observer', async () => {
		const { observed, watchers } = stubCountingObserver();
		const screen = await render(AnnounceModalHarness, { props: { scenario: 'nested-owners' } });
		await expose();
		expect(new Set(observed)).toEqual(
			new Set([dialogNamed(screen.container, 'Upper'), dialogNamed(screen.container, 'Lower')])
		);
		expect(watchers.size).toBe(1);
	});

	it('routes a caller inside an open Lightbox into its dialog', async () => {
		const screen = await render(AnnounceModalHarness, { props: { scenario: 'owner-lightbox' } });
		const dialog = screen.container.querySelector('dialog')!;
		button(screen.container, 'Say').click();
		await expose();
		expect(regionIn(dialog)).toHaveTextContent('Added Design');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it("routes Lightbox's own position message into its open viewer", async () => {
		const screen = await render(Lightbox, {
			props: {
				isOpen: true,
				onOpenChange: () => {},
				media: [
					{ src: '/a.jpg', alt: 'Harbour' },
					{ src: '/b.jpg', alt: 'Lighthouse' }
				]
			}
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		button(screen.container, 'Next').click();
		await expose();
		expect(regionIn(dialog)).toHaveTextContent('Lighthouse, 2 of 2');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('keeps the shared channel inside a non-modal sheet with no modal above it', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'owner-sheet-nonmodal' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		expect(dialog.matches(':modal')).toBe(false);
		button(screen.container, 'Say').click();
		await nextFrame();
		expect(shared()).toHaveTextContent('Added Design');
		expect(regionIn(dialog)).toBeNull();
	});

	it('routes a caller inside a non-modal sheet nested in a Dialog to the Dialog', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'owner-sheet-in-dialog' }
		});
		await expose();
		const modal = dialogNamed(screen.container, 'Modal');
		const sheet = dialogNamed(screen.container, 'Sheet');
		button(screen.container, 'Say').click();
		await expose();
		expect(regionIn(modal)).toHaveTextContent('Added Design');
		expect(regionIn(sheet)).toBeNull();
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('routes a caller inside a modal over a modal to the top one', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'modal-over-modal' }
		});
		const lower = dialogNamed(screen.container, 'Lower');
		await expose();
		button(screen.container, 'Open upper').click();
		await expose();
		const upper = dialogNamed(screen.container, 'Upper');
		button(screen.container, 'Upper say').click();
		button(screen.container, 'Lower say').click();
		await expose();
		expect(regionIn(upper)).toHaveTextContent('Upper words');
		// The lower modal is covered: its owner is not operable until the upper
		// one closes, and a message it announces meanwhile is not heard — its
		// container is clear before it is on top again (FR14).
		expect(regionIn(lower)?.textContent ?? '').toBe('');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('clears words a modal received while covered before it is on top again (FR14)', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'covered-clear' }
		});
		const lower = dialogNamed(screen.container, 'Lower');
		await expose();
		button(screen.container, 'Cover').click();
		await expose();
		button(screen.container, 'Lower say').click();
		await expose();
		button(screen.container, 'Uncover').click();
		await expose();
		// On top again within the clear delay, holding nothing from the time it
		// was covered.
		expect(lower.matches(':modal')).toBe(true);
		expect(regionIn(lower)?.textContent ?? '').toBe('');
		expect(shared()?.textContent ?? '').toBe('');
		// Heard again now that it is on top.
		button(screen.container, 'Lower say').click();
		await expose();
		expect(regionIn(lower)).toHaveTextContent('Lower words');
	});

	it('routes a message announced in the commit that opens its Dialog into the Dialog (the field error a mounting form announces)', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'opening-field-error' }
		});
		button(screen.container, 'Open').click();
		const dialog = dialogNamed(screen.container, 'Edit');
		expect(dialog.matches(':modal')).toBe(true);
		await expose();
		expect(regionIn(dialog, 'assertive')).toHaveTextContent('Name is required');
		expect(shared('assertive')?.textContent ?? '').toBe('');
	});

	it('lets an empty message in the commit that opens the Dialog withdraw a message deferred in that commit (FR9)', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'opening-empty-withdraw' }
		});
		button(screen.container, 'Open').click();
		const dialog = dialogNamed(screen.container, 'Edit');
		await expose();
		expect(regionIn(dialog, 'assertive')?.textContent ?? '').toBe('');
		expect(shared('assertive')?.textContent ?? '').toBe('');
	});

	it('lets an empty message withdraw a message announced in the same commit inside an already-open Dialog (FR9)', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'same-commit-empty' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		button(screen.container, 'Pair').click();
		await expose();
		expect(regionIn(dialog)?.textContent ?? '').toBe('');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it("routes a caller inside a closed Dialog (content still mounted) to the shared channel at once, joined with the frame's other messages (FR9)", async () => {
		await render(AnnounceModalHarness, { props: { scenario: 'closed-content' } });
		await expose();
		// Both written in one commit, both exposed, in order: neither dropped.
		expect(shared()?.textContent).toBe('Page loaded Inside closed');
		expect(document.querySelector('[data-astryx-modal-live-region]')).toBeNull();
	});

	it.each([
		['Dialog', 'inner-opening-dialog'],
		['modal BottomSheet', 'inner-opening-sheet']
	] as const)(
		'routes a message announced in the commit that opens a %s inside an already-open Dialog into the inner modal, not the outer one',
		async (_name, scenario) => {
			const screen = await render(AnnounceModalHarness, { props: { scenario } });
			const outer = dialogNamed(screen.container, 'Outer');
			await expose();
			button(screen.container, 'Open inner').click();
			await tick();
			const inner = dialogNamed(screen.container, 'Inner');
			expect(inner.matches(':modal')).toBe(true);
			await expose();
			expect(regionIn(inner, 'assertive')).toHaveTextContent('Name is required');
			expect(regionIn(outer, 'assertive')).toBeNull();
			expect(shared('assertive')?.textContent ?? '').toBe('');
		}
	);

	it('is heard from app code rendered inside a Dialog', async () => {
		const screen = await render(AnnounceModalHarness, { props: { scenario: 'app-form' } });
		const dialog = dialogNamed(screen.container, 'Edit');
		button(screen.container, 'Save').click();
		await expose();
		expect(regionIn(dialog)).toHaveTextContent('Saved');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('joins different messages written before the previous is exposed, says an identical repeat once, and clears on an empty message (FR9, FR5)', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'join-messages' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		button(screen.container, 'Both').click();
		button(screen.container, 'Both').click();
		await nextFrame();
		expect(regionIn(dialog)?.textContent).toBe('Added Design Removed Eng');
		// A message in the frame the words were written still joins.
		button(screen.container, 'Busy').click();
		await nextFrame();
		expect(regionIn(dialog)?.textContent).toBe('Added Design Removed Eng Loading');
		// A frame later the words count as exposed: a new message starts fresh.
		await nextFrame();
		button(screen.container, 'Busy').click();
		await nextFrame();
		expect(regionIn(dialog)?.textContent).toBe('Loading');
		// Assertive has its own container.
		button(screen.container, 'Fail').click();
		await nextFrame();
		expect(regionIn(dialog, 'assertive')).toHaveAttribute('role', 'alert');
		expect(regionIn(dialog, 'assertive')).toHaveTextContent('Failed');
		expect(regionIn(dialog)?.textContent).toBe('Loading');
		// An empty message withdraws the pending and shown polite text at once.
		button(screen.container, 'Both').click();
		button(screen.container, 'Withdraw').click();
		await nextFrame();
		expect(regionIn(dialog)?.textContent).toBe('');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('hands a message unexposed when its Dialog closes to the shared channel', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'save-close' }
		});
		await expose();
		button(screen.container, 'Save and close').click();
		await expose();
		// Not lost in the closed dialog: the page-body channel has it.
		expect(shared()).toHaveTextContent('Saved');
	});

	it('hands a message unexposed when an upper modal closes to the modal then on top', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'upper-close' }
		});
		const lower = dialogNamed(screen.container, 'Lower');
		await expose();
		button(screen.container, 'Pick').click();
		await expose();
		expect(regionIn(lower)).toHaveTextContent('3 results');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('keeps a waiting message in a dialog that is closed and shown again in one task (a hand-over, not a close)', async () => {
		// A switcher moves one shared dialog between steps: close() then
		// showModal() in the same task. The native close event must not hand the
		// step's words to the page body the person cannot hear.
		const screen = await render(AnnounceModalHarness, { props: { scenario: 'owner-dialog' } });
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		button(screen.container, 'Say').click();
		dialog.close();
		dialog.showModal();
		await expose();
		expect(regionIn(dialog)).toHaveTextContent('Added Design');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('keeps a waiting message when the dialog is re-presented from a later layout effect', async () => {
		// The entering step is presented in a layout effect of a later commit,
		// not in the task that closed the leaving step.
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'steps-represent' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		button(screen.container, 'Say').click();
		button(screen.container, 'Next').click();
		await tick();
		expect(dialog.open).toBe(true);
		await expose();
		expect(regionIn(dialog)).toHaveTextContent('Step 1 words');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('hands a message unexposed when a step closes to the sibling step opened in its place (the modal then on top)', async () => {
		// A flow of sibling modals, as a switcher presents its steps: the leaving
		// step announces and closes in the same update that opens the entering
		// step. The entering step is not an ancestor of the leaving one; it is
		// the modal on top after the close, so the words are delivered there.
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'sibling-flow' }
		});
		await expose();
		button(screen.container, 'Say').click();
		button(screen.container, 'Next').click();
		const two = dialogNamed(screen.container, 'Two');
		await expose();
		expect(regionIn(two)).toHaveTextContent('Step one saved');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('holds words sent as a modal BottomSheet closes — open but inert and aria-hidden through its exit — and delivers them to the page body at the real close', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'sheet-exit-owner' }
		});
		const sheet = screen.container.querySelector('dialog')!;
		await expose();
		button(screen.container, 'Say').click();
		// Focus is outside the sheet, so it goes inert from the close
		// (component:BottomSheet FR9).
		(document.activeElement as HTMLElement | null)?.blur();
		button(screen.container, 'Done').click();
		await tick();
		// The sheet keeps its dialog open and modal while it leaves, but takes it
		// out of the accessibility tree; the page body is behind an active modal
		// until the dialog closes, so nothing is exposed yet and the words wait.
		expect(sheet.open).toBe(true);
		expect(sheet).toHaveAttribute('aria-hidden', 'true');
		expect(sheet).toHaveAttribute('inert');
		await expose();
		expect(regionIn(sheet)?.textContent ?? '').toBe('');
		expect(shared()?.textContent ?? '').toBe('');
		// The exit motion ends: the dialog closes and the page body is exposed.
		sheet.close();
		await expose();
		expect(shared()).toHaveTextContent('Saved');
	});

	it('drops held words when an empty message withdraws them while the sheet exits, so nothing is delivered after the close', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'sheet-exit-two' }
		});
		const sheet = screen.container.querySelector('dialog')!;
		await expose();
		button(screen.container, 'Busy').click();
		// Focus is outside the sheet, so it goes inert from the close
		// (component:BottomSheet FR9).
		(document.activeElement as HTMLElement | null)?.blur();
		button(screen.container, 'Done').click();
		await tick();
		// Held for the real close, as the sheet-exit test shows...
		expect(sheet).toHaveAttribute('inert');
		await nextFrame();
		// ...until the owner takes the words back with an empty message (the
		// exiting sheet is aria-hidden, so reach its control by element).
		button(screen.container, 'Withdraw').click();
		sheet.close();
		await expose();
		expect(shared()?.textContent ?? '').toBe('');
		expect(regionIn(sheet)?.textContent ?? '').toBe('');
	});

	it('hands words sent as a switcher step hands over to the entering step', async () => {
		const screen = await render(AnnounceModalHarness, { props: { scenario: 'switcher' } });
		const dialog = screen.container.querySelector('dialog')!;
		const oneLayer = sheetLayer(
			screen.container.querySelector<HTMLElement>('[data-testid="switcher-one"]')!
		);
		await expose();
		button(screen.container, 'Say').click();
		button(screen.container, 'Continue').click();
		await tick();
		// The leaving step stays open but inert through its exit; the entering
		// step is the exposed one, and this port's one shared dialog carries the
		// region both steps announce through.
		expect(oneLayer).toHaveAttribute('inert');
		expect(dialog.matches(':modal')).toBe(true);
		await expose();
		expect(regionIn(dialog)).toHaveTextContent('Overview saved');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('hands words sent just before an open Dialog is unmounted to the shared channel', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'conditional-dialog' }
		});
		await expose();
		button(screen.container, 'Say').click();
		button(screen.container, 'Remove').click();
		await tick();
		expect(screen.container.querySelector('dialog')).toBeNull();
		await expose();
		expect(shared()).toHaveTextContent('Saved');
	});

	it('announces a busy start inside a native modal an app renders without Astryx, opened inside a Dialog, in the app modal (FR14)', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'busy-app-dialog' }
		});
		const outer = dialogNamed(screen.container, 'Outer');
		const app = dialogNamed(screen.container, 'App');
		await expose();
		expect(app.matches(':modal')).toBe(true);
		button(screen.container, 'Start').click();
		// The busy hook chooses its route a frame later and the region fills a
		// frame after that.
		await expose();
		await nextFrame();
		expect(regionIn(app)).toHaveTextContent('Loading');
		expect(regionIn(outer)).toBeNull();
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('routes a caller inside an open MobileNav into its dialog', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'owner-mobile-nav' }
		});
		const nav = dialogNamed(screen.container, 'Menu');
		await expose();
		button(screen.container, 'Say').click();
		await expose();
		expect(regionIn(nav)).toHaveTextContent('Added Design');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('keeps the step the person went back to on top while the leaving step exits, so its messages are heard', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'switcher', switcherMessage: 'Back on one' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		const twoLayer = sheetLayer(
			screen.container.querySelector<HTMLElement>('[data-testid="switcher-two"]')!
		);
		await expose();
		button(screen.container, 'Continue').click();
		await expose();
		button(screen.container, 'Back').click();
		await tick();
		// Two is leaving: still open, inert; one is the exposed step again.
		expect(twoLayer).toHaveAttribute('inert');
		expect(dialog.matches(':modal')).toBe(true);
		button(screen.container, 'Say').click();
		await expose();
		expect(regionIn(dialog)).toHaveTextContent('Back on one');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('holds words sent as a modal BottomSheet over a Dialog closes and delivers them to the Dialog at the real close', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'sheet-over-dialog' }
		});
		const edit = dialogNamed(screen.container, 'Edit');
		await expose();
		button(screen.container, 'Open sheet').click();
		await expose();
		const sheet = dialogNamed(screen.container, 'Sheet');
		button(screen.container, 'Say').click();
		// Focus is outside the sheet, so it goes inert from the close
		// (component:BottomSheet FR9).
		(document.activeElement as HTMLElement | null)?.blur();
		button(screen.container, 'Done').click();
		await tick();
		// The sheet, still an open modal through its exit, covers the Dialog:
		// nothing is exposed yet, so the words wait rather than being written
		// to the covered Dialog (which would clear them).
		expect(sheet).toHaveAttribute('inert');
		await expose();
		expect(regionIn(sheet)?.textContent ?? '').toBe('');
		expect(regionIn(edit)?.textContent ?? '').toBe('');
		expect(shared()?.textContent ?? '').toBe('');
		sheet.close();
		await expose();
		expect(regionIn(edit)).toHaveTextContent('Saved');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('withdraws a busy start written inside a modal but not yet exposed when its owner settles with its outcome (AST-086 FR8)', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'busy-withdraw' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		button(screen.container, 'Start').click();
		// The busy hook chooses its route a frame later and writes "Loading" to
		// the dialog's container, to be exposed a frame after that...
		await nextFrame();
		// ...but the outcome arrives first and the owner settles.
		button(screen.container, 'Outcome').click();
		await expose();
		expect(regionIn(dialog)?.textContent).toBe('3 results');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('withdraws only its own busy start inside a modal when another owner wrote the same words (AST-086 FR8, FR9)', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'busy-shared-words' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		button(screen.container, 'Start one').click();
		button(screen.container, 'Start two').click();
		await nextFrame();
		button(screen.container, 'Settle one').click();
		await expose();
		expect(regionIn(dialog)?.textContent).toBe('Loading');
	});

	describe('a non-modal Drawer (hasScrim={false}, shown with showPopover(), never `open`)', () => {
		it('routes a caller inside it to the shared channel at once, joined with a page message from the same task (FR9)', async () => {
			const screen = await render(AnnounceModalHarness, {
				props: { scenario: 'owner-nonmodal-drawer' }
			});
			const drawer = screen.container.querySelector('dialog')!;
			expect(drawer.open).toBe(false);
			await expose();
			expect(shared()?.textContent).toBe('Page loaded Inside drawer');
			expect(regionIn(drawer)).toBeNull();
		});

		it('lets a busy start inside it be withdrawn by its outcome (FR8)', async () => {
			const screen = await render(AnnounceModalHarness, {
				props: { scenario: 'busy-nonmodal-drawer' }
			});
			await expose();
			button(screen.container, 'Start').click();
			await nextFrame();
			button(screen.container, 'Outcome').click();
			await expose();
			expect(shared()?.textContent).toBe('3 results');
		});
	});

	it('takes the route of where the call is: a component that renders a Dialog but announces from above it uses the shared channel', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'open-from-above' }
		});
		const dialog = dialogNamed(screen.container, 'Modal');
		await expose();
		button(screen.container, 'Above').click();
		button(screen.container, 'Inside').click();
		await expose();
		expect(shared()).toHaveTextContent('From above');
		expect(regionIn(dialog)).toHaveTextContent('From inside');
	});

	it('lets a component that owns a modal route its own messages into it through the provider it renders', async () => {
		// The FR14 route for CommandPalette's counts and Lightbox's position: the
		// owner renders the provider around the part of itself that announces
		// about the modal's content.
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'provider-owner' }
		});
		const dialog = dialogNamed(screen.container, 'Modal');
		await expose();
		button(screen.container, 'Say').click();
		await expose();
		expect(regionIn(dialog)).toHaveTextContent('Routed in');
	});
});
