import type { Attachment } from 'svelte/attachments';
import { observeResize } from '../../internal/shared-resize-observer.js';
import {
	TOKENIZER_LANE_RESERVE_VAR,
	tokenizerLaneReserveStyle
} from './use-end-lane-reserve.stylex.js';

/**
 * Ported from Astryx's `Tokenizer/useEndLaneReserve.ts`.
 *
 * The lane is absolutely positioned — it has to be, because these wrappers
 * wrap, and an in-flow sibling gets pushed onto a second row by a token — and
 * an out-of-flow box reserves no space by definition. So the lane is measured,
 * and the input spends the measurement as padding. The measurement never
 * enters component state: it is written to a custom property on the field
 * wrapper and inherited by the input.
 *
 * Upstream's ref callback returns its cleanup; this port's attachment does the
 * same, which is why the room the lane claimed goes back to the input when it
 * unmounts.
 */
export function useEndLaneReserve(laneInset: string): {
	attachLane: Attachment<HTMLElement>;
	reserveStyle: typeof tokenizerLaneReserveStyle;
} {
	const attachLane: Attachment<HTMLElement> = (node) => {
		const host = node.parentElement;
		const unobserve = observeResize(node, () => {
			// `offsetWidth`, not the rect: the rect is in viewport space and
			// carries every CSS transform, while the padding it feeds is local.
			const width = node.offsetWidth;
			if (width > 0) {
				host?.style.setProperty(TOKENIZER_LANE_RESERVE_VAR, `calc(${laneInset} + ${width}px)`);
			} else {
				// A mounted but empty lane claims nothing.
				host?.style.removeProperty(TOKENIZER_LANE_RESERVE_VAR);
			}
		});

		return () => {
			unobserve();
			// Removing beats setting 0px: the rule's fallback is already that,
			// and this leaves no stale property behind.
			host?.style.removeProperty(TOKENIZER_LANE_RESERVE_VAR);
		};
	};

	return { attachLane, reserveStyle: tokenizerLaneReserveStyle };
}
