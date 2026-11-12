/**
 * Ported from Astryx's `Layer/presentationHold.ts`.
 *
 * A layer that can present more than one way chooses as it opens, and its close
 * has to play out in the same presentation even when what it would choose has
 * changed meanwhile. One job: take the choice at the opening, hold it, and let
 * it go when the component says its close has settled. The component decides
 * when that is; the hold decides nothing about timing.
 *
 * Svelte adaptation: upstream takes the hold during render and returns the
 * opening's choice in that same render. `isOpen` is read through a getter here,
 * and the latch runs in `$effect.pre` — before Svelte patches the DOM — so a
 * consumer that renders the presented surface from `isHeld` never paints a
 * frame without it. The hook still reports `isHeld` for the current `isOpen`
 * immediately, so an open state that arrives between flushes is never missed.
 *
 * Internal to core: not exported from the package or any barrel
 * (`presentation-hold.svelte.test.ts` locks that).
 */

import { untrack } from 'svelte';

/** An imperative presentation hold. */
export interface PresentationHold<P> {
	/** Takes the opening's choice, replacing any held one. */
	take(presentation: P): void;
	/** The held choice, or undefined when nothing is held. */
	current(): P | undefined;
	/** Whether a choice is held. */
	isHeld(): boolean;
	/** Lets the held choice go (the close has settled). */
	release(): void;
}

/** A presentation hold for code that chooses at an open event. */
export function createPresentationHold<P>(): PresentationHold<P> {
	let held: { readonly value: P } | null = null;
	return {
		take(presentation) {
			held = { value: presentation };
		},
		current: () => held?.value,
		isHeld: () => held != null,
		release() {
			held = null;
		}
	};
}

/** What `usePresentationHold` returns. */
export interface PresentationHoldState<P> {
	/** The opening's choice while it is held; null when nothing is held. */
	readonly presentation: P | null;
	/** True from the opening render until `release()`. */
	readonly isHeld: boolean;
	/** Lets the held choice go (the close has settled). Stable. */
	readonly release: () => void;
}

export interface UsePresentationHoldOptions<P> {
	isOpen: boolean;
	presentation: P;
}

/**
 * The presentation hold, taken during render: the render in which `isOpen`
 * turns on already holds `presentation` as it is then, and it stays held,
 * whatever `presentation` becomes, until `release()`.
 */
export function usePresentationHold<P>(
	options: () => UsePresentationHoldOptions<P>
): PresentationHoldState<P> {
	let held = $state<{ readonly value: P } | null>(null);

	$effect.pre(() => {
		const { isOpen, presentation } = options();
		if (isOpen && held == null) {
			held = untrack(() => ({ value: presentation }));
		}
	});

	const release = (): void => {
		held = null;
	};

	return {
		get presentation() {
			if (held != null) {
				return held.value;
			}
			const { isOpen, presentation } = options();
			return isOpen ? presentation : null;
		},
		get isHeld() {
			return held != null || options().isOpen;
		},
		release
	};
}
