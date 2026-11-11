// Compiles the Liquid Glass theme definition into dist/theme.css, dist/index.js
// and dist/index.d.ts. The work lives in `packages/themes/shared`, which every
// theme package calls the same way; see that file for the why.
//
// This package does three things afterwards that no other theme package does:
//
// 1. appends a `@media (prefers-reduced-transparency: reduce)` block, which
//    flattens every glass surface and every translucent surface token;
// 2. appends a `@media (prefers-reduced-motion: reduce)` block, which zeroes
//    the state transitions the theme adds (core already handles its own);
// 3. appends the squircle radius compensation described below.
//
// (1) and (2) are media-query seams `defineTheme` does not have; adding one to
// core would mean editing a file ported from upstream for a feature upstream
// does not have. Both are derived from the theme object through `derived.mjs`,
// which `check-theme.mjs` reads too, so the emitted blocks cannot drift from
// what the oracle checks.

import { appendFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildThemePackage } from '../../shared/build-theme-package.mjs';
import {
	liquidGlassTheme,
	reducedTransparencyComponents,
	reducedTransparencyTokens
} from '../src/liquid-glass-theme.ts';
import { glassSelectors, selectorFor, transitionSelectors } from './derived.mjs';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');

await buildThemePackage({
	packageDir,
	packageName: '@astryx-svelte/theme-liquid-glass',
	themeExport: 'liquidGlassTheme',
	theme: liquidGlassTheme,
	// The registry is named, not imported: this script runs under plain Node,
	// which cannot parse `src/icons.svelte`. Nothing here resolves
	// `@lucide/svelte` either, so `build` still works in a checkout where it has
	// not been installed — only the runtime and `test:icons` need it. See
	// `buildThemePackage`'s `icons` parameter.
	//
	// Unlike the other seven this registry has no upstream `icons.tsx` behind it;
	// `src/icons.svelte`'s own header says why it exists anyway.
	icons: { name: 'liquidGlassIconRegistry', file: 'icons.svelte' }
	// No `palettes`: that option exists to reproduce the `*Palettes` export the
	// butter/gothic/stone/y2k packages publish upstream. This theme has no
	// upstream package to match, and its colours are Apple's published system
	// palette rather than tonal ramps picked for it, so there is nothing to
	// republish as data.
});

