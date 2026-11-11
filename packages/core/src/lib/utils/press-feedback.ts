import { readThemeTokens } from '../motion/theme-timing.js';
import { PRESS_FADE_MS } from './press-gesture.js';

/**
 * Ported from the constants of Astryx's `utils/pressFeedback.ts` that the
 * action-group tracker needs. The full delegated press controller is not
 * ported yet; components paint their own arms.
 */

/** The marker the controller finds with `closest()`. */
export const PRESSABLE_ATTRIBUTE = 'data-astryx-pressable';

/** `on` while the press is believed; `fading` for the release's exit. */
export const PRESSED_ATTRIBUTE = 'data-astryx-press';

/** How long the release fade runs: the theme's exit, capped at 200 ms. */
export function pressFadeMs(element: Element): number {
	const exit = readThemeTokens(element, { duration: '--duration-exit' }).ms ?? PRESS_FADE_MS;
	const reduced =
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	return reduced ? Math.min(exit, 200) : exit;
}
