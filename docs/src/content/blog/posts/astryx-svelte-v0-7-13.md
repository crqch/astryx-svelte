---
title: 'astryx-svelte v0.7.13: parity with upstream, and a new home'
description: '0.7.13 parity, ten packages under @astryx-sv, docs on Cloudflare, and the release where this fork stops being just a mirror.'
date: '2026-11-12'
type: 'update'
authors:
  - 'crqch'
tags:
  - 'Release'
  - 'Parity'
  - 'Svelte'
releasePackage: '@astryx-sv/core'
relatedDocs:
  - title: 'Getting started'
    href: '/docs/getting-started'
  - title: 'Components'
    href: '/components'
  - title: 'Themes'
    href: '/themes'
---

0.7.13 is two releases rolled into one.

The first is parity: the port now matches Astryx 0.7.13, the upstream release it's pinned to. The second is about identity. From this release on, the packages publish under `@astryx-sv/*`, the docs live at [astryx.crqch.dev](https://astryx.crqch.dev/), and every repository link points to this fork instead of the original project.

In other words, this is the point where the fork stops being a copy and becomes its own project.

## Picking up from 0.5.2

Rohit Kushwaha started this port. He wrote the Svelte 5 translation of Meta's Astryx, built the oracle-backed parity system, and shipped it through 0.5.2. This repository is a fork of [that project](https://github.com/DevRohit06/astryx-svelte), so it carries over the commit history, the design decisions, and the recorded debts, and it continues from where 0.5.2 ended.

What it doesn't carry over is the 0.5.2 feature ceiling. Upstream kept moving. 0.7.13 added `Timer`, `InfoTip`, `ScrollableArea`, `Drawer`, the `SnapPaging` subsystem, a new theme compiler contract, and the biggest test delta the port has ever had to absorb. We closed that gap on a long-lived `react-svelte-parity` branch, which covered the whole distance between two major upstream milestones rather than a few patches on a release branch. It landed as [PR #1](https://github.com/crqch/astryx-svelte/pull/1): 131 commits across roughly 2,600 files.

Nearly all of that diff is parity work. The release chores (renaming packages, setting up hosting, wiring up publishing) came at the end. That's also why the release only made sense once the parity work underneath it was solid.

A fork can keep its original remote and stay downstream forever. We didn't. There's no `upstream` remote pointing back to the original repo anymore, and the project metadata now reflects that: package manifests, issue templates, the security contact in the Code of Conduct, the site footer, and the author registry. The original repo and its docs are still where they were. Credit stays where it belongs too: `DevRohit06` is still listed as the port's original author, and this is still a faithful port of Meta's Astryx, not a new design system.

## A new package scope

The old `@astryx-svelte/*` packages are still on npm at 0.5.2. We haven't deprecated or unpublished them. 0.7.13 starts a new release line under `@astryx-sv/*`: ten packages (`core`, `cli`, and eight themes), all versioned to match the upstream release they port and published from the `v0.7.13` tag. A fork needs a scope it actually controls, and `@astryx-sv` is ours.

Switching over is a find-and-replace:

```diff
- npm install @astryx-svelte/core @astryx-svelte/theme-neutral
+ npm install @astryx-sv/core @astryx-sv/theme-neutral

```

```diff
- import { Button } from '@astryx-svelte/core';
- import '@astryx-svelte/core/base.css';
- import '@astryx-svelte/theme-neutral/theme.css';
+ import { Button } from '@astryx-sv/core';
+ import '@astryx-sv/core/base.css';
+ import '@astryx-sv/theme-neutral/theme.css';

```

The code underneath is a different story. The old scope's last release targets Astryx 0.5.2 and this one targets 0.7.13, so renaming the imports changes the address, but the behavior change comes from the parity work.

The version number tracks our parity target, not how many releases this fork has cut. That's why all ten packages sit at `0.7.13` even though newer Astryx versions exist on npm: 0.7.13 is the baseline this line was built against. Moving the target forward will be a deliberate re-pin, not a routine version bump.

## What's new in 0.7.13

If you skim the commit log, the theme is clear: interaction and input behavior finally catch up. Menus follow your finger. Popovers scale out from whatever triggered them. Resizable panes rubber-band at their limits. The month scroller cross-fades between months. A static component catalog is easy to check by looking at the markup, but gestures and motion are much harder to verify that way.

**Sliding menus.** `useMenuPress` brings a press-slide-release model to menus. Releasing activates the item under your pointer, and highlights follow a held touch or mouse drag. A click opens a menu right away, while touch uses a long press, and hovering near an edge scrolls long lists. The hook has a 55-case test suite (transition tables and values are tested separately), and it now powers `DropdownMenu`, `ContextMenu`, submenus, and `TabMenu`. It sounds like a minor changelog line until you use a menu on a phone and it won't follow your thumb.

It isn't rolled out everywhere yet. The bottom-sheet action list, navigation, breadcrumb, and selector menus still use standard clicks. Those gaps are logged in [`port/debts.md`](https://github.com/crqch/astryx-svelte/blob/main/port/debts.md).

