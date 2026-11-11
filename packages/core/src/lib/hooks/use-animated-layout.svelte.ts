import { createAnimatedLayout, type AnimatedLayout } from '../motion/animated-layout.js';

export type { AnimatedLayout } from '../motion/animated-layout.js';

export interface UseAnimatedLayoutOptions {
	/** The container whose content glides: a scroll container or a panel. */
	container: () => HTMLElement | null;
}

/**
 * Ported from Astryx's `hooks/useAnimatedLayout.ts`.
 *
 * The React hook takes a ref; this one takes the container getter every rune
 * hook uses, and reads it when a change runs, so a later assignment is still
 * seen. The returned handle is stable for the component's life and has no
 * public members.
 */
export function useAnimatedLayout(options: UseAnimatedLayoutOptions): AnimatedLayout {
	return createAnimatedLayout(options.container);
}
