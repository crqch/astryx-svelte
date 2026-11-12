// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file menuPressMarker.ts
 * @input None.
 * @output Exports MENU_PRESS_MARKER, the private mark on a menu press root.
 * @position Owner of the menu-press root marker. The menu press model
 *   (hooks/useMenuPress.ts) writes it, and the press controller
 *   (utils/pressFeedback.ts) reads it to leave a menu's own highlight alone.
 *   No package entry exports it.
 */

export const MENU_PRESS_MARKER = 'data-astryx-menu-press';