**A green Calendar suite.** The main Calendar suite now passes 126/126. These are upstream's own tests ported case for case, not ones we wrote ourselves. The last stretch was the awkward edge cases: keyboard and month paging, provider-supplied weekday and month labels, locale-specific digits, years 1 through 99, controlled `null` values, focus-date movement, tab stops in range spans, and forced colors. Getting those passing meant real fixes to the component. Month navigation now resolves its targets cleanly, `aria-disabled` options behave correctly in the tab order, week numbers are labeled accurately, weekday keys no longer collide when two weekdays share a first letter, and same-day ranges commit properly.

Those last edge cases tend to be the ones nobody realized were ambiguous until someone had to write an assertion for them.

**Modal screen-reader announcements.** `useAnnounce` now supports modal live-region routing. `Dialog`, `BottomSheet` (including switcher steps), `Drawer`, `Lightbox`, and `MobileNav` all host the provider, so Lightbox's own announcements go through the active modal region. That's covered by 85 upstream assertions across the announce, replace, modal, rendered-text, shared, and busy suites. Screenshots and CSS diffs can't tell you whether screen-reader behavior is right, so porting the tests was the only reliable way to port it.

**`Drawer` is here**, along with `DrawerHeader`, with direction, header, and SSR test suites that match upstream.

### Also in this release

* **`Avatar` initials** now follow upstream's grapheme and meaningful-character rules. They render through `::before` content, with an `@supports` fallback for empty alt text, and any `aria-label`, `role`, or `aria-hidden` you pass still takes precedence. 36 of the 38 missing test cases are ported. The other two depend on React render introspection, and that's documented.
* **`Resizable` motion physics** include rubber-band overshoot, drawn-handle spring-back, close slide, and edge reveal, plus a Reduce Motion path. 90 of 97 cases are in place, and the seven render-observer-counter cases are noted as known gaps.
* **`Popover` touch animations** scale out from where the surface meets its source, and they respect the entrance/exit tokens and reduced-motion preferences. All 31 surface-motion cases are ported.
* **`MonthScroller` transitions** use `reducedMotionFade` on coarse pointers and snap immediately on fine pointers. Scroll positioning is flushed before the fade-in starts.
* **`DateTimeInput`** gets native date and time segments, the `presentation` prop, the native/presentation matrix, and a console warning for explicit-native use.
* **The theme compiler contract** is updated. It now supports data-attribute selectors, Dynamic Type sizing, motion tempo, status aliases, syntax diff slots, adaptations, and local tokens, and all theme build oracles pass against 0.7.13.
* **The Tailwind bridge** is complete. It maps all 139 upstream tokens, and `core` now exports `./theme/tokens` and `./theme/tokens.stylex`.
* **Smaller additions:** `MultiSelector.formatValue`, namespaced `Icon` keys, the `CardVariantMap` and `CustomTextTypes` module augmentations, and deterministic cover art for blog posts without custom images.

## A new home for the docs

We dropped `adapter-vercel`. The docs now build with `adapter-cloudflare` and deploy through [`docs/wrangler.jsonc`](https://github.com/crqch/astryx-svelte/blob/main/docs/wrangler.jsonc) to **astryx.crqch.dev**. That setup is a Worker named `astryx-svelte-docs`, `.svelte-kit/cloudflare` for static assets, `nodejs_compat`, and our custom domain. `bun run deploy:docs` builds the workspace and pushes it live with `wrangler deploy`. There's also a proper 404 page, prerendered to `404.html`, for Cloudflare's `not_found_handling`.

The site was already fully prerendered, so this works as a static-asset deployment with a Worker behind it. Normal page loads never touch the Worker. Only unmatched routes do, which is how docs hosting should work: compute is the fallback, not the hot path.

## Hardening the release pipeline

Once a fork starts publishing its own packages, you run into build and CI problems that a downstream consumer never sees.

We moved the toolchain to Bun and hit two failures while validating the release. Neither showed up on a warm local checkout:

1. **Build ordering:** `bun run --filter '*' build` runs workspace builds in parallel. The theme packages import `packages/core/dist/theme/generate-theme-rules.js`, so on a clean build the themes would sometimes start before `core` had generated that file. `build:packages` now enforces a strict **core → themes → docs** order across the root build, CI, release scripts, verification, and docs deployment.
2. **CI runner setup:** The `changes` job and the final `ci` gate both called `bun` without installing it, so PRs failed within seconds with `bun: command not found`. Both jobs now install the same pinned Bun version as the rest of the workflow. We also split the client test suite across four parallel runners, and all four are still required by the aggregate `ci` check. That cuts wall-clock time without loosening the gate.

## What 0.7.13 isn't

It isn't the finish line for the port. Unported upstream cases are still tracked in [`port/status.md`](https://github.com/crqch/astryx-svelte/blob/main/port/status.md), `lab`, `charts`, and `vega` are intentionally out of scope, and every deliberate divergence is documented in [`port/debts.md`](https://github.com/crqch/astryx-svelte/blob/main/port/debts.md).

What the release does mean is simpler: this fork now ships its own packages, pinned to a clear parity target, from a repository and domain it owns. The 0.5.2 line still works where it is. The new line starts here.

## Try it out

```bash
npm install @astryx-sv/core @astryx-sv/theme-neutral

```

Browse the source on [GitHub](https://github.com/crqch/astryx-svelte), explore the docs at [astryx.crqch.dev](https://astryx.crqch.dev/), or read [PR #1](https://github.com/crqch/astryx-svelte/pull/1) for the full breakdown of what landed.
