/** PORTS: privateAttributes/reducedMotion.test.tsx */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { reducedMotionFade } from '$lib/motion/reduced-motion.js';
import { timing } from '$lib/motion/uikit/timing.js';
import { themeReducesMotion } from '$lib/private-attributes/reduced-motion.js';

/**
 * Astryx's `privateAttributes/reducedMotion.test.tsx`, ported case for case —
 * five `it` declarations (three for the reader, two for the fade under the
 * mark) on both sides.
 *
 * Re-homed from upstream's jsdom project to this port's **client** project,
 * which is a real Chromium page: that is the DOM these cases need, and the
 * server project has none. No case is dropped; the `document.body` cleanup is
 * upstream's own.
 */

const MARK = 'data-astryx-reduced-motion';

/** The person's settings: Reduce Motion off. */
function settings(coarse: boolean) {
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query.includes('pointer: coarse') ? coarse : false,
		media: query
	}));
}

function inTheme(marked: boolean) {
	const theme = document.createElement('div');
	if (marked) {
		theme.setAttribute(MARK, '');
	}
	const element = document.createElement('span');
	theme.append(element);
	document.body.append(theme);
	return element;
}

afterEach(() => {
	document.body.replaceChildren();
	document.documentElement.removeAttribute(MARK);
	vi.unstubAllGlobals();
});

describe('themeReducesMotion', () => {
	it('reads the mark on an ancestor', () => {
		expect(themeReducesMotion(inTheme(true))).toBe(true);
		expect(themeReducesMotion(inTheme(false))).toBe(false);
	});

	it('reads the mark on <html>, for a layer portaled outside the theme', () => {
		const layer = document.createElement('div');
		document.body.append(layer);
		expect(themeReducesMotion(layer)).toBe(false);
		document.documentElement.setAttribute(MARK, '');
		expect(themeReducesMotion(layer)).toBe(true);
	});

	it('is false without an element', () => {
		expect(themeReducesMotion(null)).toBe(false);
		expect(themeReducesMotion(undefined)).toBe(false);
	});
});

describe('reducedMotionFade under the mark', () => {
	it('counts the mark as the setting', () => {
		settings(true);
		expect(reducedMotionFade(inTheme(false))).toBeNull();
		expect(reducedMotionFade(inTheme(true))?.duration).toBe(timing.reducedMotionCrossFadeMs);
	});

	it('completes at once on a fine pointer', () => {
		settings(false);
		expect(reducedMotionFade(inTheme(true))).toEqual({ duration: 0, easing: 'linear' });
	});
});
