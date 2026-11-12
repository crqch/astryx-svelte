<!--
	Ported from upstream's `templates/blocks/components/Hooks/useHotkeysHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	The search field's `useRef` is an attachment, since `bind:this` on TextInput
	would yield the component instance rather than its input element.
-->
<script lang="ts">
	import {
		Button,
		Card,
		Dialog,
		DialogHeader,
		HStack,
		Kbd,
		Layout,
		LayoutContent,
		StackItem,
		Switch,
		Text,
		TextInput,
		useHotkeys,
		VStack
	} from '@astryx-sv/core';

	let searchEl: HTMLElement | null = null;
	let query = $state('');
	let isHelpOpen = $state(false);
	// Single-character shortcuts need an off switch (WCAG 2.1.4).
	let hasShortcuts = $state(true);

	useHotkeys(() => [
		{
			keys: '/',
			onPress: () => searchEl?.focus(),
			isDisabled: !hasShortcuts
		},
		{
			keys: '?',
			onPress: () => (isHelpOpen = true),
			isDisabled: !hasShortcuts
		}
	]);
</script>

<Card width={480} padding={4}>
	<VStack gap={3}>
		<HStack gap={2} vAlign="center">
			<StackItem size="fill">
				<TextInput
					{@attach (el) => {
						searchEl = el;
						return () => (searchEl = null);
					}}
					label="Search"
					isLabelHidden
					placeholder="Search projects"
					value={query}
					onChange={(next) => (query = next)}
				/>
			</StackItem>
			<Button label="Shortcuts" onclick={() => (isHelpOpen = true)} />
		</HStack>
		<Switch
			label="Single-key shortcuts"
			value={hasShortcuts}
			onChange={(next) => (hasShortcuts = next)}
		/>
	</VStack>
	<Dialog isOpen={isHelpOpen} onOpenChange={(next) => (isHelpOpen = next)}>
		<Layout>
			{#snippet header()}
				<DialogHeader title="Keyboard shortcuts" onOpenChange={(next) => (isHelpOpen = next)} />
			{/snippet}
			{#snippet content()}
				<LayoutContent>
					<VStack gap={2}>
						<HStack gap={2} vAlign="center">
							<Kbd keys="/" />
							<Text type="body">Focus search</Text>
						</HStack>
						<HStack gap={2} vAlign="center">
							<Kbd keys="?" />
							<Text type="body">Show this help</Text>
						</HStack>
					</VStack>
				</LayoutContent>
			{/snippet}
		</Layout>
	</Dialog>
</Card>
