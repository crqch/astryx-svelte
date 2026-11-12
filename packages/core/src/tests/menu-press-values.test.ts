/** PORTS: hooks/menuPressValues.test.ts */

// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file menu-press-values.test.ts
 * @input Uses vitest only, the UIKit gestures table and the menu press copy
 * @output The menu press handoff distance is the UIKit table's entry
 * @position Testing; validates packages/core/src/lib/hooks/menu-press-values.ts
 *
 * Astryx's `hooks/menuPressValues.test.ts`, ported case for case at the
 * **0.7.13** pin, with upstream's title and assertion. Nothing dropped.
 *
 * A **server** project file (`*.test.ts`): both sides are constants, so the
 * case runs in node. The copy exists for a menu that bundles one number rather
 * than the whole UIKit table; this keeps the copy from drifting off the
 * measurement it mirrors.
 */

import { describe, expect, it } from 'vitest';
import { UIKIT_GESTURES } from '$lib/motion/uikit/gestures.js';
import { MENU_PRESS_HANDOFF_PX } from '$lib/hooks/menu-press-values.js';

describe('menuPressValues', () => {
	it('copies the UIKit table exactly', () => {
		expect(MENU_PRESS_HANDOFF_PX).toBe(UIKIT_GESTURES.menuPress.handoff.value);
	});
});
