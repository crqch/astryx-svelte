# @astryx-sv/theme-liquid-glass

macOS translucent materials, capsule controls and the Apple system palette. **This theme has no upstream Astryx counterpart** — it is the port’s one deliberate addition to the published surface, and is labelled as such rather than presented as parity.

A theme for [astryx-svelte](https://github.com/crqch/astryx-svelte) — a Svelte 5 port of [Astryx](https://astryx.atmeta.com/),
Meta's open source design system. Unofficial, and not affiliated with Meta.

## Install

```bash
npm install @astryx-sv/core @astryx-sv/theme-liquid-glass
```

`@stylexjs/stylex` is a peer dependency and npm and bun install it for you. It is required at
runtime — the components reach `stylex.props()` through `sx()` — so add it explicitly if your
package manager does not resolve peers automatically.

`@astryx-sv/core` is a peer dependency. A theme is data plus one stylesheet; it renders
nothing on its own.

## Use

```css
/* src/app.css */
@import '@astryx-sv/core/base.css';
@import '@astryx-sv/theme-liquid-glass/theme.css';
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { Theme } from '@astryx-sv/core';
	import { liquidGlassTheme } from '@astryx-sv/theme-liquid-glass';
	import '../app.css';

	const { children } = $props();
</script>

<Theme theme={liquidGlassTheme}>
	{@render children()}
</Theme>
```

`base.css` is not optional and is not a duplicate: it declares the cascade layer order and sets
`color-scheme`, without which every `light-dark()` token is inert. And **your bundler must run the
StyleX compiler** over `@astryx-sv/core`, which is the one setup step that fails without an
error — the components render, unstyled. See
[core's README](https://github.com/crqch/astryx-svelte/tree/main/packages/core#your-bundler-must-run-the-stylex-compiler).

## Exports

| Export                                    | What it is                                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liquidGlassTheme`                        | The theme object, pre-built. It carries `__built`, so `<Theme>` injects no CSS at runtime.                                                                                         |
| `liquidGlassIconRegistry`                 | The 28 semantic icon names mapped to Lucide glyphs. Already attached to `liquidGlassTheme.icons`; exported separately for `registerIcons()` and for composing a theme of your own. |
| `@astryx-sv/theme-liquid-glass/tokens`    | The same theme as plain data, without `icons`, in a module that imports nothing. Readable by plain Node, which the `.` entry is not — it reaches a `.svelte` registry.             |
| `@astryx-sv/theme-liquid-glass/theme.css` | The pre-built stylesheet.                                                                                                                                                          |

## Fidelity

This theme ports nothing, so there is no upstream CSS to diff against. It carries
`scripts/check-theme.mjs` instead, which asserts that every token name it declares is one
of core's published tokens, that every component it overrides is a real theme target, and
that the two blocks `scripts/build-theme.mjs` appends — reduced transparency and reduced
motion — cover every surface and transition the theme object declares. The selector sets
are derived once, in `scripts/derived.mjs`, so the emitter and the check cannot disagree
about what needs covering. None of these failures is loud on its own: `defineTheme` accepts
any string, so a typo compiles to CSS that parses, loads and styles nothing.

## States and motion

Every state colour is a token pair, so hover, pressed, selected, disabled and focus flip
with the mode instead of against it:

- hover and pressed are `--color-overlay-hover` / `--color-overlay-pressed` — core's shared
  interaction overlay, low-alpha black in light mode and low-alpha white in dark;
- selected is `--color-accent-muted`, at the same alpha as the categorical fills (15% light
  / 18% dark) so a selected row matches the accent hue's own badge;
- disabled is the alpha text and icon ramps plus each component's own 0.5 opacity;
- focus keeps `--focus-outline-color` at its `var(--color-accent)` default, so the ring is
  systemBlue in both modes.

Solid fills that carry a label — a semantic Badge, a Button, a completed Step — take a
`--color-on-*` pair rather than one value, because Apple's bright dark-mode stops need dark
ink where the light-mode accessible stops take white. The semantic badge variants are
deliberately left as solids: pointing them at the tinted hue tokens made each one identical
to its categorical twin (`info` with `blue`, `success` with `green`, and so on).

State changes are transitioned from the theme layer with `--duration-fast` and the macOS
`--ease-standard` curve. That covers the controls core already transitions and the ones it
does not (menu rows, nav rows, tree rows, chips, cards), without touching layout
properties. `prefers-reduced-motion: reduce` zeroes every one of those transitions.

`prefers-reduced-transparency: reduce` flattens every glass surface and every translucent
surface token, including the secondary Button's literal capsule fill and the Toast's
inverted surface — a control that lost its blur but kept its see-through fill would defeat
the preference it was honouring.

## Resources

- [The documentation site](https://astryx.crqch.dev/themes) — every theme rendered live,
  side by side
- [Astryx](https://astryx.atmeta.com/) — the design system this ports
- [The repository](https://github.com/crqch/astryx-svelte)

## License

MIT. Astryx is © Meta Platforms, Inc. and affiliates; this project ports its design and reuses its
documentation prose, and claims no affiliation or endorsement.
