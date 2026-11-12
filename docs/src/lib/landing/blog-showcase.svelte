<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button, Heading, Icon, VStack } from '@astryx-sv/core';
	import blogRegistry from '$lib/generated/blog-registry.js';
	import type { BlogPost } from '$lib/blog/schema.js';
	import BlogCard from '$lib/blog/blog-card.svelte';
	import BlogFeatureCard from '$lib/blog/blog-feature-card.svelte';

	/**
	 * Home-page "Blog" section, ported from upstream's `_landing/BlogShowcase.tsx`.
	 *
	 * Auto-surfaces the most recent posts from the build-time registry, already
	 * sorted latest-first. The layout adapts to how many posts are published:
	 *
	 *   - exactly 2 posts → a balanced 50/50 grid of two equal feature cards;
	 *   - 3+ posts → a featured split: the latest post is a large feature card on
	 *     the left and the next two render as compact cards stacked on the right;
	 *   - 1 post → the same full-width feature treatment, without an empty column.
	 *
	 * Cards are the shared `BlogCard` (also used on the blog index) with the
	 * excerpt hidden, and the left/large card uses `BlogFeatureCard`. An empty
	 * registry omits the section entirely rather than passing an undefined post to
	 * a card.
	 */
	const blogPosts = blogRegistry.posts as BlogPost[];

	// The featured-split layout (3+ posts) renders 1 feature (left) + 2 compact
	// (right), filled by the 3 most recent posts (`blogPosts` is latest-first).
	const SLOT_COUNT = 3;
</script>

<!--
	Upstream's ArrowRight from lucide. The built-in registry has no right arrow —
	`chevronRight` is the nearest reading of "read the rest" — so this is a
	stand-in that retires with the icon registry (port/todo.md → Phase 3).
-->
{#snippet arrowRightIcon()}<Icon icon="chevronRight" size="sm" />{/snippet}

{#snippet singleCard()}
	<BlogCard post={blogPosts[0]} feature hideDescription />
{/snippet}

{#snippet twoCards()}
	<BlogCard post={blogPosts[0]} feature hideDescription />
	<BlogCard post={blogPosts[1]} feature hideDescription />
{/snippet}

{#snippet twoUpGrid(children: Snippet)}
	<div class="two-up-grid">
		{@render children()}
	</div>
{/snippet}

{#snippet blogSingle()}
	{@render twoUpGrid(singleCard)}
{/snippet}

{#snippet blogTwo()}
	{@render twoUpGrid(twoCards)}
{/snippet}

{#snippet blogMany()}
	{@const [featurePost, ...compactPosts] = blogPosts.slice(0, SLOT_COUNT)}
	<div class="split-grid">
		<BlogFeatureCard post={featurePost} hideDescription />
		<div class="right-col">
			{#each compactPosts as post (post.slug)}
				<BlogCard {post} hideDescription />
			{/each}
		</div>
	</div>
{/snippet}

{#snippet blogSection(children: Snippet)}
	<VStack as="section" align="center" gap={8} width="100%">
		<div class="section">
			<div class="header">
				<Heading level={2} type="display-2" color="primary">Stay in the know</Heading>
				<Button variant="ghost" label="View all posts" href="/blog" endContent={arrowRightIcon} />
			</div>
			{@render children()}
		</div>
	</VStack>
{/snippet}

{#if blogPosts.length === 0}
	<!-- The registry can be empty when a deployment has no published posts yet. -->
{:else if blogPosts.length === 1}
	<!-- A single post gets the full-width feature treatment, no empty column. -->
	{@render blogSection(blogSingle)}
{:else if blogPosts.length === 2}
	<!--
		Exactly two posts → a balanced 50/50 grid of two equal feature cards. This
		reads as intentional, whereas the featured split would leave a lonely blank
		placeholder in the right column.
	-->
	{@render blogSection(blogTwo)}
{:else}
	<!--
		Three+ posts → featured split. Slot 0 → feature (left); slots 1–2 → compact
		(right), filled by the 3 most recent posts.
	-->
	{@render blogSection(blogMany)}
{/if}

<style>
	/* Cap the section so all three home showcases line up vertically inside the
	   showcase overlay container. */
	.section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-8);
		width: 100%;
		max-width: 1200px;
	}

	.header {
		display: flex;
		width: 100%;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		row-gap: var(--spacing-2);
	}

	/*
	 * Featured split (3+ posts): a wide feature card + a stack of two compact
	 * cards at a 2.4 : 1 ratio. align-items:stretch makes both columns equal
	 * height; collapses to one column below 1024px.
	 */
	.split-grid {
		width: 100%;
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-8);
		align-items: stretch;
	}

	@media (min-width: 1024px) {
		.split-grid {
			grid-template-columns: 2.4fr 1fr;
		}
	}

	.right-col {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: var(--spacing-6);
		min-width: 0;
		height: 100%;
	}

	/*
	 * Two equal cards, side by side when there is room and stacked otherwise.
	 * `min(480px, 100%)` clamps the track to the container so it never forces a
	 * 480px column wider than a small viewport (which overflowed the page).
	 */
	.two-up-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(480px, 100%), 1fr));
		gap: var(--spacing-8);
		width: 100%;
		align-items: start;
	}
</style>
