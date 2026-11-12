/** PORTS: Drawer/DrawerDirection.test.tsx */

import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import DrawerDirectionProbe from './fixtures/drawer-direction-probe.svelte';
import drawerStyleSource from '$lib/components/drawer/drawer.stylex.ts?raw';

/**
 * Astryx's `Drawer/DrawerDirection.test.tsx`, all four declarations.
 *
 * Upstream reads a `translateX(±100%)` string out of jsdom's computed style;
 * a real browser resolves it to a matrix, so the rendered cases read the
 * matrix's horizontal translation and assert its sign. The source cases read
 * this port's `.stylex.ts` (a `.ts` module, not `.tsx`) but assert the same
 * declarations upstream parses out of the TSX object literal.
 */

/**
 * A closed panel is `display: none`, and a percentage translate of a
 * zero-width box is 0. Close a rendered panel with transitions off instead:
 * the target transform applies in the same tick, while the exit watcher's
 * backstop keeps the box in the layout long enough to read it.
 */
async function closedTranslation(screen: Awaited<ReturnType<typeof render>>): Promise<number> {
	await new Promise((resolve) => setTimeout(resolve, 20));
	screen.component.setOpen(false);
	await tick();
	const dialog = screen.container.querySelector('dialog');
	if (!(dialog instanceof HTMLDialogElement)) throw new Error('expected a drawer dialog');
	return new DOMMatrixReadOnly(getComputedStyle(dialog).transform).m41;
}

describe('Drawer direction', () => {
	it('uses a self-applied RTL direction', async () => {
		for (const side of ['start', 'end'] as const) {
			const screen = await render(DrawerDirectionProbe, { props: { side, dir: 'rtl' } });
			// start mirrors to +100%, end to -100% under RTL.
			const translation = await closedTranslation(screen);
			if (side === 'start') expect(translation).toBeGreaterThan(0);
			else expect(translation).toBeLessThan(0);
		}
	});

	it('honors a nearer LTR override inside an RTL page', async () => {
		for (const side of ['start', 'end'] as const) {
			const screen = await render(DrawerDirectionProbe, {
				props: { side, dir: 'ltr', pageDir: 'rtl' }
			});
			const translation = await closedTranslation(screen);
			if (side === 'start') expect(translation).toBeLessThan(0);
			else expect(translation).toBeGreaterThan(0);
		}
	});

	it('parks closed on the computed logical edge', () => {
		expect(drawerStyleSource).toMatch(
			/start:\s*\{[\s\S]*?transform:\s*\{[\s\S]*?default:\s*'translateX\(-100%\)'[\s\S]*?':dir\(rtl\)':\s*'translateX\(100%\)'/
		);
		expect(drawerStyleSource).toMatch(
			/end:\s*\{[\s\S]*?transform:\s*\{[\s\S]*?default:\s*'translateX\(100%\)'[\s\S]*?':dir\(rtl\)':\s*'translateX\(-100%\)'/
		);
	});

	it('starts opening from the same computed logical edge', () => {
		expect(drawerStyleSource).toMatch(
			/startOpen:\s*\{[\s\S]*?default:\s*'translateX\(0\)'[\s\S]*?'@starting-style':\s*\{[\s\S]*?default:\s*'translateX\(-100%\)'[\s\S]*?':dir\(rtl\)':\s*'translateX\(100%\)'/
		);
		expect(drawerStyleSource).toMatch(
			/endOpen:\s*\{[\s\S]*?default:\s*'translateX\(0\)'[\s\S]*?'@starting-style':\s*\{[\s\S]*?default:\s*'translateX\(100%\)'[\s\S]*?':dir\(rtl\)':\s*'translateX\(-100%\)'/
		);
	});
});
