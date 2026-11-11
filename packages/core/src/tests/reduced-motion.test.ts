/** PORTS: motion/reducedMotion.test.ts */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeAnimate } from './fake-web-animation.js';
import {
	REDUCED_MOTION_FADE_QUERY,
	REDUCED_MOTION_INSTANT_QUERY,
	playReducedMotionDip,
	reducedMotionFade
} from '$lib/motion/reduced-motion.js';
import { reducedMotionFadeConsts, reducedMotionKeys } from '$lib/motion/reduced-motion.stylex.js';
import { timing } from '$lib/motion/uikit/timing.js';

/**
 * Astryx's `motion/reducedMotion.test.ts`, ported case for case — 14 `it`
 * declarations on both sides, in upstream's order and under upstream's titles.
 *
 * One translation, no dropped case. Upstream runs in jsdom and so creates a
 * `document.createElement('div')` for `playReducedMotionDip`; this port's
 * server project is Node, where `playReducedMotionDip` only ever calls
 * `element.animate`. A plain object carrying the fake `animate` is therefore
 * the same subject, and `reducedMotionFade` is called with no element except
 * in the private-attributes suite, which has a real browser DOM.
 *
 * The last three cases walk this package's sources: the CSS side must spell
 * the same values the TypeScript side returns, and every Reduce Motion media
 * key that splits on pointer must be one of the two shared literals. They make
 * this a guard as well as a unit test, exactly as upstream's are.
 */

const SRC_DIR = resolve(__dirname, '../lib');