/** `backgroundColor` → `background-color`, as the theme compiler does it. */
function toCssProperty(name) {
	if (name.startsWith('--')) return name;
	return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// -----------------------------------------------------------------------------
// Reduced transparency
// -----------------------------------------------------------------------------

const selectors = glassSelectors(liquidGlassTheme);
const tokens = Object.entries(reducedTransparencyTokens)
	.map(([name, value]) => `\t\t\t\t${name}: ${value};`)
	.join('\n');

// Component overrides that carry a literal fill the token block cannot reach —
// the secondary Button's translucent capsule being the one this theme has.
const componentRules = [];
for (const [component, styleKeys] of Object.entries(reducedTransparencyComponents)) {
	for (const [styleKey, styles] of Object.entries(styleKeys)) {
		const declarations = Object.entries(styles)
			.map(([property, value]) => `\t\t\t\t${toCssProperty(property)}: ${value};`)
			.join('\n');
		componentRules.push(`\t\t\t${selectorFor(component, styleKey)} {\n${declarations}\n\t\t\t}`);
	}
}

// A second `@layer astryx-theme` block appended after the first, which is the
// shape `generateThemeCss` already uses for its on-media rules. Same layer and
// same specificity, so it wins purely on source order — no `!important`, and a
// consumer's own later rule still beats it.
const reducedTransparency = `
@layer astryx-theme {
	@media (prefers-reduced-transparency: reduce) {
		@scope ([data-astryx-theme="${liquidGlassTheme.name}"]) to ([data-astryx-theme]) {
			:scope {
${tokens}
			}

${selectors.map((s) => `\t\t\t${s}`).join(',\n')} {
				backdrop-filter: none;
				-webkit-backdrop-filter: none;
			}
${componentRules.length > 0 ? `\n${componentRules.join('\n\n')}` : ''}
		}
	}
}
`;

await appendFile(join(packageDir, 'dist', 'theme.css'), reducedTransparency, 'utf8');

// -----------------------------------------------------------------------------
// Reduced motion
//
// Core zeroes the transitions it authors, with a `prefers-reduced-motion` branch
// on each one. The transitions this theme adds are authored here instead, so
// they need the branch here too — and it is derived from the same override map
// that emitted them. In the theme layer, so it wins over the component rules
// above without `!important`.
// -----------------------------------------------------------------------------

const motionSelectors = transitionSelectors(liquidGlassTheme);

const reducedMotion = `
@layer astryx-theme {
	@media (prefers-reduced-motion: reduce) {
		@scope ([data-astryx-theme="${liquidGlassTheme.name}"]) to ([data-astryx-theme]) {
${motionSelectors.map((s) => `\t\t\t${s}`).join(',\n')} {
				transition-duration: 0s;
			}
		}
	}
}
`;

await appendFile(join(packageDir, 'dist', 'theme.css'), reducedMotion, 'utf8');

/**
 * Squircle radius compensation.
 *
 * A superellipse corner is *less round than a circular corner at the same
 * `border-radius`* — measurably so. For a corner of radius r, the curve's
 * closest approach to the box corner along the diagonal is `0.4142·r` for a
 * circle and `0.2250·r` for `superellipse(2)`. The ratio is **1.84**, and the
 * first pass of this theme shipped without it: cards carried `border-radius:
 * 14px` chosen for circular corners, got `corner-shape: squircle` on top, and
 * rendered as very nearly square boxes. Screenshots at 14/20/24/28px put the
 * perceptual match between 24 and 28, which agrees with the arithmetic.
 *
 * The compensation cannot go in the base rules, because `corner-shape` is
 * Chromium-only (~65%): raising the radius unconditionally would leave Safari
 * and Firefox — the browsers that ignore `corner-shape` — with corners nearly
 * twice as round as intended. Under `@supports` the two agree instead: every
 * browser gets a corner of the same visual roundness, and Chromium additionally
 * gets the continuous curvature. That is a real progressive enhancement rather
 * than two different designs.
 *
 * Derived by reading back the generated CSS rather than from a hand-kept list,
 * so a surface that gains or loses its squircle is compensated, or stops being
 * compensated, with no second edit. Both `border-radius` and the `--_*-radius`
 * derived vars are bumped: components read the second for their own nested
 * geometry, and leaving it behind would desynchronise a card's radius from the
 * radius its children compute against.
 */
const SQUIRCLE_COMPENSATION = 1.84;

const generated = await readFile(join(packageDir, 'dist', 'theme.css'), 'utf8');
const compensated = [];

// Each `selector { … }` rule that opts into a squircle, with its radius
// declarations. Rule bodies here never nest, so a non-greedy brace match is safe.
for (const [, selector, body] of generated.matchAll(
	/([^{}]+)\{([^{}]*corner-shape:\s*squircle[^{}]*)\}/g
)) {
	const radii = [...body.matchAll(/(border-radius|--[\w-]*radius):\s*([^;]+);/g)];
	if (radii.length === 0) continue;
	compensated.push(
		`\t\t\t${selector.trim()} {\n` +
			radii
				.map(
					([, prop, value]) =>
						`\t\t\t\t${prop}: calc((${value.trim()}) * ${SQUIRCLE_COMPENSATION});`
				)
				.join('\n') +
			'\n\t\t\t}'
	);
}

const squircleBlock = `
@layer astryx-theme {
	@supports (corner-shape: squircle) {
		@scope ([data-astryx-theme="${liquidGlassTheme.name}"]) to ([data-astryx-theme]) {
${compensated.join('\n\n')}
		}
	}
}
`;

await appendFile(join(packageDir, 'dist', 'theme.css'), squircleBlock, 'utf8');

const css = await readFile(join(packageDir, 'dist', 'theme.css'), 'utf8');
console.log(
	`liquid-glass: + reduced-transparency (${selectors.length} glass selectors, ` +
		`${Object.keys(reducedTransparencyTokens).length} tokens, ` +
		`${componentRules.length} component rules) ` +
		`+ reduced-motion (${motionSelectors.length} selectors) ` +
		`+ squircle compensation ×${SQUIRCLE_COMPENSATION} (${compensated.length} rules), ` +
		`theme.css now ${(Buffer.byteLength(css) / 1024).toFixed(1)} KB`
);
