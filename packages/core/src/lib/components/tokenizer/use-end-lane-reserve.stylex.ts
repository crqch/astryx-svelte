import * as stylex from '@stylexjs/stylex';
import type { StyleArg } from '../../internal/sx.js';

/**
 * The measured end-lane reserve, ported from Astryx's
 * `Tokenizer/useEndLaneReserve.ts`. Kept in its own module as upstream keeps
 * it: the lane is a Tokenizer-only workaround (an out-of-flow box reserves
 * nothing), not Field infrastructure every input should reach for.
 */

const LANE_RESERVE_VAR = '--_tokenizer-end-lane-reserve';

const reserveStyles = stylex.create({
	reserve: {
		paddingInlineEnd: `var(${LANE_RESERVE_VAR}, 0px)`
	}
});

/** The style that spends the measured lane width as inline-end padding. */
export const tokenizerLaneReserveStyle: StyleArg = reserveStyles.reserve;

/** The custom property the lane publishes; shared with the style module. */
export const TOKENIZER_LANE_RESERVE_VAR = LANE_RESERVE_VAR;
