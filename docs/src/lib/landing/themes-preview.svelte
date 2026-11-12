<script lang="ts">
	import {
		AppShellMobileContext,
		Card,
		Theme,
		type AppShellMobileContextValue
	} from '@astryx-sv/core';
	import { butterTheme } from '@astryx-sv/theme-butter';
	import ThemeShowcaseStore from '../../../../packages/cli/assets/templates/pages/theme-showcase/+page.svelte';
	import { getThemeShowcaseContent } from '$lib/shell/theme-showcase-content.js';
	import { getColorModeContext } from '$lib/shell/color-mode.svelte.js';

	/**
	 * The Themes bento tile — a scaled-down live `ThemeShowcaseStore` beside a
	 * three-swatch rail and a script "Aa". Ported from upstream's
	 * `_landing/ThemesPreview.tsx`.
	 *
	 * The store is the real page template out of
	 * `packages/cli/assets/templates/pages/theme-showcase/`, rendered at its
	 * natural 1000px desktop width and scaled down into a cropped window, exactly
	 * as upstream does. It renders inside the Butter `<Theme>` scope so it follows
	 * the docsite's light/dark choice while keeping Butter's palette.
	 *
	 * **The template's responsive grids read `useAppShellMobile()`**, which would
	 * otherwise reflect the docsite's viewport. The store is laid out at a fixed
	 * desktop width and shrunk to a miniature, so the context is forced to
	 * `isMobile: false` — the same override upstream installs around the store —
	 * and its product grid keeps its desktop layout on phones instead of
	 * collapsing to one full-width product inside the miniature.
	 *
	 * **Content is Butter's, not the template's neutral defaults.** Upstream feeds
	 * `getThemeShowcaseContent('butter')` (croissants, pancakes, waffles and a
	 * bakery inventory) so the tile reads as the theme it is advertising. That
	 * registry is the same one `/themes` consumes, ported record for record in
	 * `shell/theme-showcase-content.ts`, and its images are the vendored Butter
	 * preview photos under `static/images/butter/`.
	 *
	 * The swatches and the "Aa" resolve their colours from the Butter theme scope
	 * around the rail rather than hardcoded hex values, so they stay in sync with
	 * the theme package. All theme packages are `__built`, so none injects a
	 * stylesheet at runtime.
	 */
	const colorMode = getColorModeContext();

	const butterContent = getThemeShowcaseContent('butter');

	/**
	 * The store template's internal responsive grids read `useAppShellMobile()`,
	 * which reflects the DOCSITE's viewport. Since the store is rendered at a fixed
	 * 1000px desktop width and scaled down to a miniature, force `isMobile: false`
	 * so its product grid keeps the 3-column desktop layout on small screens.
	 */
	const FORCE_DESKTOP_MOBILE_CONTEXT: AppShellMobileContextValue = {
		isMobile: false,
		isMobileNavOpen: false,
		toggleMobileNav: () => {},
		openMobileNav: () => {},
		closeMobileNav: () => {},
		isMobileNavEnabled: false,
		hasAutoToggle: false
	};

	AppShellMobileContext.set(() => FORCE_DESKTOP_MOBILE_CONTEXT);

	// Swatch + "Aa" colours as Butter theme tokens (resolved through the Butter
	// `<Theme>` scope around the rail) rather than hardcoded hex, so they stay in
	// sync. Butter's signature display cursive is only applied by the theme to
	// display-role text, so the "Aa" sets the family explicitly.
	const BUTTER_BLUE = 'var(--color-accent)';
	const BUTTER_YELLOW = 'var(--color-background-yellow)';
	const BUTTER_CREAM = 'var(--color-background-body)';
	const BUTTER_SCRIPT = 'Sarina, "Brush Script MT", "Snell Roundhand", cursive';
</script>

