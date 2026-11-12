<!--
	Ported from upstream's `templates/blocks/components/Hooks/useScrollableAreaHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`useScrollableArea` takes its options through a getter and returns prop bags
	whose `state` is a getter, so the result is held rather than destructured.
	The viewport's local `stylex.create` rules (height and edge shadows) become
	the `style` passed to `getViewportProps`, since a `.svelte` file may not
	import StyleX.
-->
<script lang="ts">
	import {
		Button,
		Card,
		HStack,
		Heading,
		Text,
		VStack,
		useScrollableArea
	} from '@astryx-svelte/core';

	const TOP_SHADOW = 'inset 0 12px 8px -8px var(--color-shadow)';
	const BOTTOM_SHADOW = 'inset 0 -12px 8px -8px var(--color-shadow)';

	const ACTIVITY = [
		'Maya created the Checkout project',
		'Sam invited Lee',
		'Build 318 passed',
		'Lee opened "Card total rounds down"',
		'Maya deployed 1.4.2 to staging',
		'Build 319 failed',
		'Sam fixed the rounding test',
		'Build 320 passed',
		'Maya deployed 1.4.3 to production',
		'Lee closed "Card total rounds down"'
	];

	let count = $state(3);

	const scrollArea = useScrollableArea(() => ({
		axis: 'block',
		keyboardAccess: { owner: 'viewport', label: 'Activity log' },
		overscroll: 'contain'
	}));

	const blockState = $derived(scrollArea.state.block);
	const hiddenAbove = $derived(blockState.isScrollable && !blockState.atStart);
	const hiddenBelow = $derived(blockState.isScrollable && !blockState.atEnd);

	const viewportStyle = $derived(
		`height: 160px; box-shadow: ${
			hiddenAbove && hiddenBelow
				? `${TOP_SHADOW}, ${BOTTOM_SHADOW}`
				: hiddenAbove
					? TOP_SHADOW
					: hiddenBelow
						? BOTTOM_SHADOW
						: 'none'
		}`
	);
</script>

<Card width={320} padding={4}>
	<VStack gap={3}>
		<HStack justify="between" vAlign="center">
			<Heading level={4}>Activity log</Heading>
			<Button
				label="Add entry"
				variant="secondary"
				isDisabled={count === ACTIVITY.length}
				onclick={() => (count += 1)}
			/>
		</HStack>
		<div {...scrollArea.getViewportProps({ style: viewportStyle })}>
			<VStack {...scrollArea.getContentProps()} gap={2}>
				{#each ACTIVITY.slice(0, count) as entry (entry)}
					<Text type="body">{entry}</Text>
				{/each}
			</VStack>
		</div>
	</VStack>
</Card>