/** The person's settings, through `matchMedia`: no option overrides them. */
function settings(reduced: boolean, coarse: boolean) {
	vi.stubGlobal('window', {
		matchMedia: (query: string) => ({
			matches: query.includes('prefers-reduced-motion')
				? reduced
				: query.includes('pointer: coarse')
					? coarse
					: false,
			media: query
		})
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('reducedMotionFade', () => {
	it('is null when motion is not reduced', () => {
		settings(false, true);
		expect(reducedMotionFade(null)).toBeNull();
	});

	it('fades 200 ms at most on easeInOut on a coarse pointer', () => {
		settings(true, true);
		const fade = reducedMotionFade(null);
		expect(fade).toEqual({
			duration: timing.reducedMotionCrossFadeMs,
			easing: 'cubic-bezier(0.42, 0, 0.58, 1)'
		});
		expect(fade?.duration).toBeGreaterThan(0);
		expect(fade?.duration).toBeLessThanOrEqual(200);
	});

	it('completes at once on any other pointer, unless a touch release started it', () => {
		settings(true, false);
		expect(reducedMotionFade(null)).toEqual({ duration: 0, easing: 'linear' });
		expect(reducedMotionFade(null, { touchRelease: true })?.duration).toBe(
			timing.reducedMotionCrossFadeMs
		);
	});
});

describe('playReducedMotionDip', () => {
	const fade = { duration: 200, easing: 'cubic-bezier(0.42, 0, 0.58, 1)' };

	function startDip(from?: number) {
		const { animate, animations } = fakeAnimate();
		const element = { animate } as unknown as Element;
		const land = vi.fn();
		const dip = playReducedMotionDip(element, fade, land, from);
		return { animations, land, dip };
	}

	it('fades out over half the fade, and holds at 0 until the change lands', () => {
		const { animations } = startDip();
		expect(animations).toHaveLength(1);
		const [fadeOut] = animations;
		expect(fadeOut.keyframes.map((frame) => frame.opacity)).toEqual([1, 0]);
		expect(fadeOut.keyframes[0].easing).toBe(fade.easing);
		expect(fadeOut.options).toMatchObject({ duration: 100, fill: 'forwards' });
	});

	it('lands the change when the fade-out ends, however late, and never on a timer', async () => {
		vi.useFakeTimers();
		try {
			const { animations, land } = startDip();
			// A main thread held far past the middle: no timer lands the change.
			vi.advanceTimersByTime(10_000);
			expect(land).not.toHaveBeenCalled();
			animations[0].finish();
			await Promise.resolve();
			expect(land).toHaveBeenCalledOnce();
		} finally {
			vi.useRealTimers();
		}
	});

	it('fades back in only after the change, from 0, over the other half', async () => {
		const { animations, land } = startDip();
		land.mockImplementation(() => {
			// The fade-in has not started while the change lands.
			expect(animations).toHaveLength(1);
		});
		animations[0].finish();
		await Promise.resolve();
		expect(land).toHaveBeenCalledOnce();
		expect(animations).toHaveLength(2);
		const fadeIn = animations[1];
		expect(fadeIn.keyframes.map((frame) => frame.opacity)).toEqual([0, 1]);
		expect(fadeIn.keyframes[0].easing).toBe(fade.easing);
		expect(fadeIn.options).toMatchObject({ duration: 100 });
		// The fade-in holds the opacity now, so the held 0 goes.
		expect(animations[0].cancel).toHaveBeenCalled();
	});

	/** A dip whose fade-out started at 1000 ms, and the clock its landing reads. */
	async function landAt(clockAfterLanding: number) {
		const clock = vi.spyOn(performance, 'now').mockReturnValue(1100);
		const { animate, animations } = fakeAnimate();
		const element = { animate } as unknown as Element;
		// The landing's own work moves the clock.
		playReducedMotionDip(element, fade, () => {
			clock.mockReturnValue(clockAfterLanding);
		});
		animations[0].animation.startTime = 1000;
		animations[0].finish();
		await Promise.resolve();
		clock.mockRestore();
		return animations;
	}

	it('starts the fade-in where the fade-out ended, counting the landing', async () => {
		// Due at 1100 ms; the landing ran until 1140 ms. The fade-in is 40 ms in.
		const animations = await landAt(1140);
		expect(animations[1].animation.startTime).toBe(1100);
	});

	it('starts an on-time fade-in on time, and after a long stall still plays half of it', async () => {
		expect((await landAt(1100))[1].animation.startTime).toBe(1100);
		const stalled = await landAt(1500);
		expect(stalled[1].animation.startTime).toBe(1450);
		// That start is after the frame that runs the landing: until then, the
		// fade-in holds 0, so the change does not show.
		expect(stalled[1].options).toMatchObject({ fill: 'backwards' });
	});

	it('leaves a fade-in to start on its own when the fade-out has no start time', async () => {
		const { animations } = startDip();
		animations[0].finish();
		await Promise.resolve();
		expect(animations[1].animation.startTime).toBeNull();
	});

	it('starts the fade-out where the element is (DR2)', () => {
		const { animations } = startDip(0.5);
		expect(animations[0].keyframes.map((frame) => frame.opacity)).toEqual([0.5, 0]);
	});

	it('lands nothing once cancelled, and stops both fades', async () => {
		const { animations, land, dip } = startDip();
		dip.cancel();
		expect(animations[0].cancel).toHaveBeenCalled();
		animations[0].finish();
		await Promise.resolve();
		expect(land).not.toHaveBeenCalled();
		expect(animations).toHaveLength(1);
	});
});

describe('the CSS side of the policy', () => {
	it('holds the same fade as the table', () => {
		expect(reducedMotionFadeConsts.duration).toBe(`${timing.reducedMotionCrossFadeMs}ms`);
		expect(reducedMotionFadeConsts.easing).toBe(`cubic-bezier(${timing.curves.move.join(', ')})`);
	});

	it('spells the two media keys from the queries', () => {
		expect(reducedMotionKeys.fade).toBe(`@media ${REDUCED_MOTION_FADE_QUERY}`);
		expect(reducedMotionKeys.instant).toBe(`@media ${REDUCED_MOTION_INSTANT_QUERY}`);
	});

	it('every key that splits Reduce Motion by pointer is one of the two constants, spelled exactly', () => {
		const allowed = new Set<string>([reducedMotionKeys.fade, reducedMotionKeys.instant]);
		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const path = join(dir, entry.name);
				if (entry.isDirectory()) {
					if (entry.name !== 'node_modules' && entry.name !== '__tests__') {
						walk(path);
					}
				} else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec|stories)\.tsx?$/.test(entry.name)) {
					for (const match of readFileSync(path, 'utf8').matchAll(
						/'(@media[^']*prefers-reduced-motion: reduce[^']*pointer[^']*)'/g
					)) {
						if (!allowed.has(match[1])) {
							offenders.push(`${path.slice(SRC_DIR.length)}: ${match[1]}`);
						}
					}
					// A constant as a computed key lands in a later priority layer.
					if (
						!/[/\\]motion[/\\]reduced-motion\.ts$/.test(path) &&
						/\[reducedMotionKeys\.(fade|instant)\]/.test(readFileSync(path, 'utf8'))
					) {
						offenders.push(`${path.slice(SRC_DIR.length)}: a computed reducedMotionKeys key`);
					}
				}
			}
		};
		walk(SRC_DIR);
		expect(offenders).toEqual([]);
	});
});
