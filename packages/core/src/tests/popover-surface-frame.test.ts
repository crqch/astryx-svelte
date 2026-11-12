/** PORTS: Popover/popoverSurfaceFrame.test.ts */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { popover } from '$lib/motion/uikit/popover.js';
import { expandMotionScale } from '$lib/theme/expand-motion-scale.js';
import {
	POPOVER_ENTRANCE_TOKENS,
	POPOVER_EXIT_TOKENS
} from '$lib/components/popover/popover-surface-frame.js';

/**
 * Ported from Astryx's `Popover/popoverSurfaceFrame.test.ts` — both cases.
 *
 * The Storybook theme is this repo's neutral theme, whose source file is
 * `packages/themes/neutral/src/neutral-theme.ts`; the motion-scale regex
 * tolerates the spaces this file's formatter puts after the brace.
 */

// The Storybook theme (neutral) declares its motion scale in its own source.
const NEUTRAL_SOURCE = fs.readFileSync(
	path.resolve(__dirname, '../../../themes/neutral/src/neutral-theme.ts'),
	'utf8'
);
const MOTION_LINE = NEUTRAL_SOURCE.split('\n').find((line) => line.trim().startsWith('motion:'));
const SCALE =
	MOTION_LINE == null
		? null
		: /fast: (\d+), medium: (\d+), slow: (\d+), ratio: ([\d.]+)/.exec(MOTION_LINE);
if (SCALE == null) {
	throw new Error('the neutral theme declares no motion scale');
}
const NEUTRAL = expandMotionScale({
	fast: Number(SCALE[1]),
	medium: Number(SCALE[2]),
	slow: Number(SCALE[3]),
	ratio: Number(SCALE[4])
});

/** The neutral theme's duration token whose value is nearest `ms`. */
function nearestNeutral(ms: number): string {
	const gap = (value: string) => Math.abs(Number.parseFloat(value) - ms);
	const [[token]] = Object.entries(NEUTRAL)
		.filter(([name]) => name.startsWith('--duration-'))
		.sort(([, a], [, b]) => gap(a) - gap(b));
	return token;
}

describe('popover timing tokens', () => {
	it('grows on --duration-medium-min, 225 ms in the Storybook theme, the step nearest iOS’s 206 ms growth', () => {
		expect(popover.growMs).toBe(206);
		expect(NEUTRAL['--duration-medium-min']).toBe('225ms');
		expect(nearestNeutral(popover.growMs)).toBe('--duration-medium-min');
		expect(POPOVER_ENTRANCE_TOKENS).toEqual({
			duration: '--duration-medium-min',
			easing: '--ease-entrance'
		});
	});

	it('shrinks on the theme’s exit duration and easing, which every overlay shares, keeping iOS’s 249 ms shrink as a reference', () => {
		expect(popover.shrinkMs).toBe(249);
		expect(POPOVER_EXIT_TOKENS).toEqual({
			duration: '--duration-exit',
			easing: '--ease-exit'
		});
	});
});
