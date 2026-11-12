/** PORTS: hooks/useAnnounceRenderedText.test.tsx */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { renderedText } from '$lib/hooks/use-announce-rendered-text.svelte.js';
import AnnounceRenderedCases from './fixtures/announce-rendered-cases.svelte';
import AnnounceRenderedBlocks from './fixtures/announce-rendered-blocks.svelte';
import AnnounceRenderedInline from './fixtures/announce-rendered-inline.svelte';

/**
 * Ported from Astryx's `hooks/useAnnounceRenderedText.test.tsx` at the 0.7.13
 * pin.
 *
 * Upstream replaces `useAnnounce` with a module spy (`vi.mock`) so the hook's
 * default channel is observed. A Svelte component cannot be authored inside a
 * case, so the same spy is handed to the hook's `announce` option through the
 * probe fixture: the assertions are about which text is chosen and when, which
 * is what the four cases and the two `renderedText` cases cover. The default
 * channel itself is covered by `announce.svelte.test.ts` and the replace/modal
 * suites.
 */

const announce = vi.fn();

beforeEach(() => {
	announce.mockClear();
});

describe('useAnnounceRenderedText text priority', () => {
	it('prefers rendered text over referenced and fallback names', async () => {
		await render(AnnounceRenderedCases, {
			props: { scenario: 'rendered', announceFn: announce }
		});
		await vi.waitFor(() => {
			expect(announce).toHaveBeenCalledExactlyOnceWith('Fetching records', 'polite');
		});
	});

	it('prefers referenced text in ID order over the fallback', async () => {
		await render(AnnounceRenderedCases, {
			props: { scenario: 'referenced', announceFn: announce }
		});
		await vi.waitFor(() => {
			expect(announce).toHaveBeenCalledExactlyOnceWith('Uploading files', 'polite');
		});
	});

	it('uses the fallback when rendered and referenced text are unavailable', async () => {
		await render(AnnounceRenderedCases, {
			props: { scenario: 'fallback', announceFn: announce }
		});
		await vi.waitFor(() => {
			expect(announce).toHaveBeenCalledExactlyOnceWith('Loading', 'polite');
		});
	});

	it('keeps empty content silent when no fallback is provided', async () => {
		await render(AnnounceRenderedCases, {
			props: { scenario: 'silent', announceFn: announce }
		});
		await tick();
		expect(announce).not.toHaveBeenCalled();
	});
});

describe('renderedText reads block boxes apart (AST-086 FR7)', () => {
	it('separates the inline children of a flex or grid stack, as the layout blockifies them', async () => {
		const screen = await render(AnnounceRenderedBlocks);
		const target = screen.container.firstElementChild as HTMLElement;
		expect(renderedText(target)).toBe('Fetching data This may take a moment One Two');
	});

	it('keeps inline runs together and still skips hidden parts', async () => {
		const screen = await render(AnnounceRenderedInline);
		const target = screen.container.firstElementChild as HTMLElement;
		expect(renderedText(target)).toBe('Saving 3 files');
	});
});
