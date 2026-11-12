<!--
	Ported from upstream's `templates/blocks/components/Carousel/CarouselSnapPaging.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Upstream re-reads `pages` on every render. This port's hook reads it when a
	flick starts, so the object carries a getter — the shape its docs prescribe for
	a value that can change. `Carousel` takes `items` plus an `item` snippet where
	upstream maps `children`, the same data-driven translation `OverflowList` took.
-->
<script lang="ts">
	import { Card, Carousel, Stack, Switch, Text, useSnapPaging } from '@astryx-sv/core';

	const SCREENS = [
		{ title: 'Welcome', body: 'Swipe to see what is new.' },
		{ title: 'Shared albums', body: 'Invite friends to add their photos.' },
		{ title: 'Memories', body: 'See a day from years ago.' },
		{ title: 'Search', body: 'Find a photo by what is in it.' },
		{ title: 'All set', body: 'Your library is ready.' }
	];

	let isOneCard = $state(false);
	// A flick moves one view, or one card with {pages: 'item'}.
	const paging = useSnapPaging({
		get pages() {
			return isOneCard ? 'item' : 'view';
		}
	});
</script>

<Stack direction="vertical" gap={3} style="max-width: 520px; padding: 8px">
	<Switch label="One card per flick" value={isOneCard} onChange={(next) => (isOneCard = next)} />
	<Carousel items={SCREENS} gap={2} hasSnap={paging} aria-label="Onboarding">
		{#snippet item(screen)}
			<Card width={220} minHeight={160}>
				<Stack direction="vertical" gap={1}>
					<Text type="body" weight="bold">{screen.title}</Text>
					<Text type="body" color="secondary">{screen.body}</Text>
				</Stack>
			</Card>
		{/snippet}
	</Carousel>
</Stack>
