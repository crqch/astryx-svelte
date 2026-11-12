<script lang="ts" module>
	/**
	 * The six themes with a bespoke 120px picker banner upstream ships under
	 * `public/images/theme-<slug>-picker.png`. A theme with no row takes the
	 * default radial-gradient tile, which is upstream's documented fallback.
	 * Chocolate and Liquid Glass are in neither upstream's registry nor this set.
	 */
	const PICKER_ART = new Set(['neutral', 'stone', 'gothic', 'matcha', 'y2k', 'butter']);
</script>

<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import {
		Button,
		Card,
		Carousel,
		CodeBlock,
		Divider,
		Heading,
		HStack,
		Link,
		LinkProvider,
		Popover,
		Section,
		SelectableCard,
		Selector,
		Skeleton,
		Text,
		Theme,
		VStack,
		type PopoverTriggerRenderProps
	} from '@astryx-sv/core';
	import { createAttachmentKey } from 'svelte/attachments';
	import Seo from '$lib/seo/seo.svelte';
	import MoonIcon from '$lib/shell/moon-icon.svelte';
	import SunIcon from '$lib/shell/sun-icon.svelte';
	import PreviewAnchor from '$lib/shell/theme-preview-anchor.svelte';
	import { templateImporterFor } from '$lib/shell/example-modules.js';
	import { getColorModeContext } from '$lib/shell/color-mode.svelte.js';
	import { topicHref } from '$lib/shell/links.js';
	import { getThemeShowcaseContent } from '$lib/shell/theme-showcase-content.js';
	import {
		DEFAULT_THEME_SLUG,
		THEME_LISTINGS,
		themeLabel,
		type ThemeListing
	} from '$lib/shell/theme-packages.js';

	/**
	 * `/themes` — upstream's theme explorer, `ThemePackagePage`.
	 *
	 * The structure is upstream's, dimension for dimension: a 260px sticky rail of
	 * `SelectableCard` picker tiles inside a `Card`, the shared heading (title,
	 * copy and "Learn how theming works" link) with the per-preview light/dark
	 * toggle beside it, the same heading repeated as a centred mobile context, the
	 * 140px-item mobile carousel that replaces the rail below 900px, the floating
	 * Selector bar that appears once that carousel scrolls out of view, and the
	 * themed preview inside a clipped `Card`.
	 *
	 * **The preview is the real page template.** Upstream renders
	 * `ThemeShowcaseStore` from
	 * `packages/cli/assets/templates/pages/theme-showcase/`; this port has that
	 * template transcribed (`+page.svelte`), and it is loaded through
	 * `templateImporterFor('theme-showcase')` — the same seam `/templates` uses for
	 * every page template. Per-theme content comes from
	 * `shell/theme-showcase-content.ts`, upstream's `themeShowcaseContent.ts`
	 * ported record for record, so Matcha sees a café menu and Butter a bakery.
	 *
	 * **Two upstream affordances have no counterpart here and are not faked.**
	 * "Try in Playground" is absent because `/playground` is not in this port
	 * (`port/todo.md`), and linking a 404 is worse than not linking — the same call
	 * `template-preview-dialog.svelte` records. The install action survives as the
	 * "Use this theme" popover, but its command prints this port's real bin,
	 * `astryx-svelte theme add <slug>`, rather than upstream's `npx
	 * @astryxdesign/cli …`: `@astryx-sv/cli` is private, so `npx` cannot resolve
	 * it (the same substitution the template dialog makes).
	 *
	 * **The picker artwork is vendored.** Upstream's six themes have a dedicated
	 * 120px banner under its docsite `public/images/theme-<slug>-picker.png`, and
	 * those files are copied into `docs/static/images/`; a theme with no banner
	 * (Chocolate, Liquid Glass — neither is upstream's) takes the default
	 * multi-radial gradient, which is upstream's documented fallback.
	 *
	 * **The mode toggle is per-preview, not the site's**, as upstream's is. Its
	 * default is the site's resolved mode, exactly as its `localMode ?? siteMode`;
	 * a theme with no light/dark pair (Gothic is dark-only here) disables it rather
	 * than offering a mode the theme does not have. Passing `'dark'` for that theme
	 * is what the theme's own values resolve to either way.
	 */

	const colorMode = getColorModeContext();

	/**
	 * The URL's `?theme=<slug>`, adopted after hydration.
	 *
	 * `page.url.searchParams` throws during prerender — SvelteKit disallows it so a
	 * build cannot bake one request's query into a static file — so this cannot be
	 * a `$derived`, exactly as `/templates`' `?preview=` records. The effect writes
	 * without reading, and `$state` skips equal writes, so `handleSelect`'s own
	 * `replaceState` echo is a no-op rather than a second render.
	 */
	// eslint-disable-next-line svelte/prefer-writable-derived
	let requestedSlug = $state<string | null>(null);

	$effect(() => {
		requestedSlug = page.url.searchParams.get('theme');
	});

	/**
	 * Upstream resolves the requested package and falls back to Neutral when the
	 * param is missing, malformed, or names something outside the registry. The
	 * slug lookup does that in one step, and `THEME_LISTINGS` is ordered with
	 * Neutral first.
	 */
	const selected = $derived(
		THEME_LISTINGS.find((listing) => listing.slug === requestedSlug) ?? THEME_LISTINGS[0]
	);

	/** A single-mode theme has one appearance; the toggle would be a lie. */
	const hasBothModes = $derived(selected.lightDarkPairs > 0);

	/** `localMode` is null until the reader uses the preview's own toggle. */
	let localMode = $state<'light' | 'dark' | null>(null);
	const mode = $derived<'light' | 'dark'>(hasBothModes ? (localMode ?? colorMode.mode) : 'dark');

	function handleToggleMode(): void {
		localMode = mode === 'light' ? 'dark' : 'light';
	}

	/**
	 * Selection is a filter on the explorer, not a navigation step: upstream uses
	 * `router.replace(url, {scroll:false})`, which here is SvelteKit's
	 * `replaceState` — same history entry, no scroll, no reload. The bare `/themes`
	 * URL is the Neutral seed, so selecting Neutral clears the param rather than
	 * writing `?theme=neutral`.
	 */
	function handleSelect(listing: ThemeListing): void {
		requestedSlug = listing.slug;
		const url = new URL(page.url);
		url.search = '';
		if (listing.slug !== DEFAULT_THEME_SLUG) url.searchParams.set('theme', listing.slug);
		replaceState(url, page.state);
	}

	const options = $derived(
		THEME_LISTINGS.map((listing) => ({ value: listing.slug, label: themeLabel(listing.slug) }))
	);

	/** The mobile bar appears once the carousel leaves the viewport. */
	let carouselEl = $state<HTMLElement | null>(null);
	let showMobileBar = $state(false);

	$effect(() => {
		const el = carouselEl;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				showMobileBar = !entry.isIntersecting;
			},
			{ threshold: 0 }
		);
		observer.observe(el);
		return () => observer.disconnect();
	});

	/** The showcase chunk is requested once; changing themes only changes CSS. */
	const showcaseLoad = templateImporterFor('theme-showcase')?.();
	const showcaseContent = $derived(getThemeShowcaseContent(selected.slug) ?? {});

	const modeToggleLabel = $derived(
		!hasBothModes
			? `${themeLabel(selected.slug)} declares a single mode`
			: mode === 'light'
				? 'Switch preview to dark mode'
				: 'Switch preview to light mode'
	);

	/** The "Use this theme" popover's command. See the header note on the bin. */
	const scaffoldCommand = $derived(`astryx-svelte theme add ${selected.slug}`);
	const scaffoldName = $derived(selected.slug.charAt(0).toUpperCase() + selected.slug.slice(1));

	/** Keeps `{@attach}` out of the trigger template and stable across renders. */
	const triggerRefKey = createAttachmentKey();