<div class="container">
	<div class="root">
		<Card variant="transparent" padding={0} class="showcase-card">
			<Theme theme={butterTheme} mode={colorMode.themeMode}>
				<div class="scale-viewport" data-themes-card-preview>
					<div class="scale-inner" inert>
						<ThemeShowcaseStore {...butterContent ?? {}} />
					</div>
				</div>
			</Theme>
		</Card>

		<!--
			Butter `<Theme>` scope (display: contents, no layout box) so the
			swatches and "Aa" resolve the Butter --color-* tokens directly.
		-->
		<Theme theme={butterTheme} mode={colorMode.themeMode}>
			<div class="rail">
				<div class="swatch" style="background-color: {BUTTER_BLUE}"></div>
				<div class="swatch" style="background-color: {BUTTER_YELLOW}"></div>
				<div class="swatch" style="background-color: {BUTTER_CREAM}"></div>
				<span class="rail-wordmark" aria-hidden="true">Aa</span>
			</div>
		</Theme>
	</div>
</div>

<style>
	/*
	 * Container so the store + rail size fluidly off the card's width, not the
	 * viewport. The bento column is narrow even on wide screens, so a viewport
	 * media query cannot tell when the card is tight. Symmetric bleed reclaims
	 * both of the card's 40px insets so the store can be bigger.
	 */
	.container {
		container-type: inline-size;
		container-name: themesPreview;
		flex-shrink: 0;
		width: calc(100% + 2 * var(--spacing-10));
		margin-inline: calc(-1 * var(--spacing-10));
	}

	/*
	 * Horizontal composition: themed store preview + static swatches/"Aa" rail.
	 * Narrow card (3-column grid): left-anchored and shifted further left so the
	 * store bleeds past the card's left edge (off-canvas look). Wide single-column
	 * card (small screens): centred as a group.
	 */
	.root {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		justify-content: flex-start;
		/* Push past the card's left edge only on narrow cards. */
		margin-inline-start: -40px;
		gap: var(--spacing-4);
		width: 100%;
	}

	@container themesPreview (min-width: 400px) {
		.root {
			justify-content: center;
			margin-inline-start: 0;
		}
	}

	/*
	 * Window around the scaled store (no border — transparent Card), rounded on
	 * all corners with an elevation shadow so it lifts off the card. Width is
	 * fluid: it fills the available width minus the space reserved for the rail,
	 * capped at 360px.
	 */
	.root :global(.showcase-card) {
		flex-shrink: 0;
		min-width: 0;
		width: min(360px, calc(100cqw - 72px));
		overflow: hidden;
		border-radius: var(--radius-inner);
		box-shadow: var(--shadow-med);
	}

	/*
	 * Clipping viewport — its aspect ratio crops the scaled store right under the
	 * three product cards (full nav + hero + products), cropping out the cream gap
	 * and the checkout / Studio AI sections below. The ratio is the store's
	 * natural render width : crop height, so the crop point stays constant as the
	 * store scales fluidly with the card width.
	 */
	.scale-viewport {
		width: 100%;
		aspect-ratio: 1000 / 768;
		overflow: hidden;
		/* Decorative preview — never interactive. */
		pointer-events: none;
	}

	/*
	 * Render the store at its natural desktop width, then scale it down to fit the
	 * fluid window. calc() dividing a length by a length yields the unitless
	 * number scale() requires.
	 */
	.scale-inner {
		width: 1000px;
		transform: scale(calc(min(360px, calc(100cqw - 72px)) / 1004px));
		transform-origin: top left;
	}

	/* Butter swatches + script wordmark, stacked vertically and left-aligned. */
	.rail {
		display: flex;
		flex-shrink: 0;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-2);
	}

	.swatch {
		width: 22px;
		height: 22px;
		border-radius: var(--radius-full);
		border: 1px solid rgba(29, 28, 17, 0.12);
	}

	.rail-wordmark {
		font-family: v-bind(BUTTER_SCRIPT);
		font-size: 24px;
		line-height: 1;
		color: var(--color-accent);
	}
</style>
