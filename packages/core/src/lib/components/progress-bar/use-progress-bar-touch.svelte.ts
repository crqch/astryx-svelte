/**
 * Ported from Astryx's `ProgressBar/ProgressBarTouch.ts`.
 *
 * The fill's touch variables (move length, curve, return offset, minimum
 * length) and, under a finger with marks, the share of the track the fill
 * draws. Upstream's `useState` + render-phase update becomes `$state` adjusted
 * in a `$effect.pre`: the effect runs before Svelte patches the DOM, so the
 * fill style a value change renders already carries the new move length.
 *
 * The track ref becomes an attachment. Upstream's effect observes the element
 * while `watchesTrack` holds; an attachment is an effect itself, so reading
 * `watchesTrack` in it re-runs the registration when a finger or a mark
 * appears and its teardown unobserves the old element.
 */

import { useMediaQuery } from '../../hooks/use-media-query.svelte.js';
import { observeResize } from '../../internal/shared-resize-observer.js';
import { formatMotionRoleValue } from '../../motion/roles.js';
import { resolveMotion } from '../../motion/resolve-motion.js';
import { progressBar } from '../../motion/uikit/progressBar.js';
import { TOUCH_QUERY } from '../../utils/touch-queries.js';

/** The track's height. */
const TRACK_HEIGHT_PX = 8;

/**
 * Under a finger the fill never draws shorter than this above zero:
 * UIProgressView's minimum, two track heights, on ProgressBar's 8px track.
 */
export const TOUCH_MIN_FILL_PX = progressBar.progressView.minimumFillHeights * TRACK_HEIGHT_PX;

export type ProgressBarFillVar =
	| '--_progress-bar-move'
	| '--_progress-bar-curve'
	| '--_progress-bar-flip'
	| '--_progress-bar-min';

export interface ProgressBarTouch {
	/** The fill's touch timing variables, set inline on the fill. */
	readonly fillVars: Record<ProgressBarFillVar, string>;
	/** The track, measured under a finger when the bar has marks. */
	attachTrack: (node: HTMLElement) => (() => void) | undefined;
	/** The share of the track the fill draws (0–100), for placing marks. */
	readonly drawnPercentage: number;
}

export function useProgressBarTouch(
	getPercentage: () => number,
	getHasMarks: () => boolean
): ProgressBarTouch {
	// The touch fill's duration comes from how far the value moved since the
	// last value, the model change that UIKit measures. It holds until the next
	// change, so a re-render with the same value keeps it.
	let motion = $state({ percentage: getPercentage(), change: 0, flip: 0 });

	$effect.pre(() => {
		const percentage = getPercentage();
		if (motion.percentage === percentage) {
			return;
		}
		// The share of the track the value moved (0–1). `flip` steps through
		// three values on every change (see the fill's touch transform).
		const change = Math.abs(percentage - motion.percentage) / 100;
		const flip = (motion.flip + 1) % 3;
		motion = { percentage, change, flip };
	});

	// Under a finger the fill draws at least TOUCH_MIN_FILL_PX long, so a mark
	// it covers there sits on the fill. That length is a share of the track's
	// width, which only layout knows. So the track is measured, but only under
	// a finger and only when the bar has marks.
	const isTouch = useMediaQuery(() => TOUCH_QUERY);
	const watchesTrack = $derived(isTouch.matches && getHasMarks());
	let trackWidth = $state(0);

	function attachTrack(node: HTMLElement): (() => void) | undefined {
		if (!watchesTrack) {
			return;
		}
		// The shared observer; its first call (on registration) carries no
		// contentRect, so that one reads the box.
		return observeResize(node, (entry) => {
			trackWidth = entry.contentRect?.width ?? node.getBoundingClientRect().width;
		});
	}

	const drawnPercentage = $derived(
		watchesTrack && getPercentage() > 0 && trackWidth > 0
			? Math.max(getPercentage(), (TOUCH_MIN_FILL_PX / trackWidth) * 100)
			: getPercentage()
	);

	// CSS applies the theme's tempo to this duration.
	const fillTrackMs = resolveMotion(null, progressBar, 'fillTrackMs');
	const curve = resolveMotion(null, progressBar.curves.fill);
	const fillVars: Record<ProgressBarFillVar, string> = $derived({
		'--_progress-bar-move': `${Math.round(motion.change * fillTrackMs * 1000) / 1000}ms`,
		'--_progress-bar-curve': formatMotionRoleValue('curve', curve),
		'--_progress-bar-flip': String(motion.flip),
		'--_progress-bar-min': `${TOUCH_MIN_FILL_PX}px`
	});

	return {
		get fillVars() {
			return fillVars;
		},
		attachTrack,
		get drawnPercentage() {
			return drawnPercentage;
		}
	};
}
