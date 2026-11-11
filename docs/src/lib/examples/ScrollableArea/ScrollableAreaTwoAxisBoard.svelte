<!--
	Ported from upstream's `templates/blocks/components/ScrollableArea/ScrollableAreaTwoAxisBoard.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Card, Heading, HStack, ScrollableArea, Text, VStack } from '@astryx-svelte/core';

	const COLUMNS = [
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
			label: 'Templates',
			files: [
				{ id: 'weekly', title: 'Weekly report', meta: 'Used 24 times' },
				{ id: 'checklist', title: 'Launch checklist', meta: 'Used 18 times' },
				{ id: 'review', title: 'Design review', meta: 'Used 11 times' },
				{ id: 'retro', title: 'Retro board', meta: 'Used 9 times' }
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
</script>

<Card width={420} padding={0}>
	<ScrollableArea axis="both" role="region" label="Workspace board" height={300} padding={4}>
		<VStack gap={4}>
			<VStack gap={0.5}>
				<Heading level={3}>Workspace board</Heading>
				<Text type="supporting">16 files across 4 sections</Text>
			</VStack>
			<HStack gap={3} vAlign="start">
				{#each COLUMNS as column (column.label)}
					<VStack gap={2} width={180}>
						<Text type="label" color="secondary">{column.label}</Text>
						{#each column.files as file (file.id)}
							<Card variant="muted" padding={3}>
								<VStack gap={1}>
									<Text weight="medium" maxLines={1}>{file.title}</Text>
									<Text type="supporting" maxLines={1}>{file.meta}</Text>
								</VStack>
							</Card>
						{/each}
					</VStack>
				{/each}
			</HStack>
		</VStack>
	</ScrollableArea>
</Card>
