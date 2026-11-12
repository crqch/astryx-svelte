<!--
	Ported from upstream's `templates/blocks/components/ScrollableArea/ScrollableAreaStickyGroupHeaders.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
	The sticky label's StyleX declarations are inline here; see the overscroll
	example's note.
-->
<script lang="ts">
	import { Card, Grid, Heading, ScrollableArea, Text, VStack } from '@astryx-sv/core';

	const SECTIONS = [
		{
			label: 'Recently opened',
			files: [
				{ id: 'brief', title: 'Q3 launch brief', meta: 'Edited 2 days ago' },
				{ id: 'pricing', title: 'Pricing rework', meta: 'Edited 3 days ago' },
				{ id: 'onboarding', title: 'Onboarding flow v4', meta: 'Edited 4 days ago' },
				{ id: 'macros', title: 'Support macros', meta: 'Edited last week' }
			]
		},
		{
			label: 'Shared with you',
			files: [
				{ id: 'brand', title: 'Brand refresh', meta: 'Priya Raman' },
				{ id: 'checkout', title: 'Checkout audit', meta: 'Tomas Lindqvist' },
				{ id: 'partner', title: 'Partner deck', meta: 'Ines Okafor' },
				{ id: 'research', title: 'Research synthesis', meta: 'Mei Watanabe' }
			]
		},
		{
			label: 'Archived',
			files: [
				{ id: 'roadmap', title: '2025 roadmap', meta: 'Archived in March' },
				{ id: 'legacy', title: 'Legacy pricing', meta: 'Archived in March' },
				{ id: 'kit', title: 'Old brand kit', meta: 'Archived in January' },
				{ id: 'beta', title: 'Beta feedback', meta: 'Archived in January' }
			]
		}
	];

	const stickyLabel =
		'position: sticky; inset-block-start: 0; z-index: 1; background-color: var(--color-background-card); padding-block: var(--spacing-2)';
</script>

<Card width={380} padding={0}>
	<ScrollableArea axis="block" role="region" label="Workspace files" height={300} padding={4}>
		<VStack gap={0.5} paddingBlockEnd={2}>
			<Heading level={3}>Workspace files</Heading>
			<Text type="supporting">12 files across 3 sections</Text>
		</VStack>
		{#each SECTIONS as section (section.label)}
			<section>
				<div style={stickyLabel}>
					<Text type="label" color="secondary">{section.label}</Text>
				</div>
				<Grid columns={2} gap={2}>
					{#each section.files as file (file.id)}
						<Card variant="muted" padding={3}>
							<VStack gap={1}>
								<Text weight="medium" maxLines={1}>{file.title}</Text>
								<Text type="supporting" maxLines={1}>{file.meta}</Text>
							</VStack>
						</Card>
					{/each}
				</Grid>
			</section>
		{/each}
	</ScrollableArea>
</Card>
