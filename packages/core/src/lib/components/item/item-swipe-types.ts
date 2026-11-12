import type { Snippet } from 'svelte';

/**
 * Ported from Astryx's `Item/Item.tsx` swipe types.
 *
 * Kept beside the component rather than in its `<script module>` so the swipe
 * layer and its styles can import them without importing the component module.
 * Upstream declares them in `Item.tsx`; the public surface is unchanged because
 * `item.svelte` re-exports each one.
 */

/**
 * How a swipe action looks: ordinary, the one you mean, the dangerous one.
 * Three flavours of verb, not a status set.
 */
export type ItemSwipeActionVariant = 'neutral' | 'accent' | 'destructive';

/** One verb a sideways drag uncovers. Every field is known before the gesture begins. */
export interface ItemSwipeAction {
	id?: string;
	/**
	 * The verb's name, and the button's accessible name while the row rests
	 * open. Names the state the verb reaches ("Unread"), since the gesture
	 * already supplies the verb.
	 */
	label: string;
	/** Drawn above the label. */
	icon?: Snippet;
	/**
	 * Fires at activation: a tap on a resting entry, the full-swipe
	 * accelerator, or a `commit` release. May return a Promise; the row
	 * waits for nothing.
	 */
	onActivate: () => void | Promise<void>;
	isDisabled?: boolean;
	/** @default 'accent' */
	variant?: ItemSwipeActionVariant;
	/**
	 * After this action fires the row holds out at the edge it travelled
	 * toward instead of springing back. Only that: not a promise the caller
	 * removes the row, not an animation, not a timing rule.
	 * @default false
	 */
	hasRemoval?: boolean;
}

export interface ItemSwipeActions {
	/** Uncovered by a drag toward the inline end (rightward in LTR); outermost last. */
	leading?: ItemSwipeAction[];
	/** Uncovered by a drag toward the inline start (leftward in LTR); outermost last. */
	trailing?: ItemSwipeAction[];
}

/**
 * `reveal`: past half the panel the row rests open with every entry a real
 * button; a long drag or a fling fires the outermost. `commit`: a release
 * past the commit point slides the row out and fires the outermost entry;
 * nothing rests, and the panel is presentational.
 */
export type ItemSwipeBehavior = 'reveal' | 'commit';
