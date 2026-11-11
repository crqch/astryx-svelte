<!--
	Ported from upstream's `templates/blocks/components/ScrollableArea/ScrollableAreaOverscrollChaining.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
	The hairline frame upstream writes with StyleX is an inline style here; the
	docs example is content, not a component surface.
-->
<script lang="ts">
	import { Card, Grid, Heading, ScrollableArea, Text, VStack } from '@astryx-svelte/core';

	const SHARED = [
		{ id: 'brand', title: 'Brand refresh', meta: 'Priya Raman' },
		{ id: 'checkout', title: 'Checkout audit', meta: 'Tomas Lindqvist' },
		{ id: 'partner', title: 'Partner deck', meta: 'Ines Okafor' },
		{ id: 'research', title: 'Research synthesis', meta: 'Mei Watanabe' },
		{ id: 'tax', title: 'Tax region notes', meta: 'Hugo Bernard' },
		{ id: 'sso', title: 'SSO rollout plan', meta: 'Sofia Marchetti' }
	];

	const ARCHIVED = [
		{ id: 'roadmap', title: '2025 roadmap', meta: 'Archived in March' },
		{ id: 'legacy', title: 'Legacy pricing', meta: 'Archived in March' },
		{ id: 'kit', title: 'Old brand kit', meta: 'Archived in January' },
		{ id: 'beta', title: 'Beta feedback', meta: 'Archived in January' },
		{ id: 'survey', title: 'Q4 survey results', meta: 'Archived in January' },
		{ id: 'offsite', title: 'Offsite agenda', meta: 'Archived last year' }
	];

	const frame = 'border: 1px solid var(--color-border); border-radius: var(--radius-element)';
</script>

{#snippet fileGrid(files: typeof SHARED)}
	<Grid columns={2} gap={2}>
		{#each files as file (file.id)}
			<Card variant="muted" padding={3}>
				<VStack gap={1}>
					<Text weight="medium" maxLines={1}>{file.title}</Text>
					<Text type="supporting" maxLines={1}>{file.meta}</Text>
				</VStack>
			</Card>
		{/each}
	</Grid>
{/snippet}

<Card width={400} padding={0}>
	<ScrollableArea axis="block" role="region" label="Workspace files" height={300} padding={4}>
		<VStack gap={4}>
			<VStack gap={0.5}>
				<Heading level={3}>Workspace files</Heading>
				<Text type="supporting">Two sections, two edge policies</Text>
			</VStack>

			<VStack gap={2}>
				<Text type="label" color="secondary">Shared with you</Text>
				<ScrollableArea axis="block" label="Shared with you" height={150} padding={2} style={frame}>
					{@render fileGrid(SHARED)}
				</ScrollableArea>
				<Text type="supporting">Scroll past the end and the panel keeps going.</Text>
			</VStack>

			<VStack gap={2}>
				<Text type="label" color="secondary">Archived</Text>
				<ScrollableArea
					axis="block"
					label="Archived"
					overscroll="contain"
					height={150}
					padding={2}
					style={frame}
				>
					{@render fileGrid(ARCHIVED)}
				</ScrollableArea>
				<Text type="supporting">Scroll past the end and the panel stays where it is.</Text>
			</VStack>
		</VStack>
	</ScrollableArea>
</Card>
