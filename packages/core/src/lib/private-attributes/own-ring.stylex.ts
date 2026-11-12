// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file own-ring.stylex.ts
 * @input The focus tokens (styles/tokens.stylex.ts)
 * @output ownRingProps, which marks a control that rings itself, and
 *   ownRingContainerStyles: a reorderable List row's focus-within ring,
 *   which leaves such a control alone
 * @position Owner module of the private own-ring attribute: the only file
 *   that writes its name. ListReorderHandle marks the handle and composes the
 *   row's ring, and only the reorder machinery imports it, so a List
 *   without `reorderable` carries none of it. No package entry exports it.
 *
 * Ported from Astryx's `privateAttributes/ownRing.stylex.ts`.
 */

import * as stylex from '@stylexjs/stylex';
import { focusVars } from '../styles/tokens.stylex.js';

/** A focused descendant that is not a control ringing itself. */
const OTHER_FOCUS = ':has(:focus-visible:not([data-astryx-own-ring]))';

/** Spread on a control that rings itself. */
export const ownRingProps: Readonly<Record<string, string>> = {
	'data-astryx-own-ring': ''
};

/**
 * A container that rings itself on focus within. A focused descendant marked
 * `data-astryx-own-ring` is left alone: a control that rings itself, such as
 * a List row's reorder handle. Without it the two rings stack for one tab
 * stop. An ancestor that clips its inline overflow (List) also cuts the
 * container's ring to two lines. It is its own object, so only the reorder
 * that uses it carries it.
 */
export const ownRingContainerStyles = stylex.create({
	focusWithin: {
		outlineWidth: {
			default: '0',
			[OTHER_FOCUS]: focusVars['--focus-outline-width']
		},
		outlineStyle: {
			default: 'none',
			[OTHER_FOCUS]: focusVars['--focus-outline-style']
		},
		outlineColor: {
			default: null,
			[OTHER_FOCUS]: focusVars['--focus-outline-color']
		},
		outlineOffset: {
			default: '0',
			[OTHER_FOCUS]: focusVars['--focus-outline-offset']
		}
	}
});
