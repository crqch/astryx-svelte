<!--
	Ported from upstream's `templates/blocks/components/Outline/useOutlineFromMarkdownHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Two translations: `useOutlineFromMarkdown` takes the Markdown as a getter and
	returns `items` as a getter; `Outline`'s `scrollContainerRef` is a getter
	here rather than a `RefObject`, which `bind:ref` on `ScrollableArea` feeds.
-->
<script lang="ts">
	import {
		Button,
		HStack,
		Markdown,
		Outline,
		ScrollableArea,
		VStack,
		useOutlineFromMarkdown
	} from '@astryx-sv/core';

	const ARTICLE = `## Before you start

Check that your project builds on the current release. Commit your work, so
that you can compare the result of the upgrade.

## Run the upgrade

Update the packages, then rebuild the project. The upgrade changes no source
files.

### Update the packages

Install the new version of every package at the same time. Mixed versions fail
the build.

### Rebuild the project

Delete the build output first. A stale cache can hide a real error.

## Check the result

Open the pages that you use most, and compare them with the earlier build.
`;

	const NEW_SECTION = `
## New section

The button added this heading to the Markdown string.
`;

	let markdown = $state(ARTICLE);
	let articleEl = $state<HTMLDivElement | null>(null);

	const outline = useOutlineFromMarkdown(() => markdown);
</script>

<HStack gap={6} align="start" width="100%">
	<ScrollableArea bind:ref={articleEl} label="Article" height={320} width="100%">
		<Markdown children={markdown} />
	</ScrollableArea>
	<VStack gap={3} align="start" width={220}>
		<!-- A non-zero offset moves only the article. With 0, a click also moves
		     the page around the article. -->
		<Outline items={outline.items} scrollContainerRef={() => articleEl} offset={8} />
		<Button
			label="Add section"
			variant="secondary"
			size="sm"
			onclick={() => (markdown += NEW_SECTION)}
		/>
	</VStack>
</HStack>
