import { vi } from 'vitest';

/** One animation the stand-in started. */
export interface FakeAnimation {
	readonly keyframes: ReadonlyArray<Keyframe>;
	readonly options: KeyframeAnimationOptions;
	/** Settles `finished`, as the animation's own timeline would at its end. */
	finish(): void;
	readonly cancel: ReturnType<typeof vi.fn>;
	/** The animation itself: its start time (ms), which a test or the code sets. */
	readonly animation: { startTime: number | null };
}

/**
 * An `Element.animate` stand-in, ported from Astryx's
 * `motion/__tests__/fakeWebAnimation.ts`. Each call records its keyframes and
 * timing. Its `finished` settles only on `finish()`, and `cancel()` rejects
 * it, as a browser does. No timer finishes it, so a test can hold an animation
 * past any number of frames.
 *
 * The server project has no DOM, so a test attaches this to a plain object
 * standing in for the element: `playReducedMotionDip` only calls `animate`.
 *
 * @example
 * ```
 * const element = {animate} as unknown as Element;
 * const dip = playReducedMotionDip(element, fade, land);
 * animations[0].finish();
 * ```
 */
export function fakeAnimate(): {
	animate: Element['animate'];
	animations: FakeAnimation[];
} {
	const animations: FakeAnimation[] = [];
	const animate = vi.fn(
		(
			keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
			options?: number | KeyframeAnimationOptions
		) => {
			let resolve = () => {};
			let reject = (_reason: unknown) => {};
			const finished = new Promise<void>((onResolve, onReject) => {
				resolve = onResolve;
				reject = onReject;
			});
			// A cancelled animation's rejection is expected: keep it unreported.
			finished.catch(() => {});
			const cancel = vi.fn(() => {
				reject(new DOMException('The animation was cancelled.', 'AbortError'));
			});
			const animation = {
				finished,
				cancel,
				startTime: null as number | null
			};
			animations.push({
				keyframes: (keyframes ?? []) as Keyframe[],
				options: typeof options === 'number' ? { duration: options } : (options ?? {}),
				finish: () => resolve(),
				cancel,
				animation
			});
			return animation as unknown as Animation;
		}
	);
	return { animate, animations };
}
