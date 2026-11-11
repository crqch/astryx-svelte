<!--
	Ported from upstream's `templates/blocks/components/ScrollableArea/ScrollableAreaStickyPassthrough.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
	The sticky label's StyleX declarations are inline here; see the other
	ScrollableArea examples' note.
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

	const TEMPLATES = [
		{ id: 'weekly', title: 'Weekly report', meta: 'Used 24 times' },
		{ id: 'checklist', title: 'Launch checklist', meta: 'Used 18 times' },
		{ id: 'review', title: 'Design review', meta: 'Used 11 times' },
		{ id: 'retro', title: 'Retro board', meta: 'Used 9 times' },
		{ id: 'brief', title: 'Project brief', meta: 'Used 7 times' },
		{ id: 'postmortem', title: 'Postmortem', meta: 'Used 4 times' }
	];

	const ARCHIVED = [
		{ id: 'roadmap', title: '2025 roadmap', meta: 'Archived in March' },
		{ id: 'legacy', title: 'Legacy pricing', meta: 'Archived in March' },
		{ id: 'kit', title: 'Old brand kit', meta: 'Archived in January' },
		{ id: 'beta', title: 'Beta feedback', meta: 'Archived in January' },
		{ id: 'survey', title: 'Q4 survey results', meta: 'Archived in January' },
		{ id: 'offsite', title: 'Offsite agenda', meta: 'Archived last year' }
	];

	const stickyLabel =
		'position: sticky; inset-block-start: 0; z-index: 1; background-color: var(--color-background-card); padding-block: var(--spacing-2)';
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
		<VStack gap={0.5} paddingBlockEnd={2}>
			<Heading level={3}>Workspace files</Heading>
			<Text type="supporting">18 files across 3 sections</Text>
		</VStack>

		<ScrollableArea axis="block" label="Shared with you">
			<div style={stickyLabel}>
				<Text type="label" color="secondary">Shared with you</Text>
			</div>
			{@render fileGrid(SHARED)}
		</ScrollableArea>

		<ScrollableArea axis="block" label="Templates" stickyContainment="always">
			<div style={stickyLabel}>
				<Text type="label" color="secondary">Templates</Text>
			</div>
			{@render fileGrid(TEMPLATES)}
		</ScrollableArea>

		<div style={stickyLabel}>
			<Text type="label" color="secondary">Archived</Text>
		</div>
		{@render fileGrid(ARCHIVED)}
	</ScrollableArea>
</Card>
