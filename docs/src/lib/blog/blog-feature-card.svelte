<script lang="ts">
	import { AspectRatio, Heading, Link, Text, VisuallyHidden, VStack } from '@astryx-svelte/core';
	import type { BlogPost } from './schema.js';
	import { parseReleaseVersion } from './release.js';
	import AuthorByline from './author-byline.svelte';
	import BlogCoverArt from './blog-cover-art.svelte';
	import ReleaseCoverArt from './release-cover-art.svelte';

	/**
	 * Showcase-only feature card for `BlogShowcase`'s equal-height split —
	 * upstream's `blog/BlogFeatureCard`.
	 *
	 * Unlike the shared `BlogCard`, whose Link-wrapped body cannot fill a
	 * stretched grid cell, this is a plain flex column with the cover growing to
	 * absorb extra height, so the title and byline stay tight at the bottom. The
	 * whole card is made clickable by an absolutely positioned `Link` overlay
	 * carrying a visually-hidden label.
	 *
	 * The cover has the same three arms as `BlogCard`: authored `coverImage`,
	 * `ReleaseCoverArt` when the title carries a version, otherwise the
	 * generative `BlogCoverArt`, seeded from the post slug in its denser
	 * feature layout.
	 */
	interface Props {
		post: BlogPost;
		hideDescription?: boolean;
	}

	const { post, hideDescription = false }: Props = $props();

	const releaseVersion = $derived(parseReleaseVersion(post.title));
</script>

<div class="card">
	<AspectRatio ratio={16 / 9} class="cover">
		{#if post.coverImage}
			<img class="cover-img" src={post.coverImage} alt={post.coverAlt ?? ''} />
		{:else if releaseVersion}
			<ReleaseCoverArt version={releaseVersion} packageName={post.releasePackage ?? undefined} />
		{:else}
			<BlogCoverArt seed={post.slug} feature />
		{/if}
	</AspectRatio>
	<VStack gap={3}>
		<VStack gap={1}>
			<Heading level={1} class="title">{post.title}</Heading>
			{#if !hideDescription}
				<div class="excerpt">
					<Text type="large" weight="normal" color="secondary" class="description">
						{post.description}
					</Text>
				</div>
			{/if}
		</VStack>
		<AuthorByline
			authors={post.authors}
			date={post.date}
			readingTimeMinutes={post.readingTimeMinutes}
			variant="compact"
		/>
	</VStack>
	<div class="overlay">
		<Link href="/blog/{post.slug}" label={post.title} color="inherit" display="block">
			<VisuallyHidden>{post.title}</VisuallyHidden>
		</Link>
	</div>
</div>

<style>
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		min-width: 0;
		height: 100%;
		color: inherit;
	}

	/*
	 * `flex-grow: 1` absorbs the card's extra height when it is stretched taller
	 * than 16:9, so the title and byline stay tight; the image crops to fit.
	 */
	.card :global(.cover) {
		border-radius: var(--radius-container);
		background-color: var(--color-background-muted);
		border: 1px solid var(--color-border);
		overflow: hidden;
		flex-grow: 1;
	}

	.cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.excerpt {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Below 1024px (where the showcase split stacks) match the compact cards'
	   title size; scale up to the feature size only in the two-column split. */
	.card :global(.title) {
		font-size: var(--text-heading-3-size);
		line-height: var(--text-heading-3-leading);
	}

	@media (min-width: 1024px) {
		.card :global(.title) {
			font-size: var(--text-heading-1-size);
			line-height: var(--text-heading-1-leading);
		}
	}

	/* The card-wide link overlay: sibling of the content, not an ancestor, so a
	   nested anchor can never occur. */
	.overlay {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-container);
	}

	.overlay :global(a) {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-container);
	}
</style>