</script>

{#snippet sunIcon()}
	<SunIcon size={16} />
{/snippet}

{#snippet moonIcon()}
	<MoonIcon size={16} />
{/snippet}

{#snippet themeHeading(align: 'start' | 'center', isMobile: boolean)}
	{@const isCentered = align === 'center'}
	<VStack gap={2} hAlign={isCentered ? 'center' : undefined}>
		<HStack gap={2} vAlign="center" style="width: 100%;">
			<Heading
				level={1}
				type={isMobile ? 'display-2' : 'display-3'}
				justify={align}
				style="flex: 1; min-width: 0;"
			>
				Themes
			</Heading>
			<Button
				variant="ghost"
				size="lg"
				isIconOnly
				label={modeToggleLabel}
				tooltip={modeToggleLabel}
				icon={mode === 'dark' ? sunIcon : moonIcon}
				isDisabled={!hasBothModes}
				onclick={handleToggleMode}
			/>
		</HStack>
		<VStack gap={1} hAlign={isCentered ? 'center' : undefined}>
			<Text type="body" color="secondary" justify={align}>
				Astryx comes with a default theme built in. To make it your own, copy any theme you see here
				into a theme file you own.
			</Text>
			<Link type="body" color="secondary" href={topicHref('theme')} hasUnderline>
				Learn how theming works
			</Link>
		</VStack>
	</VStack>
{/snippet}

{#snippet useThemeContent()}
	<VStack gap={2}>
		<Text type="body">
			Run this in a terminal in your project to add {scaffoldName} as a theme file you can edit.
		</Text>
		<CodeBlock
			code={scaffoldCommand}
			language="bash"
			size="sm"
			container="section"
			width="100%"
			isWrapped
			hasLanguageLabel={false}
			style="width: 100%; border-radius: var(--radius-element); background-color: var(--color-background-muted);"
		/>
	</VStack>
{/snippet}

{#snippet useThemeTrigger(triggerProps: PopoverTriggerRenderProps)}
	<Button
		{...{ [triggerRefKey]: triggerProps.ref }}
		onclick={triggerProps.onClick}
		aria-haspopup={triggerProps['aria-haspopup']}
		aria-expanded={triggerProps['aria-expanded']}
		aria-controls={triggerProps['aria-controls']}
		variant="primary"
		size="lg"
		label="Use this theme"
		style="width: 100%;"
	/>
{/snippet}

{#snippet themeActions()}
	<VStack gap={2} align="stretch">
		<Popover width={300} label="Use this theme" content={useThemeContent}>
			{#snippet trigger(triggerProps)}
				{@render useThemeTrigger(triggerProps)}
			{/snippet}
		</Popover>
	</VStack>
{/snippet}

{#snippet pickerCard(listing: ThemeListing, isMobile: boolean)}
	{@const label = themeLabel(listing.slug)}
	{@const hasArt = PICKER_ART.has(listing.slug)}
	<SelectableCard
		label={`Preview ${label} theme`}
		isSelected={listing.slug === selected.slug}
		onChange={() => handleSelect(listing)}
		padding={0}
		variant="transparent"
		style={isMobile ? undefined : 'width: 100%;'}
	>
		<Theme theme={listing.theme} mode="light">
			<div class="themed-surface">
				<Text
					type="display-3"
					weight="bold"
					style="font-size: {isMobile ? 20 : 24}px; line-height: 1.2; color: {hasArt
						? 'var(--color-accent)'
						: 'var(--color-text-primary)'}; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; position: relative; z-index: 1;"
				>
					{label}
				</Text>
			</div>
		</Theme>
	</SelectableCard>
{/snippet}

<Seo
	title="Themes"
	description="Browse and preview every Astryx theme and see how design tokens, type, and components restyle across the gallery."
/>

<Section maxWidth={1200} padding={6} style="margin-inline: auto;">
	<div class="explorer">
		<aside class="sidebar" aria-label="Theme picker">
			<Card variant="default" padding={4}>
				<VStack gap={4}>
					<VStack gap={5}>
						{@render themeHeading('start', false)}
						{@render themeActions()}
					</VStack>

					<Divider />

					<div class="theme-list">
						{#each THEME_LISTINGS as listing (listing.slug)}
							{@render pickerCard(listing, false)}
						{/each}
					</div>
				</VStack>
			</Card>
		</aside>

		<div class="right-column">
			<!-- Floating toolbar: appears once the carousel is out of view. -->
			<div class="mobile-bar" class:mobile-bar-visible={showMobileBar}>
				<div class="mobile-selector">
					<Selector
						label="Theme"
						isLabelHidden
						size="sm"
						placement="above"
						{options}
						value={selected.slug}
						onChange={(value: string | null) => {
							const listing = THEME_LISTINGS.find((entry) => entry.slug === value);
							if (listing) handleSelect(listing);
						}}
					/>
				</div>
				<Button
					variant="ghost"
					size="sm"
					isIconOnly
					label={modeToggleLabel}
					tooltip={modeToggleLabel}
					icon={mode === 'dark' ? sunIcon : moonIcon}
					isDisabled={!hasBothModes}
					onclick={handleToggleMode}
				/>
			</div>

			<div class="mobile-context">
				{@render themeHeading('center', true)}
				{@render themeActions()}
			</div>

			<div class="mobile-carousel" bind:this={carouselEl}>
				<Carousel items={THEME_LISTINGS} gap={3} hasButtons={false} hasSnap aria-label="Themes">
					{#snippet item(listing: ThemeListing)}
						<div class="mobile-carousel-item">
							{@render pickerCard(listing, true)}
						</div>
					{/snippet}
				</Carousel>
			</div>

			<div class="preview">
				<Card padding={0} style="overflow: hidden;">
					<Theme theme={selected.theme} {mode}>
						<LinkProvider component={PreviewAnchor}>
							{#if showcaseLoad}
								<svelte:boundary>
									{#await showcaseLoad}
										<Skeleton width="100%" height={720} />
									{:then module}
										{@const Showcase = module.default}
										<Showcase {...showcaseContent} />
									{:catch}
										<div class="preview-unavailable">
											<Text type="supporting" color="secondary">Preview unavailable</Text>
										</div>
									{/await}

									{#snippet failed()}
										<div class="preview-unavailable">
											<Text type="supporting" color="secondary">Preview unavailable</Text>
										</div>
									{/snippet}
								</svelte:boundary>
							{:else}
								<div class="preview-unavailable">
									<Text type="supporting" color="secondary">Preview unavailable</Text>
								</div>
							{/if}
						</LinkProvider>
					</Theme>
				</Card>
			</div>
		</div>
	</div>
</Section>

<style>
	/* Upstream's ThemeExplorerLayout: a fixed rail and a flexible pane, column
	   below the shared 900px breakpoint. */
	.explorer {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: var(--spacing-6);
	}

	.sidebar {
		flex: 0 0 auto;
		width: 260px;
		position: sticky;
		top: calc(var(--_app-shell-header-height, 64px) + var(--spacing-4));
		max-height: calc(100dvh - var(--_app-shell-header-height, 64px) - var(--spacing-4) * 2);
		overflow-y: auto;
	}

	.right-column {
		flex: 1 1 0;
		min-width: 0;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-8);
	}

	.theme-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	/* Upstream's 120px picker tile: a five-stop radial bloom made from the theme's
	   own accent and categorical hues, with the wordmark centred on top. */
	.themed-surface {
		height: 120px;
		padding: var(--spacing-4);
		border-radius: 12px;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		background-color: var(--color-background-surface);
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		background-image:
			radial-gradient(
				circle at 0% 0%,
				color-mix(in srgb, var(--color-accent) 65%, transparent),
				transparent 60%
			),
			radial-gradient(
				circle at 100% 0%,
				color-mix(in srgb, var(--color-background-orange) 70%, transparent),
				transparent 60%
			),
			radial-gradient(
				circle at 0% 100%,
				color-mix(in srgb, var(--color-background-green) 70%, transparent),
				transparent 60%
			),
			radial-gradient(
				circle at 100% 100%,
				color-mix(in srgb, var(--color-background-blue) 70%, transparent),
				transparent 60%
			),
			radial-gradient(
				circle at 50% 50%,
				color-mix(in srgb, var(--color-accent-muted) 50%, transparent),
				transparent 70%
			);
	}

	/* Per-theme bespoke picker artwork, one rule per theme with a banner. The
	   rail renders each card through its own `<Theme>`, whose wrapper carries
	   the attribute, so the slug is what selects the image. */
	:global([data-astryx-theme='butter']) .themed-surface {
		background-color: transparent;
		background-image: url('/images/theme-butter-picker.png');
	}

	:global([data-astryx-theme='gothic']) .themed-surface {
		background-color: transparent;
		background-image: url('/images/theme-gothic-picker.png');
	}

	:global([data-astryx-theme='y2k']) .themed-surface {
		background-color: transparent;
		background-image: url('/images/theme-y2k-picker.png');
	}

	:global([data-astryx-theme='stone']) .themed-surface {
		background-color: transparent;
		background-image: url('/images/theme-stone-picker.png');
	}

	:global([data-astryx-theme='neutral']) .themed-surface {
		background-color: transparent;
		background-image: url('/images/theme-neutral-picker.png');
	}

	:global([data-astryx-theme='matcha']) .themed-surface {
		background-color: transparent;
		background-image: url('/images/theme-matcha-picker.png');
	}

	.mobile-context,
	.mobile-carousel,
	.mobile-bar {
		display: none;
	}

	.preview {
		width: 100%;
		max-width: 1200px;
		margin-inline: auto;
		overflow: hidden;
		border-radius: var(--radius-container);
	}

	.preview-unavailable {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 720px;
	}

	/* Upstream's fixed mobile toolbar: a floating pill at the bottom centre with
	   the theme Selector and the mode toggle, hidden until the carousel leaves
	   view. `opacity` + `pointer-events` rather than `display`, so it fades. */
	.mobile-bar {
		flex-direction: row;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2);
		border-radius: var(--radius-full);
		border-width: var(--border-width);
		border-style: solid;
		border-color: var(--color-border);
		background-color: var(--color-background-card);
		box-shadow: var(--shadow-high);
		position: fixed;
		bottom: var(--spacing-4);
		left: 0;
		right: 0;
		margin-inline: auto;
		z-index: 100;
		width: fit-content;
		max-width: calc(100vw - var(--spacing-4) * 2);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
	}

	.mobile-bar-visible {
		opacity: 1;
		pointer-events: auto;
	}

	.mobile-selector {
		min-width: 160px;
	}

	@media (max-width: 900px) {
		.explorer {
			flex-direction: column;
		}

		.sidebar {
			display: none;
		}

		.mobile-context {
			display: flex;
			flex-direction: column;
			gap: var(--spacing-5);
		}

		.mobile-carousel {
			display: flex;
			width: 100%;
		}

		.mobile-bar {
			display: flex;
		}

		.preview {
			max-width: none;
		}
	}

	.mobile-carousel-item {
		flex-shrink: 0;
		width: 140px;
	}
</style>
