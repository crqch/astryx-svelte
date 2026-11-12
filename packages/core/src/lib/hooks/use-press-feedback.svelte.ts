// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file usePressFeedback.svelte.ts
 * @input The document-level press controller (utils/pressFeedback.ts)
 * @output Exports usePressFeedback
 * @position Core hook; every component that paints a press calls it and
 *   spreads its result on the element that paints
 *
 * SYNC: When modified, update hooks/index.ts, hooks/usePressFeedback.doc.mjs
 *   and utils/pressFeedback.ts.
 */

import { installPressFeedback, pressableProps } from '../utils/press-feedback.js';

/**
 * Mark an element as a pressable surface of the touch press model, and make
 * sure the document-level controller that drives it is installed.
 *
 * Spread the result on the element that paints the press, and compose one of
 * `interactionOverlayStyles` (from `utils/interaction-overlay.stylex.ts`) on
 * the same element: `backgroundColor` or `backgroundImage` for a surface whose
 * hover and press are the system's overlays, `pressedBackgroundColor` for one
 * whose hover is its own. Under a finger the controller tracks the press the
 * way UIKit tracks a control and writes its attribute on the element while the
 * press is held and for the release; the composed style paints the pressed
 * token on the first frame and fades it over the release, keeping `:active` for
 * a mouse on a desktop. On a phone or tablet the stylesheet drops `:active` for
 * every press, so the controller also paints a mouse, trackpad or
 * Space-key press there, at once. A press is themed through
 * `--color-overlay-pressed`, which the hold, the flash and the fade all read.
 *
 * Installation is shared and counted: the first mounted pressable installs the
 * controller, the last one to unmount removes it. No per-element listener or
 * state is added — a press costs one attribute write on one element.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   const pressable = usePressFeedback();
 * </script>
 * <button {...pressable} {...sx(styles.button)}>Save</button>
 * ```
 */
export function usePressFeedback(): typeof pressableProps {
	$effect(() => installPressFeedback());
	return pressableProps;
}
