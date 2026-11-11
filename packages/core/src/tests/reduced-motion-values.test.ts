/** PORTS: motion/reducedMotionValues.test.ts */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reducedMotionFadeConsts, reducedMotionKeys } from '$lib/motion/reduced-motion.stylex.js';

/**
 * Astryx's `motion/reducedMotionValues.test.ts`, ported case for case — one
 * `it` on both sides.
 *
 * A swizzled component cannot import the internal `reduced-motion.stylex.ts`,
 * so it spells the cross-fade's values; this keeps them one definition. The
 * cap arm is `min(<duration token>, 200ms)`, which ClickableCard,
 * SelectableCard and Thumbnail each carry.
 *
 * A **server** file, as upstream's is: it reads source off disk.
 */

const SRC_DIR = resolve(__dirname, '../lib');

describe("the cross-fade's values spelled in components", () => {
	it('equal reducedMotionFadeConsts wherever a fade arm spells them', () => {
		const arm = new RegExp(
			`'${reducedMotionKeys.fade.replace(/[()]/g, '\\$&')}':\\s*'([^']*)'`,
			'g'
		);
		// A theme duration capped under Reduce Motion is capped at the
		// cross-fade's bound: `min(<duration token>, <cap>)`.
		const capped = /`min\(\$\{durationVars\['--duration-[a-z-]+'\]\},\s*([\d.]+m?s)\)`/g;
		const spelled: string[] = [];
		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const path = join(dir, entry.name);
				if (entry.isDirectory()) {
					if (entry.name !== 'node_modules' && entry.name !== '__tests__') {
						walk(path);
					}
				} else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec|stories)\.tsx?$/.test(entry.name)) {
					const source = readFileSync(path, 'utf8');
					for (const match of source.matchAll(capped)) {
						const where = `${path.slice(SRC_DIR.length)}: ${match[0]}`;
						spelled.push(where);
						if (match[1].trim() !== reducedMotionFadeConsts.duration) {
							offenders.push(where);
						}
					}
					for (const match of source.matchAll(arm)) {
						const value = match[1];
						const where = `${path.slice(SRC_DIR.length)}: ${value}`;
						// A zero duration applies a change at once; it is not a fade.
						if (/^[\d.]+m?s$/.test(value) && parseFloat(value) !== 0) {
							spelled.push(where);
							if (value !== reducedMotionFadeConsts.duration) {
								offenders.push(where);
							}
						} else if (value.startsWith('cubic-bezier')) {
							spelled.push(where);
							if (value !== reducedMotionFadeConsts.easing) {
								offenders.push(where);
							}
						}
					}
				}
			}
		};
		walk(SRC_DIR);
		// A pattern that stopped matching would pass with nothing checked.
		expect(spelled.length).toBeGreaterThan(0);
		expect(offenders).toEqual([]);
	});
});
