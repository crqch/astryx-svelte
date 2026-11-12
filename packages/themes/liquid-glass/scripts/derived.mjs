// Selector sets both this package's build and its oracle need.
//
// They live here rather than in either script because deriving them twice is
// the failure mode `CLAUDE.md` names for metrics: `build-theme.mjs` emits a
// block and `check-theme.mjs` asserts the block is complete, so if each walked
// the theme independently a change to one walk would make the check agree with
// a stylesheet that no longer matches the theme. One derivation, both callers.
//
// `parseStyleKey` is core's, read from its built `dist/` — the artifact a
// consumer resolves — for the same reason `check-theme.mjs` reads tokens and
// component names from there.

import { parseStyleKey } from '../../../core/dist/theme/parse-style-key.js';

/** `.astryx-<component><style-key suffix>` for one override. */
export function selectorFor(component, styleKey) {
	return `.astryx-${component}${parseStyleKey(styleKey)}`;
}

/**
 * Every selector that carries a `backdrop-filter` — i.e. every glass surface.
 *
 * Derived from the theme object, so a surface added to the theme is switched
 * off under `prefers-reduced-transparency` automatically and one removed stops
 * being named there.
 */
export function glassSelectors(theme) {
	const selectors = [];
	for (const [component, styleKeys] of Object.entries(theme.components ?? {})) {
		for (const [styleKey, styles] of Object.entries(styleKeys)) {
			if ('backdropFilter' in styles) selectors.push(selectorFor(component, styleKey));
		}
	}
	return selectors;
}

/**
 * Every selector whose theme override declares a state transition.
 *
 * The reduced-motion block zeroes exactly these, so the two halves cannot drift:
 * a component that gains a transition above is covered by the block, and one
 * that loses it stops being named.
 */
export function transitionSelectors(theme) {
	const selectors = [];
	for (const [component, styleKeys] of Object.entries(theme.components ?? {})) {
		for (const [styleKey, styles] of Object.entries(styleKeys)) {
			if ('transitionProperty' in styles) selectors.push(selectorFor(component, styleKey));
		}
	}
	return [...new Set(selectors)];
}
