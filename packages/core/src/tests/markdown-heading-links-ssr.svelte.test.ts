/** PORTS: Markdown/plugins/headingLinks.ssr.test.tsx */

import { afterEach, describe, expect, it } from 'vitest';
import { hydrate, unmount } from 'svelte';
import HeadingLinksSsr from './fixtures/markdown-heading-links-ssr-fixture.svelte';
import HeadingLinksSsrInvalid from './fixtures/markdown-heading-links-ssr-invalid-fixture.svelte';

/**
 * Astryx's `Markdown/plugins/headingLinks.ssr.test.tsx`, ported case for case.
 *
 * Upstream calls `renderToString` and then `hydrateRoot` in the same process.
 * Svelte compiles a `.svelte` file for exactly one target per module graph, so
 * this project obtains real server markup from the dev server's
 * `/__ssr-fixture` endpoint (the `tab-list-hydration` precedent) and hydrates it
 * with `hydrate()`. That is the same mechanism — server markup, then the
 * client's own hydration walk — not a client-rendered snapshot standing in.
 *
 * Hydration failures are logged rather than thrown, so `console.error` is
 * captured and searched for a hydration report, as upstream searches React's
 * errors. Svelte has no `onRecoverableError` channel; the same claim is the
 * absence of any hydration error in that capture.
 */

interface SsrPayload {
	body: string;
	error?: string;
}

/**
 * Server-render a fixture through the Vite dev server's SSR module graph.
 *
 * A cold SSR compile of the Markdown tree can take >20 s under CI load; let the
 * test's own timeout govern the request rather than aborting prematurely and
 * stacking a second compile behind the first.
 */
async function serverRender(module: string, props: Record<string, unknown> = {}): Promise<string> {
	const query = new URLSearchParams({ module, props: JSON.stringify(props) });
	const response = await fetch(`/__ssr-fixture?${query}`);
	const payload = (await response.json()) as SsrPayload;
	if (!response.ok) throw new Error(`SSR render failed: ${payload.error}`);
	return payload.body;
}

const VALID_FIXTURE = '/src/tests/fixtures/markdown-heading-links-ssr-fixture.svelte';
const INVALID_FIXTURE = '/src/tests/fixtures/markdown-heading-links-ssr-invalid-fixture.svelte';

let cleanup: (() => void) | null = null;

afterEach(() => {
	cleanup?.();
	cleanup = null;
});

function mountServerMarkup(body: string): HTMLElement {
	const target = document.createElement('div');
	target.innerHTML = body;
	document.body.appendChild(target);
	return target;
}

function headingIds(root: HTMLElement): Array<string | null> {
	return Array.from(root.querySelectorAll('h1,h2')).map((heading) => heading.getAttribute('id'));
}

describe('Markdown heading links — SSR', () => {
	// SSR plus a real hydration walk; cold SSR compilation can be slow under CI load.
	it(
		'keeps duplicate-copy ids and buttons stable across SSR and hydration',
		{ timeout: 90_000 },
		async () => {
			const serverHTML = await serverRender(VALID_FIXTURE);
			expect(serverHTML).toContain('id="article-a--overview"');
			expect(serverHTML).toContain('id="article-b--overview"');
			expect(serverHTML).toContain('aria-label="Copy link to Details"');
			expect(serverHTML).not.toContain('href="#article-');

			const target = mountServerMarkup(serverHTML);
			const before = headingIds(target);

			const errors: string[] = [];
			const consoleError = console.error;
			console.error = (...args: unknown[]) => {
				errors.push(args.map(String).join(' '));
			};

			let component: Record<string, unknown> | null = null;
			try {
				component = hydrate(HeadingLinksSsr, { target }) as Record<string, unknown>;
			} finally {
				console.error = consoleError;
			}

			cleanup = () => {
				if (component) unmount(component);
				target.remove();
			};

			expect(errors.filter((message) => message.toLowerCase().includes('hydrat'))).toEqual([]);
			const after = headingIds(target);
			expect(after).toEqual(before);
			expect(new Set(before).size).toBe(before.length);
		}
	);

	it(
		'fails soft across SSR and hydration for unsupported same-name entries',
		{ timeout: 90_000 },
		async () => {
			const serverHTML = await serverRender(INVALID_FIXTURE);
			const target = mountServerMarkup(serverHTML);
			const headings = Array.from(target.querySelectorAll('h1,h2'));

			expect(headings).toHaveLength(2);
			expect(headings[0]).toHaveAttribute('id', 'overview');
			expect(headings[1]).not.toHaveAttribute('id');
			expect(target.querySelector('button, a[href*="#"]')).toBeNull();

			const errors: string[] = [];
			const consoleError = console.error;
			console.error = (...args: unknown[]) => {
				errors.push(args.map(String).join(' '));
			};

			let component: Record<string, unknown> | null = null;
			try {
				component = hydrate(HeadingLinksSsrInvalid, { target }) as Record<string, unknown>;
			} finally {
				console.error = consoleError;
			}

			cleanup = () => {
				if (component) unmount(component);
				target.remove();
			};

			expect(errors.filter((message) => message.toLowerCase().includes('hydrat'))).toEqual([]);
			expect(headingIds(target)).toEqual(['overview', null]);
		}
	);
});
