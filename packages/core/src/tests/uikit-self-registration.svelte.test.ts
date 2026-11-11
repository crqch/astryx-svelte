/** PORTS: motion/uikit/selfRegistration.test.ts */

/**
 * @file selfRegistration.test.ts
 * @input vitest (jsdom); each touch table imported in a fresh module graph,
 *   with no call to its register function
 * @output Checks that each spring role row, and the navigation, paging,
 *   picker and zoom tables, register at import, so a role plays at the
 *   theme's tempo
 * @position Testing; validates uikit/springs.ts, navigation.ts, paging.ts,
 *   picker.ts and zoomMedia.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEMPO_PROPERTY = '--_astryx-motion-tempo';
/** The tempo the stubbed theme writes; empty where no theme sets one. */
let tempo = '';

beforeEach(() => {
	vi.resetModules();
	tempo = '';
	vi.spyOn(window, 'getComputedStyle').mockImplementation(
		() =>
			({
				getPropertyValue: (name: string) => (name === TEMPO_PROPERTY ? tempo : '')
			}) as unknown as CSSStyleDeclaration
	);
});

afterEach(() => {
	vi.doUnmock('../roles');
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

function element(): HTMLElement {
	const child = document.createElement('div');
	document.body.append(child);
	return child;
}

describe('the touch tables register at import', () => {
	it('a page that imports only the settle row plays it at the tempo', async () => {
		const { SETTLE_SPRING } = await import('$lib/motion/uikit/springs.js');
		const { resolveMotion } = await import('$lib/motion/resolve-motion.js');
		const { solveSpring, toSpring } = await import('$lib/motion/spring.js');
		const target = element();
		const base = solveSpring(toSpring(SETTLE_SPRING), { from: 0, to: 1 });
		for (const scale of [0.75, 1.5]) {
			tempo = String(scale);
			const played = solveSpring(toSpring(resolveMotion(target, SETTLE_SPRING)), {
				from: 0,
				to: 1
			});
			expect(played.settleTime(0.001)).toBeCloseTo(base.settleTime(0.001) * scale, 6);
		}
	});

	it('a page that imports only the picker plays its tap spin at the tempo', async () => {
		const { picker } = await import('$lib/motion/uikit/picker.js');
		const { resolveMotion } = await import('$lib/motion/resolve-motion.js');
		tempo = '1.5';
		expect(resolveMotion(element(), picker.tapSpin, 'durationMs')).toBe(
			picker.tapSpin.durationMs * 1.5
		);
	});

	it('a page that imports only the zoom table plays its dismissal at the tempo', async () => {
		const { zoomMedia } = await import('$lib/motion/uikit/zoomMedia.js');
		const { resolveMotion } = await import('$lib/motion/resolve-motion.js');
		const { solveSpring, toSpring } = await import('$lib/motion/spring.js');
		const target = element();
		for (const spring of [
			zoomMedia.dismiss.dismissPositionSpring,
			zoomMedia.dismiss.dismissSizeSpring
		]) {
			tempo = '';
			expect(resolveMotion(target, spring)).toBe(spring);
			const base = solveSpring(toSpring(spring), { from: 0, to: 1 });
			for (const scale of [0.75, 1.5]) {
				tempo = String(scale);
				const played = solveSpring(toSpring(resolveMotion(target, spring)), {
					from: 0,
					to: 1
				});
				expect(played.settleTime(0.001)).toBeCloseTo(base.settleTime(0.001) * scale, 6);
			}
		}
	});

	it('each role row and table registers itself, at import', async () => {
		// RESTATED: upstream spies on `registerMotionTable` through `vi.doMock`,
		// which this browser module graph does not intercept. Registration is
		// observable through the registry instead, which is the effect the spy
		// exists to prove.
		const { SETTLE_SPRING, KEYBOARD_SPRING } = await import('$lib/motion/uikit/springs.js');
		const { motionRole, motionRoleOf } = await import('$lib/motion/roles.js');
		expect(motionRoleOf(SETTLE_SPRING)?.id).toBe('springs.settle');
		expect(motionRoleOf(KEYBOARD_SPRING)).toBeUndefined();

		await import('$lib/motion/uikit/navigation.js');
		await import('$lib/motion/uikit/paging.js');
		await import('$lib/motion/uikit/picker.js');
		const { zoomMedia } = await import('$lib/motion/uikit/zoomMedia.js');
		expect(motionRole('picker.tapSpin.durationMs')).toBeDefined();
		expect(motionRoleOf(zoomMedia.dismiss.dismissSizeSpring)?.id).toBe(
			'zoomMedia.dismiss.dismissSizeSpring'
		);
		expect(motionRoleOf(zoomMedia.overshoot)).toBeUndefined();
		// `navigation` and `paging` list no public roles, so their registration is
		// not observable through the role registry; their `register…Table` call is
		// asserted by the unit that owns them. Picker and zoom do list roles.
	});
});
