/** PORTS: hooks/useAnnounce.replace.test.tsx */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { __resetLiveRegionsForTest, useAnnounce } from '$lib/hooks/use-announce.js';
import AnnounceModalHarness from './fixtures/announce-modal-harness.svelte';

/**
 * Ported from Astryx's `hooks/useAnnounce.replace.test.tsx` at the 0.7.13 pin.
 *
 * Upstream drives this in jsdom with stubbed `showModal()`/`close()` and a
 * patched `matches(':modal')`. This suite runs in real Chromium, where the
 * native methods and `:modal` are what the route reads, so no stub is needed —
 * except in the one case that must make an open dialog stop being `:modal`
 * without any attribute changing, which patches the element's own `matches`.
 *
 * `fireEvent.click` becomes `.element().click()`. A Svelte state write lands on
 * the microtask queue, so each case flushes (`tick`) before asserting on the
 * DOM and waits a frame where upstream's `nextFrame()` does. Two frames are
 * used after a write: the region exposes its words on the first and marks them
 * exposed on the second, which is the boundary `hasReplace` withdraws within.
 */

const shared = (politeness = 'polite') =>
	document.querySelector(`[data-astryx-live-region="${politeness}"]`);
const regionIn = (dialog: Element, politeness = 'polite') =>
	dialog.querySelector(`:scope > [data-astryx-modal-live-region="${politeness}"]`);

