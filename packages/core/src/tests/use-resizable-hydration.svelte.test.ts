/** PORTS: Resizable/useResizable.test.ts */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hydrate, unmount } from 'svelte';
import Fixture from './fixtures/use-resizable-hydration-fixture.svelte';

/**
 * The two server-side cases of Astryx's `Resizable/useResizable.test.ts` at the
 * 0.7.13 pin, split out of `use-resizable.svelte.test.ts` because they need a
 * real SSR render rather than a client mount:
 *
 * - `uses the deterministic 1200px server basis`
 * - `hydrates a container default without persisting the temporary basis`
 *
 * Upstream calls `renderToString` and `hydrateRoot` in one jsdom process. Here
 * the markup comes from the Vite dev server's SSR module graph
 * (`/__ssr-fixture`), the same mechanism `tab-list-hydration.svelte.test.ts`
 * uses, and `hydrate()` adopts it in the browser project. The fixture is the
 * same real region in both runs: its container is null while the server
 * renders, then `bind:this` fills it before hydration's effects.
 *
 * `onSizeChange` is counted inside the fixture and rendered as
 * `data-size-changes`, since a callback cannot cross the SSR fixture's JSON
 * props. Its React-only `onRecoverableError` / console-error assertions have no
 * Svelte counterpart; Svelte reports a failed walk through `console.error`,
 * which this file captures the same way the hydration precedent does.
 */

async function serverRender(props: Record<string, unknown> = {}): Promise<string> {
	const query = new URLSearchParams({
		module: '/src/tests/fixtures/use-resizable-hydration-fixture.svelte',
		props: JSON.stringify(props)
	});
	const response = await fetch(`/__ssr-fixture?${query}`);
	const payload = await response.json();
	if (!response.ok) throw new Error(`SSR render failed: ${payload.error}`);
	return payload.body as string;
}

let cleanup: (() => void) | null = null;

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	cleanup?.();
	cleanup = null;
});

describe('useResizable server render and hydration', () => {
	it('uses the deterministic 1200px server basis', async () => {
		const body = await serverRender();
		// 40% of the server basis, floored by the pixel minimum.
		expect(body).toContain('data-size="480"');
	});

	it('hydrates a container default without persisting the temporary basis', async () => {
		const serverHtml = await serverRender();
		expect(serverHtml).toContain('data-size="480"');

		const target = document.createElement('div');
		target.innerHTML = serverHtml;
		document.body.appendChild(target);

		const errors: unknown[] = [];
		const consoleError = console.error;
		console.error = (...args: unknown[]) => {
			errors.push(args[0]);
		};
		let component: Record<string, unknown> | null = null;
		try {
			component = hydrate(Fixture, {
				target,
				props: { autoSaveId: 'structured-hydration' }
			}) as Record<string, unknown>;
		} finally {
			console.error = consoleError;
		}
		cleanup = () => {
			if (component) unmount(component);
			target.remove();
		};

		const output = target.querySelector('output') as HTMLElement;
		await expect.poll(() => output.getAttribute('data-size')).toBe('333');

		const messages = errors.map((error) => String(error)).join('\n');
		expect(messages).not.toContain('Failed to hydrate');

		// The basis measurement corrects the size but is not an interaction.
		expect(output.getAttribute('data-size-changes')).toBe('0');
		expect(localStorage.getItem('astryx-resizable:structured-hydration')).toBe(
			JSON.stringify({ size: 333, isCollapsed: false })
		);
	});
});
