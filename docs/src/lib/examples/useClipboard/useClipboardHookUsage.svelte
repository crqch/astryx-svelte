<!--
	Ported from upstream's `templates/blocks/components/Hooks/useClipboardHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		Button,
		Card,
		HStack,
		StackItem,
		Text,
		TextInput,
		useClipboard,
		VStack
	} from '@astryx-svelte/core';

	const INVITE_LINK = 'https://example.com/invite/q7x2k9';

	const clipboard = useClipboard(() => ({ announce: 'Link copied' }));
</script>

<Card width={420} padding={4}>
	<VStack gap={3}>
		<Text type="body" weight="bold">Share</Text>
		<HStack gap={2} vAlign="end">
			<StackItem size="fill">
				<TextInput label="Invite link" value={INVITE_LINK} isReadOnly />
			</StackItem>
			<Button
				label={clipboard.isCopied ? 'Copied' : 'Copy'}
				onclick={() => void clipboard.copy(INVITE_LINK)}
			/>
		</HStack>
	</VStack>
</Card>
