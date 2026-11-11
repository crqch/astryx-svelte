<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Card, Heading, Link, Text, VStack } from '@astryx-svelte/core';
	import componentRegistry from '$lib/generated/component-registry.js';
	import { componentsHref, templatesHref, themesHref, topicHref } from '../shell/links.js';
	import ComponentsPreview from './components-preview.svelte';
	import CliPreview from './cli-preview.svelte';
	import ThemesPreview from './themes-preview.svelte';
	import TemplatesPreview from './templates-preview.svelte';

	/**
	 * The bento feature grid, ported from upstream's `_landing/FeaturesShowcase.tsx`.
	 *
	 * The composition is upstream's exactly:
	 *
	 *   col 1: HeadingBlock + Themes (flex, bottom preview)
	 *   col 2: Components (flex, inset preview) + CLI (natural height)
	 *   col 3: Templates (tall, bottom preview)
	 *
	 * The grid is three fixed columns at ≥1024px and one column below that, where
	 * each column wrapper dissolves through `display: contents` and the cards
	 * become direct children laid out in source order. `min-height: 720px` at the
	 * desktop breakpoint is upstream's, and is what gives the dominant Themes tile
	 * room for its composition.
	 *
	 * **All four tiles carry live previews, never baked images.** Upstream replaced
	 * `/feature-components.png`, `/feature-brand.png`, `/feature-templates.png` and
	 * `/feature-cli.png` for a reason it states in the file: the PNGs stayed light
	 * on the dark surface, while real components re-theme with the active mode.
	 *
	 * The CLI tile points at `/docs/working-with-ai` rather than upstream's
	 * `/docs/cli`; that page renders a package README through `PackageStubPage`,
	 * which is unported (port/todo.md → After launch). `working-with-ai` is
	 * upstream's own topic on the same subject, so the link resolves.
	 */

	// Count of public components (excluding hooks and hidden entries), sourced
	// from the generated registry so the number stays accurate as the library
	// grows — upstream's own filter, `!hidden && !name.startsWith('use')`.
	// Rounded down to the nearest 10 for marketing copy — "Over X components"
	// reads better than "Over 87 components" and avoids the displayed number
	// going stale every time a single component lands.
	const CORE_COMPONENT_COUNT = componentRegistry.filter(
		(entry) => !entry.hidden && !entry.name.startsWith('use')
	).length;
	const CORE_COMPONENT_COUNT_ROUNDED = Math.floor(CORE_COMPONENT_COUNT / 10) * 10;

	interface Feature {
		title: string;
		description: string;
		href: string;
		/** Live, theme-aware preview rendered in place of a baked image. */
		preview?: Snippet;
		/** Supporting image, kept for upstream's shape; none of the four uses one today. */
		image?: { src: string; alt: string };
	}

	interface FeatureCardOptions {
		/** Tall-card variant — the right-column Templates treatment. */
		isTall?: boolean;
		/** Grow to fill leftover column height. */
		isFlex?: boolean;
		/** Keep the image inside the card padding instead of bleeding it. */
		insetImage?: boolean;
		/** Centre the full-bleed image vertically in the card. */
		centerImage?: boolean;
		/** Render the image at 75% width. */
		smallImage?: boolean;
		/** Pin the preview to the bottom (extra height opens above it). */
		bottomPreview?: boolean;
	}
</script>

<!--
	Upstream's `FeatureCard`. All cards use `Card padding={0}` and apply their own
	padding via the inner stack. This is intentional: Card's `padding={N}` prop
	wires its padding-bottom through a (0,5,0)-specificity selector which beats
	any override, and the CSS-variable indirection doesn't work either because the
	card sets `padding-bottom: var(--spacing-N)` directly. Owning the padding via
	the inner stack is the only reliable way to get 0 bottom padding for media
	cards while leaving full padding on the text-only card.

	`variant="transparent"` suppresses Card's default border + background so the
	marketing token painted by the card class is the sole surface colour (no blend
	with --color-background-card).
