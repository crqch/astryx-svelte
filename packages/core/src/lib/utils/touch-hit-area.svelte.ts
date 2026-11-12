import {
	MIN_TOUCH_TARGET,
	NO_HIT_INSETS,
	watchHitArea,
	writeHitInsets,
	type HitInsets,
	type HitRect
} from './hit-area.js';

/**
 * Ported from Astryx's `utils/touchHitArea.ts`.
 *
 * A Svelte adaptation: upstream returns a callback ref; here the element and
 * enabled state come in as getters and the watch lives in an effect, so a
 * replaced element or a changed pointer starts its own watch.
 *
 * Under a coarse primary pointer, the shared utility measures how far the
 * element's hit target may grow without reaching a neighbor's half of the gap.
 * That writes the insets on the element, where its layer reads them. Under a
 * fine pointer the shared utility starts no observer. Elements move by
 * transform, so a measurement that arrives while the parent has a finite
 * animation running or held is dropped and taken once those animations end.
 * The insets are then taken at rest, and no frame of a compositor-only motion
 * lays out or paints for them.
 */

/** How an owner's element grows, for an owner with its own rule. */
export interface TouchHitAreaOptions {
	/**
	 * How far the element grows on each side before any neighbour stops it,
	 * read as `watchHitArea`'s `growth`. It also gets the element. A group
	 * passes `groupGrowth` of its members.
	 * @default toward 44 px on each axis, centered
	 */
	readonly growth?: (
		target: HitRect,
		toLayout: (rect: HitRect) => HitRect,
		element: HTMLElement
	) => HitInsets;
	/**
	 * Whether a finger's press on the element re-measures it against every
	 * interactive element on the page. An owner that reads its own targets
	 * when a press begins turns it off.
	 * @default true
	 */
	readonly checkAtPress?: boolean;
	/**
	 * Whether a finger's press that lands on a descendant is the element's,
	 * however near a neighbour is, read as `watchHitArea`'s
	 * `ownsDescendantTouches`. An owner that draws the band on a descendant,
	 * and whose content never paints past its box, turns it off, so a band
	 * press nearer a neighbour is not the element's.
	 * @default true
	 */
	readonly ownsDescendantTouches?: boolean;
}

const NO_OPTIONS: TouchHitAreaOptions = {};

/**
 * The finite animations running or held in the element's parent, the element
 * included: a row's own motion and its neighbors'. An endless one (a spinner)
 * moves nothing that comes to rest, so it holds nothing.
 */
function settlingAnimations(element: HTMLElement): Animation[] {
	const scope = element.parentElement ?? element;
	if (typeof scope.getAnimations !== 'function') {
		return [];
	}
	return scope.getAnimations({ subtree: true }).filter((animation) => {
		if (animation.playState !== 'running' && animation.playState !== 'paused') {
			return false;
		}
		const end = animation.effect?.getComputedTiming().endTime;
		return typeof end === 'number' && Number.isFinite(end);
	});
}

/**
 * Watches `element` and takes its insets only at rest. Returns the stop.
 */
function watchAtRest(
	element: HTMLElement,
	minSize: number,
	{ growth, checkAtPress, ownsDescendantTouches = true }: TouchHitAreaOptions
): () => void {
	let stopWatch = (): void => {};
	let isStopped = false;
	let isWaiting = false;
	let hasWritten = false;
	// A stopped watch clears the insets it wrote. A fresh watch skips a
	// measurement equal to its start, zero, so old insets would otherwise stay.
	// A watch that wrote nothing, as under a mouse, writes nothing.
	const stop = (): void => {
		stopWatch();
		if (hasWritten) {
			hasWritten = false;
			writeHitInsets(element, NO_HIT_INSETS);
		}
	};
	const watch = (): void => {
		stopWatch = watchHitArea(
			element,
			(insets) => {
				const moving = settlingAnimations(element);
				if (moving.length === 0) {
					hasWritten = true;
					writeHitInsets(element, insets);
					return;
				}
				if (isWaiting) {
					return;
				}
				isWaiting = true;
				void Promise.allSettled(moving.map(async (animation) => animation.finished)).then(() => {
					isWaiting = false;
					if (!isStopped) {
						stop();
						watch();
					}
				});
			},
			{
				minSize,
				ownsDescendantTouches,
				growth:
					growth == null ? undefined : (target, toLayout) => growth(target, toLayout, element),
				checkAtPress
			}
		);
	};
	watch();
	return () => {
		isStopped = true;
		stop();
	};
}

/**
 * Keep `getElement()`'s hit insets live while `getEnabled()`: the element takes
 * taps, so it is interactive and not disabled or read-only. Pair it with
 * `touchHitAreaStyles.layer` on the same element, or on a descendant with
 * `ownsDescendantTouches` off. The watch lasts while the element is attached,
 * so a replaced element starts its own.
 */
export function useTouchHitArea(
	getElement: () => HTMLElement | null,
	getEnabled: () => boolean,
	options: TouchHitAreaOptions = NO_OPTIONS
): void {
	$effect(() => {
		if (!getEnabled()) {
			return;
		}
		const element = getElement();
		if (element == null) {
			return;
		}
		return watchAtRest(element, MIN_TOUCH_TARGET, options);
	});
}
