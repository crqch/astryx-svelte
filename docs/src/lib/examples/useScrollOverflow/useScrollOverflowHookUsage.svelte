<!--
	Ported from upstream's `templates/blocks/components/Hooks/useScrollOverflowHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`useScrollOverflow` returns state getters plus an attachment, so the result is
	held rather than destructured and `scrollRef` becomes `{@attach …}`. The
	local `stylex.create` fade rules are composed into the strip's `style`
	attribute, since a `.svelte` file may not import StyleX.
-->
<script lang="ts">
	import { Button, HStack, Switch, Token, VStack, useScrollOverflow } from '@astryx-svelte/core';

	const FADE = 'var(--spacing-8)';
	const FADE_FROM_LEFT = `linear-gradient(to right, transparent, black ${FADE})`;
	const FADE_FROM_RIGHT = `linear-gradient(to left, transparent, black ${FADE})`;
	const FADE_BOTH = `linear-gradient(to right, transparent, black ${FADE}, black calc(100% - ${FADE}), transparent)`;

	const FILTERS = [
		'Open now',
		'Free delivery',
		'Vegetarian',
		'Under $15',
		'Top rated',
		'Outdoor seating',
		'Pet friendly'
	];

	let filters = $state(FILTERS.slice(0, 2));
	let isRtl = $state(false);

	const overflow = useScrollOverflow();
	const nextFilter = $derived(FILTERS.find((filter) => !filters.includes(filter)));

	const mask = $derived(
		overflow.overflowStart && overflow.overflowEnd
			? FADE_BOTH
			: overflow.overflowStart
				? isRtl
					? FADE_FROM_RIGHT
					: FADE_FROM_LEFT
				: overflow.overflowEnd
					? isRtl
						? FADE_FROM_LEFT
						: FADE_FROM_RIGHT
					: null
	);

	const stripStyle = $derived(
		`display: flex; gap: var(--spacing-2); overflow-x: auto${mask == null ? '' : `; mask-image: ${mask}`}`
	);
</script>

<VStack gap={3} width={320}>
	<div dir={isRtl ? 'rtl' : 'ltr'}>
		<div {@attach overflow.attach} role="group" aria-label="Active filters" style={stripStyle}>
			{#each filters as filter (filter)}
				<Token
					label={filter}
					style="flex-shrink: 0"
					onRemove={() => (filters = filters.filter((item) => item !== filter))}
				/>
			{/each}
		</div>
	</div>
	<HStack gap={3} vAlign="center">
		<Button
			label="Add filter"
			variant="secondary"
			isDisabled={nextFilter == null}
			onclick={() => {
				if (nextFilter != null) {
					filters = [...filters, nextFilter];
				}
			}}
		/>
		<Switch label="Right to left" value={isRtl} onChange={(next) => (isRtl = next)} />
	</HStack>
</VStack>
