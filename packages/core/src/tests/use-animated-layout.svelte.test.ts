/** PORTS: motion/animatedLayoutAdopters.test.tsx */

import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HookProbe from './fixtures/animated-layout-hook-probe.svelte';

/**
 * Astryx's `motion/animatedLayoutAdopters.test.tsx`, the `useAnimatedLayout`
 * declaration. The component-adoption declarations need Collapsible and
 * TreeList wired to the layout handle and an exit hold; that remains in
 * `port/debts.md`.
 */

describe('useAnimatedLayout', () => {
	it('returns the same member-free handle on every render', async () => {
		// Svelte has no render function to rerun: the handle is created at
		// initialisation, so a rerender by definition keeps it.
		const screen = await render(HookProbe);
		const first = screen.component.getLayout();
		expect(Object.keys(first)).toEqual([]);
		await screen.rerender({});
		expect(screen.component.getLayout()).toBe(first);
	});
});
