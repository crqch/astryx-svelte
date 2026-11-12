/** PORTS: Drawer/Drawer.ssr.test.tsx */

import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import Drawer from '$lib/components/drawer/drawer.svelte';

/**
 * Astryx's `Drawer/Drawer.ssr.test.tsx`, server half — the markup contract.
 *
 * Two of the three upstream cases exercise React hydration, which Svelte does
 * differently: the client half lives in `drawer-ssr.svelte.test.ts`. What can
 * be asserted without a browser is the invariant both of those cases depend
 * on, and the one upstream asserts first: an open Drawer's server markup is
 * byte-for-byte a closed Drawer's markup, with no `aria-modal` and no `open`.
 */
describe('Drawer: open on the server (FR17)', () => {
	it('renders closed on the server: no aria-modal and the same classes as a closed Drawer', () => {
		const children = createRawSnippet(() => ({ render: () => '<p>Drawer body</p>' }));
		const open = render(Drawer, {
			props: { isOpen: true, onOpenChange: () => {}, label: 'Filters', children }
		}).body;
		const closed = render(Drawer, {
			props: { isOpen: false, onOpenChange: () => {}, label: 'Filters', children }
		}).body;
		const dialogMarkup = (markup: string) => {
			const match = /<dialog[^>]*>/.exec(markup);
			if (match == null) throw new Error('no <dialog> in the server markup');
			return match[0];
		};
		const classAttribute = (tag: string) => /class="([^"]*)"/.exec(tag)?.[1] ?? '';

		const openTag = dialogMarkup(open);
		expect(openTag).not.toContain('aria-modal');
		expect(openTag).not.toMatch(/\sopen(?:[\s>=])/);
		expect(classAttribute(openTag)).toBe(classAttribute(dialogMarkup(closed)));
	});
});