async function nextFrame() {
	await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/** Let a Svelte state write render, then let the region expose it. */
async function expose() {
	await tick();
	await nextFrame();
	await nextFrame();
}

const REPLACE = { hasReplace: true } as const;

beforeEach(() => {
	__resetLiveRegionsForTest();
});

afterEach(() => {
	__resetLiveRegionsForTest();
});

describe('useAnnounce({hasReplace}) on the shared channel (spec:AST-086 FR9)', () => {
	it('says only the latest of its messages written in one frame', async () => {
		const announce = useAnnounce(REPLACE);
		announce('1 result');
		announce('Create "Urg"');
		announce('Create "Urgent"');
		await expose();
		expect(shared()?.textContent).toBe('Create "Urgent"');
	});

	it('still joins another instance’s message written in the same frame', async () => {
		const count = useAnnounce(REPLACE);
		const other = useAnnounce();
		other('Filter applied');
		count('3 results');
		count('2 results');
		await expose();
		expect(shared()?.textContent).toBe('Filter applied 2 results');
	});

	it('keeps joining the messages of an instance without hasReplace', async () => {
		const announce = useAnnounce();
		announce('Added Design');
		announce('Removed Eng');
		await expose();
		expect(shared()?.textContent).toBe('Added Design Removed Eng');
	});

	it('withdraws only its own share of words another instance also wrote', async () => {
		const first = useAnnounce(REPLACE);
		const second = useAnnounce(REPLACE);
		first('1 result');
		second('1 result');
		first('2 results');
		await expose();
		// The second instance still holds "1 result".
		expect(shared()?.textContent).toBe('1 result 2 results');
	});

	it('leaves a message that was already exposed: the next one starts fresh', async () => {
		const announce = useAnnounce(REPLACE);
		announce('1 result');
		await expose();
		expect(shared()?.textContent).toBe('1 result');
		announce('2 results');
		await expose();
		expect(shared()?.textContent).toBe('2 results');
	});

	it('leaves another announcer’s equal words written after its own message was exposed', async () => {
		const count = useAnnounce(REPLACE);
		const other = useAnnounce();
		count('1 result');
		await expose();
		other('1 result');
		count('2 results');
		await expose();
		expect(shared()?.textContent).toBe('1 result 2 results');
	});

	it('withdraws its polite message for an assertive one, which is spoken in the assertive region', async () => {
		const announce = useAnnounce(REPLACE);
		announce('3 results');
		announce('Search failed', 'assertive');
		await expose();
		expect(shared('polite')?.textContent ?? '').toBe('');
		expect(shared('assertive')?.textContent).toBe('Search failed');
	});

	it('clears the region on an empty message', async () => {
		const announce = useAnnounce(REPLACE);
		announce('1 result');
		await expose();
		announce('');
		await expose();
		expect(shared()?.textContent ?? '').toBe('');
	});
});

describe('useAnnounce({hasReplace}) inside an Astryx modal (spec:AST-086 FR14)', () => {
	it('withdraws its unexposed message in the modal’s container', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'dialog-replace-typist' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		(screen.getByRole('button', { name: 'Type', exact: true }).element() as HTMLElement).click();
		await expose();
		expect(regionIn(dialog)?.textContent).toBe('Create "Urgent"');
		expect(shared()?.textContent ?? '').toBe('');
	});

	it('withdraws across the modal’s two containers', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'dialog-replace-typist-assertive' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		(screen.getByRole('button', { name: 'Type', exact: true }).element() as HTMLElement).click();
		await expose();
		expect(regionIn(dialog, 'polite')?.textContent ?? '').toBe('');
		expect(regionIn(dialog, 'assertive')?.textContent).toBe('Search failed');
	});

	it('leaves another announcer’s equal words in the container after its own message was exposed', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'dialog-count-other' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		(screen.getByRole('button', { name: 'Count', exact: true }).element() as HTMLElement).click();
		// Written, then taken by assistive technology a frame later.
		await expose();
		expect(regionIn(dialog)?.textContent).toBe('1 result');
		// The plain announcer's "1 result" is not the count's spoken one.
		(screen.getByRole('button', { name: 'Next', exact: true }).element() as HTMLElement).click();
		await expose();
		expect(regionIn(dialog)?.textContent).toBe('1 result 2 results');
	});

	it('takes back only its own share of words held while its sheet exits', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'sheet-exit-count-other' }
		});
		const sheet = screen.container.querySelector('dialog')!;
		await expose();
		// Focus is outside the sheet, so it goes inert from the close
		// (component:BottomSheet FR9).
		(document.activeElement as HTMLElement | null)?.blur();
		(screen.getByRole('button', { name: 'Done', exact: true }).element() as HTMLElement).click();
		await tick();
		// Open but inert and aria-hidden through its exit: the words are held
		// for the real close (reach the controls by element).
		expect(sheet).toHaveAttribute('inert');
		(screen.getByText('Both', { exact: true }).element() as HTMLElement).click();
		(screen.getByText('Next', { exact: true }).element() as HTMLElement).click();
		(sheet as HTMLDialogElement).close();
		await expose();
		// The plain announcer still holds "1 result"; the count's was taken back.
		expect(shared()?.textContent).toBe('1 result 2 results');
	});

	it('leaves words held later when its own held words were already delivered', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'dialog-count-other' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		// Out of the accessibility tree, as through an exit, and back.
		const setHidden = async (hidden: boolean) => {
			if (hidden) {
				dialog.setAttribute('aria-hidden', 'true');
			} else {
				dialog.removeAttribute('aria-hidden');
			}
			await expose();
		};
		await setHidden(true);
		(screen.getByText('Count', { exact: true }).element() as HTMLElement).click();
		// Exposed again: the held words are delivered and spoken.
		await setHidden(false);
		expect(regionIn(dialog)?.textContent).toBe('1 result');
		// Hidden again: the plain announcer's "1 result" is held now, and the
		// count's delivered one is not among the held words.
		await setHidden(true);
		(screen.getByText('Next', { exact: true }).element() as HTMLElement).click();
		await setHidden(false);
		expect(regionIn(dialog)?.textContent).toBe('1 result 2 results');
	});

	it('withdraws its message handed off as its Dialog leaves the accessibility tree, once the Dialog is back', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'dialog-count-other' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		// Written, then the Dialog leaves the tree before the words are exposed:
		// they are handed off, and held while the Dialog still covers the page.
		(screen.getByRole('button', { name: 'Count', exact: true }).element() as HTMLElement).click();
		dialog.setAttribute('aria-hidden', 'true');
		await tick();
		(screen.getByText('Recount', { exact: true }).element() as HTMLElement).click();
		dialog.removeAttribute('aria-hidden');
		await expose();
		expect(regionIn(dialog)?.textContent).toBe('2 results');
	});

	it('withdraws its message handed off as its sheet exits, once the sheet has closed', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'sheet-exit-count-other' }
		});
		const sheet = screen.container.querySelector('dialog')!;
		await expose();
		// Written, and the sheet starts its exit before the words are exposed.
		(screen.getByRole('button', { name: 'Count', exact: true }).element() as HTMLElement).click();
		// Focus is outside the sheet, so it goes inert from the close
		// (component:BottomSheet FR9).
		(document.activeElement as HTMLElement | null)?.blur();
		(screen.getByRole('button', { name: 'Done', exact: true }).element() as HTMLElement).click();
		await tick();
		expect(sheet).toHaveAttribute('inert');
		// The sheet's provider sees the exit and hands the words off.
		await tick();
		(screen.getByText('Recount', { exact: true }).element() as HTMLElement).click();
		(sheet as HTMLDialogElement).close();
		await expose();
		expect(shared()?.textContent).toBe('2 results');
	});

	it('withdraws its message handed to the entering step when its step is left before the words are exposed', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'dialog-exiting-step' }
		});
		await expose();
		// The count is written from step one, which closes in the same update
		// that opens step two, before the words are exposed.
		(screen.getByRole('button', { name: 'Count', exact: true }).element() as HTMLElement).click();
		(
			screen.getByRole('button', { name: 'Continue', exact: true }).element() as HTMLElement
		).click();
		// Step one's provider sees the close and hands the words to step two.
		await tick();
		const two = [...screen.container.querySelectorAll('dialog')].find(
			(dialog) => dialog.getAttribute('aria-label') === 'Two'
		)!;
		// The count's next message (step one's content stays mounted, closed)
		// takes back its words from step two, and is heard on the page.
		(screen.getByText('Recount', { exact: true }).element() as HTMLElement).click();
		await expose();
		expect(regionIn(two)?.textContent ?? '').toBe('');
		expect(shared()?.textContent).toBe('2 results');
	});

	it('withdraws its message handed to the page as its Dialog closes before the words are exposed', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'dialog-count-close' }
		});
		await expose();
		(screen.getByRole('button', { name: 'Count', exact: true }).element() as HTMLElement).click();
		(screen.getByRole('button', { name: 'Close', exact: true }).element() as HTMLElement).click();
		// The provider sees the close and hands the words to the page.
		await tick();
		// The count's next message (the closed Dialog's content stays mounted)
		// takes back its words from the page channel.
		(screen.getByText('Recount', { exact: true }).element() as HTMLElement).click();
		await expose();
		expect(shared()?.textContent).toBe('2 results');
	});

	it('withdraws its message redirected in the write frame when its Dialog stopped being exposed unseen', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'dialog-count-other' }
		});
		const dialog = screen.container.querySelector('dialog')!;
		await expose();
		const exposed: string[] = [];
		const record = new MutationObserver(() => {
			const text = shared()?.textContent ?? '';
			if (text !== '' && text !== exposed.at(-1)) {
				exposed.push(text);
			}
		});
		record.observe(document.body, {
			subtree: true,
			childList: true,
			characterData: true
		});
		(screen.getByRole('button', { name: 'Count', exact: true }).element() as HTMLElement).click();
		// No longer a modal, through no attribute its provider watches: the
		// write frame finds it unexposed and sends the words to the page.
		const matches = dialog.matches.bind(dialog);
		dialog.matches = ((selector: string) =>
			selector === ':modal' ? false : matches(selector)) as typeof dialog.matches;
		await nextFrame();
		(screen.getByText('Recount', { exact: true }).element() as HTMLElement).click();
		await nextFrame();
		await nextFrame();
		await nextFrame();
		record.disconnect();
		expect(exposed).toEqual(['2 results']);
	});

	it('withdraws a message deferred in the commit that presents the Dialog', async () => {
		const screen = await render(AnnounceModalHarness, {
			props: { scenario: 'dialog-opening-count' }
		});
		(screen.getByRole('button', { name: 'Open', exact: true }).element() as HTMLElement).click();
		const dialog = [...screen.container.querySelectorAll('dialog')].find(
			(candidate) => candidate.getAttribute('aria-label') === 'Edit'
		)!;
		await expose();
		expect(regionIn(dialog)?.textContent).toBe('2 results');
		expect(shared()?.textContent ?? '').toBe('');
	});
});