-->
{#snippet featureCard(feature: Feature, options: FeatureCardOptions)}
	{@const hasImage = feature.image != null}
	{@const hasPreview = feature.preview != null}
	{@const hasMedia = hasImage || hasPreview}
	{@const cardClass = options.isTall
		? 'card-tall'
		: options.isFlex
			? 'card-flex'
			: hasMedia
				? 'card'
				: 'card-text-only'}
	{@const paddingClass = hasMedia
		? options.insetImage || hasPreview
			? 'inner-padding-image-inset'
			: 'inner-padding-image'
		: 'inner-padding-text'}
	<Card variant="transparent" padding={0} class="feature-card {cardClass}">
		<div class="card-body {paddingClass}">
			<Heading level={2} color="primary">{feature.title}</Heading>
			<Text type="body" color="primary">{feature.description}</Text>
			<div class="explore-link">
				<Link type="body" color="primary" href={feature.href} hasUnderline={false}>Explore →</Link>
			</div>
			{#if hasPreview && feature.preview}
				<!--
					The wrapper carries upstream's `hAlign="center" vAlign="center"` plus
					the fixed top gap; `preview-wrap-bottom` pins it to the bottom of the
					card instead of leaving that gap above.
				-->
				<div class={options.bottomPreview ? 'preview-wrap preview-wrap-bottom' : 'preview-wrap'}>
					{@render feature.preview()}
				</div>
			{:else if hasImage && feature.image}
				<!--
					The wrapper carries upstream's HStack chrome — flex, direction and
					alignment — plus the sizing in its own class. No width prop: the
					full-bleed wrapper's width is set to calc(100% + 2×40px) so it can
					exceed the inset parent and bleed the image to the card edges.
				-->
				<div
					class={options.isTall
						? 'image-wrap image-wrap-tall'
						: options.insetImage
							? 'image-wrap image-wrap-inset'
							: options.centerImage
								? 'image-wrap image-wrap-centered'
								: 'image-wrap'}
				>
					<img
						src={feature.image.src}
						alt={feature.image.alt}
						class={options.isTall
							? 'feature-image-tall'
							: options.smallImage
								? 'feature-image-small'
								: 'feature-image'}
					/>
				</div>
			{/if}
		</div>
	</Card>
{/snippet}

{#snippet componentsPreview()}<ComponentsPreview />{/snippet}
{#snippet cliPreview()}<CliPreview />{/snippet}
{#snippet themesPreview()}<ThemesPreview />{/snippet}
{#snippet templatesPreview()}<TemplatesPreview />{/snippet}

<VStack as="section" align="center" gap={10} width="100%">
	<!--
		CSS-grid container with responsive column count. Kept as a plain <div>
		rather than `Grid` because we depend on grid's align-items:stretch +
		min-height behaviour to drive equal column heights, and we need to control
		gap/min-height via @media at the wrapper level. `Grid` is optimised for
		fixed column counts + a single gap and doesn't expose the responsive
		min-height pattern this needs.
	-->
	<div class="grid-layout">
		<!--
			Column wrappers use VStack at desktop and dissolve via `display: contents`
			at mobile, so the cards become direct children of the grid and the
			single-column template lays them out in source order.
		-->
		<div class="column">
			<!--
				Plain heading block — sits in the top-left grid slot on the page
				background (no card wrapper) per the bento reference. The text is
				flush-left to the grid column edge (no inline padding) so the display
				heading has the full column width to break onto natural lines. Its
				padding-block-start matches the cards' internal top padding so the
				heading and the adjacent card titles sit on roughly the same vertical
				baseline at the top of the row.
			-->
			<div class="heading-cell">
				<Heading level={2} type="display-2" color="primary">
					Start anywhere.
					<br />
					Change anything.
					<br />
					Ship faster.
				</Heading>
				<Text display="block" type="large" weight="normal" color="secondary">
					A design system that adapts to your workflow, not the other way around. Built for speed,
					clarity, and creative freedom.
				</Text>
			</div>
			{@render featureCard(
				{
					title: 'Themes that fit your brand',
					description:
						'Fully customizable themes ready for use. Make it yours without starting from scratch.',
					href: themesHref(),
					preview: themesPreview
				},
				{ isFlex: true, bottomPreview: true }
			)}
		</div>
		<div class="column">
			{@render featureCard(
				{
					title: `Over ${CORE_COMPONENT_COUNT_ROUNDED} components`,
					description:
						'Accessible and themeable Svelte components with built-in spacing, dark mode, and flexible styling.',
					href: componentsHref(),
					preview: componentsPreview
				},
				{ isFlex: true, insetImage: true }
			)}
			<!--
				Upstream's "Explore" here points at `/docs/cli`, which renders a package
				README through `PackageStubPage` and is unported. `working-with-ai` is
				upstream's own topic on the same subject — agent-readable docs — so the
				link resolves rather than 404ing. It returns to `/docs/cli` when that
				page is built.
			-->
			{@render featureCard(
				{
					title: 'A design system that your agent can use',
					description:
						'Scaffold projects, browse templates, generate themes, and get agent-ready docs from the command line or MCP.',
					href: topicHref('working-with-ai'),
					preview: cliPreview
				},
				{}
			)}
		</div>
		<div class="column">
			{@render featureCard(
				{
					title: 'Ready to ship templates',
					description: 'Production-ready templates for common pages, just plug in your content.',
					href: templatesHref(),
					preview: templatesPreview
				},
				{ isTall: true, bottomPreview: true }
			)}
		</div>
	</div>
</VStack>

<style>
	/*
	 * Bento CSS-grid layout. Each grid cell holds a full-height column wrapper
	 * rather than a single card, so the grid auto-stretches the columns to the
	 * tallest column's natural content height — which is what gives visually
	 * balanced column heights even when one column has one tall card and another
	 * has a tall card plus a short card stacked.
	 *
	 *   <1024px: single column — every card stacks vertically.
	 *   ≥1024px: fixed columns; cards with flex:1 grow to fill leftover space.
	 *
	 * min-height 720 keeps the bento tall enough on desktop that the dominant
	 * Themes tile has room for its composition.
	 */
	.grid-layout {
		width: 100%;
		max-width: var(--docs-content-max-width);
		display: grid;
		/* Tighter stacking gap on mobile; roomier --spacing-8 at the ≥1024px bento. */
		gap: var(--spacing-5);
		grid-template-columns: 1fr;
		min-height: 0;
	}

	@media (min-width: 1024px) {
		.grid-layout {
			gap: var(--spacing-8);
			/* Upstream's three tracks. `minmax(0, 1fr)` (not `1fr`) so a card with
			   wide content — e.g. the Themes preview's left-bleed — cannot blow out
			   its column; all three stay equal. */
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
			min-height: 720px;
		}
	}

	/*
	 * Column wrapper. At desktop it's a flex column that takes the full grid-cell
	 * height and stacks its cards. At mobile the display flips to `contents`,
	 * which dissolves the wrapper so its children become direct grid children —
	 * combined with the parent's single-column template, every card gets its own
	 * row at full width.
	 */
	.column {
		display: contents;
	}

	@media (min-width: 1024px) {
		.column {
			display: flex;
			flex-direction: column;
			/* Upstream's `VStack gap={8} width="100%" height="100%"` — on the *same*
			   element as the display switch, not a Stack nested inside it. Nested,
			   the mobile `display: contents` dissolves only the outer box and the
			   Stack still groups the column's cards into one grid item, so the
			   single-column stack never happens. */
			gap: var(--spacing-8);
			width: 100%;
			height: 100%;
		}
	}

	/*
	 * Heading cell — the top-left column starts with plain text on the page
	 * background (no card wrapper) per the bento reference. padding-block-start
	 * matches the cards' internal padding so the heading baseline visually aligns
	 * with the heading inside the adjacent card. NO inline padding: the reference
	 * shows the heading text starting flush at the column's left edge.
	 */
	.heading-cell {
		/* Upstream's `VStack gap={4}` + `styles.headingCell` on one box. */
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		align-items: center;
		padding-block-start: var(--spacing-5);
		width: 100%;
		text-align: center;
	}

	@media (min-width: 1024px) {
		.heading-cell {
			align-items: flex-start;
			text-align: start;
		}
	}

	/* All card variants share the same pastel backdrop, pulled from a
	   marketing-only token (defined in landing.css). We do NOT use Card's
	   `variant="blue"` here because that token is a 20%-alpha saturated wash that
	   prints too vivid against the showcase's white surface; the marketing token
	   is a soft pastel band hand-tuned for this section. */
	.grid-layout :global(.feature-card) {
		background-color: var(--astryx-marketing-feature-card-bg);
		overflow: hidden;
	}

	/* Tall card variant — the right-column Templates card. flex:1 grows the card
	   to fill its parent column wrapper, which is stretched by the grid to match
	   the tallest sibling column. */
	.grid-layout :global(.card-tall) {
		flex: 1;
	}

	/* Regular media card — natural (content) height. Used for a card that shares
	   its column with a grow-to-fill sibling. */
	.grid-layout :global(.card) {
		height: auto;
	}

	/* Flex variant — grows to fill its column's leftover height so a column with
	   a short sibling can still match the height of an adjacent column. */
	.grid-layout :global(.card-flex) {
		flex: 1;
	}

	/* Text-only feature card — no media, shrink-to-content. */
	.grid-layout :global(.card-text-only) {
		height: auto;
	}

	/* Upstream's inner VStack: gap={1}, align="start", height="100%", plus one of
	   the padding variants below. box-sizing so the 100% height includes that
	   padding rather than overflowing the card by 80px. */
	.card-body {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-1);
		height: 100%;
		box-sizing: border-box;
	}

	/* Image cards: 40px on top + sides, 0 on the bottom so the image sits flush
	   at the card's bottom edge. */
	.inner-padding-image {
		padding-block-start: var(--spacing-10);
		padding-inline: var(--spacing-10);
		padding-block-end: 0;
	}

	/* Image cards whose image stays inset (framed) rather than full-bleed — 40px
	   on all four sides. */
	.inner-padding-image-inset {
		padding: var(--spacing-10);
	}

	/* Text-only card: 40px on all sides, matching the image cards' top + sides. */
	.inner-padding-text {
		padding: var(--spacing-10);
	}

	/* Explore link spacing — the inner stack gap holds heading↔description at
	   4px, but the link below the description wants 16px. */
	.explore-link {
		margin-top: var(--spacing-3);
	}

	/* Preview wrapper. A fixed top gap (not margin-top:auto) keeps the space under
	   "Explore" consistent across preview cards; any extra card height falls below
	   the framed preview rather than above it. Flex + centring are upstream's
	   `HStack hAlign="center" vAlign="center"`. */
	.preview-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		padding-top: var(--spacing-10);
		align-self: stretch;
		width: 100%;
		min-width: 0;
		max-width: 100%;
	}

	/* Bottom-anchored preview wrapper. margin-top:auto pushes the preview to the
	   bottom of the card's content column so any extra card height opens up above
	   it. Used by the Themes and Templates cards. */
	.preview-wrap-bottom {
		margin-top: auto;
	}

	/* Image wrapper for the three image cards. The image is full-bleed: it spans
	   the entire card width and touches the card's left, right and bottom edges.
	   The wrapper cancels the inner stack's 40px inline padding with negative
	   inline margins so it reaches the card edges. margin-top:auto pushes it to the
	   bottom; overflow:hidden keeps the bottom corners rounded. */
	.image-wrap {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		margin-top: auto;
		padding-top: var(--spacing-10);
		margin-inline: calc(-1 * var(--spacing-10));
		width: calc(100% + 2 * var(--spacing-10));
		min-width: 0;
		overflow: hidden;
	}

	/* Tall-card image wrapper — same full-bleed treatment, centred like upstream's
	   `hAlign="center"` on the tall card. */
	.image-wrap-tall {
		justify-content: center;
		margin-top: auto;
		padding-top: var(--spacing-10);
		margin-inline: calc(-1 * var(--spacing-10));
		width: calc(100% + 2 * var(--spacing-10));
		min-width: 0;
		overflow: hidden;
	}

	/* Vertically-centred full-bleed image wrapper. */
	.image-wrap-centered {
		margin-block: auto;
		padding-top: var(--spacing-10);
		margin-inline: calc(-1 * var(--spacing-10));
		width: calc(100% + 2 * var(--spacing-10));
		min-width: 0;
		overflow: hidden;
	}

	/* Inset (framed) image wrapper — no bleed. */
	.image-wrap-inset {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		margin-top: auto;
		padding-top: var(--spacing-10);
		align-self: stretch;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
	}

	/* Default image: full-bleed to the card width, natural aspect ratio. */
	.feature-image {
		width: 100%;
		height: auto;
		display: block;
	}

	/* Reduced-size image — 3/4 of the wrapper width. */
	.feature-image-small {
		width: 75%;
		height: auto;
		display: block;
	}

	/* Tall-card image: same full-bleed treatment. */
	.feature-image-tall {
		width: 100%;
		height: auto;
		display: block;
	}
</style>
