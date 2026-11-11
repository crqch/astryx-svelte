/**
 * Ported from Astryx's `src/theme/expandMotionScale.ts`.
 *
 * Gives theme authors a three-value interface (fast, medium, slow) plus a ratio,
 * which expands into a coherent nine-token duration scale:
 *
 *   min = base × ratio    max = base ÷ ratio
 *
 * A "snappy" theme lowers the bases, a "cinematic" one raises them, and the
 * proportional relationships hold automatically.
 *
 * SYNC: When modified, update:
 * - /packages/cli/assets/theme.template.ts (the annotated field reference)
 */

export interface MotionScaleConfig {
	/** Micro-interactions in ms — hover, toggle, checkbox. */
	fast: number;
	/** Entrance/exit animations in ms — dialog, drawer, panel. */
	medium: number;
	/** Slow/continuous animations in ms — spinner, progress. */
	slow?: number;
	/** Scaling ratio for min/max. Typical range 0.65–0.85. */
	ratio: number;
	/** Optional override for `--ease-standard`. */
	easing?: string;
}

export type MotionScaleTokens = Record<string, string>;

/** Round to the nearest 5ms so token values stay tidy. */
function roundMs(ms: number): number {
	return Math.round(ms / 5) * 5;
}

export function expandMotionScale(config: MotionScaleConfig): MotionScaleTokens {
	const { fast, medium, slow, ratio, easing } = config;

	const tokens: MotionScaleTokens = {
		'--duration-fast-min': `${roundMs(fast * ratio)}ms`,
		'--duration-fast': `${roundMs(fast)}ms`,
		'--duration-fast-max': `${roundMs(fast / ratio)}ms`,
		'--duration-medium-min': `${roundMs(medium * ratio)}ms`,
		'--duration-medium': `${roundMs(medium)}ms`,
		'--duration-medium-max': `${roundMs(medium / ratio)}ms`
	};

	// Slow band is optional — only emitted when a base is supplied.
	if (slow != null) {
		tokens['--duration-slow-min'] = `${roundMs(slow * ratio)}ms`;
		tokens['--duration-slow'] = `${roundMs(slow)}ms`;
		tokens['--duration-slow-max'] = `${roundMs(slow / ratio)}ms`;
	}

	// The pre-tempo snapshot, which the runtime multiplies by
	// `--_astryx-motion-tempo`; at the default tempo the two are equal and the
	// generated stylesheet is the same either way.
	for (const [name, value] of Object.entries(tokens)) {
		if (name.startsWith('--duration-')) {
			tokens[name.replace('--duration-', '--_astryx-pre-tempo-duration-')] = value;
		}
	}
	tokens['--_astryx-motion-tempo'] = '1';

	if (easing) {
		tokens['--ease-standard'] = easing;
	}

	return tokens;
}
