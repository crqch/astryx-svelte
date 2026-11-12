<!--
	Ported from upstream's `templates/blocks/components/Hooks/useClickableContainerHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	The two `useRef`s become attachments: a Svelte component's `bind:this` yields
	the instance, not the element, so the elements reach the hook through the
	spread attachment instead.
-->
<script lang="ts">
	import {
		Button,
		Card,
		Heading,
		HStack,
		Link,
		Text,
		useClickableContainer,
		VStack
	} from '@astryx-svelte/core';

	const PROJECT_HREF = '#project-design-tokens';

	let container = $state<HTMLElement | null>(null);
	let projectLink = $state<HTMLElement | null>(null);
	let openCount = $state(0);
	let isStarred = $state(false);

	const clickable = useClickableContainer(() => ({
		container,
		interactive: projectLink,
		href: PROJECT_HREF
	}));
</script>

<VStack gap={3}>
	<Card
		{@attach (el) => {
			container = el;
			return () => (container = null);
		}}
		onclick={clickable.onclick}
		onmouseup={clickable.onmouseup}
		width={360}
		padding={4}
	>
		<VStack gap={2}>
			<HStack gap={2} justify="between" vAlign="center">
				<Heading level={4}>
					<Link
						{@attach (el) => {
							projectLink = el;
							return () => (projectLink = null);
						}}
						href={PROJECT_HREF}
						type="inherit"
						onclick={() => (openCount += 1)}
					>
						Design tokens
					</Link>
				</Heading>
				<Button
					label={isStarred ? 'Starred' : 'Star'}
					variant="secondary"
					onclick={() => (isStarred = !isStarred)}
				/>
			</HStack>
			<Text type="body" color="secondary">
				Color, spacing and type tokens shared by every product surface.
			</Text>
			<Text type="supporting" color="secondary">
				Owned by{' '}
				<Link href="#team-design-systems" type="inherit">Design Systems</Link>
			</Text>
		</VStack>
	</Card>
	<Text type="supporting">
		Project opened {openCount}
		{openCount === 1 ? 'time' : 'times'}
	</Text>
</VStack>
