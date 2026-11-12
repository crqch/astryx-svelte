<!--
	Ported from upstream's `templates/blocks/components/Hooks/useFocusTrapHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`containerRef` is the hook's `attachContainer` attachment, which is the port's
	replacement for upstream's ref object.
-->
<script lang="ts">
	import { Button, Card, HStack, Text, TextInput, useFocusTrap, VStack } from '@astryx-svelte/core';

	let isOpen = $state(false);
	const INITIAL_TITLE = 'Update onboarding guide';

	let title = $state(INITIAL_TITLE);
	let draft = $state(INITIAL_TITLE);

	const close = () => (isOpen = false);
	const trap = useFocusTrap(() => ({
		isActive: isOpen,
		onEscape: close
	}));

	// Runs after commit, once the panel is mounted and useFocusTrap has recorded
	// the opener, so closing the panel returns focus to it.
	$effect(() => {
		if (isOpen) {
			trap.focusFirst();
		}
	});
</script>

<HStack gap={4} vAlign="start">
	<VStack gap={2}>
		<Text type="body" weight="bold">{title}</Text>
		<Button
			label="Quick edit"
			onclick={() => {
				draft = title;
				isOpen = true;
			}}
		/>
	</VStack>
	{#if isOpen}
		<Card
			{@attach trap.attachContainer}
			role="dialog"
			aria-label="Quick edit"
			width={280}
			padding={4}
		>
			<VStack gap={3}>
				<TextInput label="Title" value={draft} onChange={(next) => (draft = next)} />
				<HStack gap={2} hAlign="end">
					<Button label="Cancel" variant="secondary" onclick={close} />
					<Button
						label="Save"
						variant="primary"
						onclick={() => {
							title = draft;
							close();
						}}
					/>
				</HStack>
			</VStack>
		</Card>
	{/if}
</HStack>
