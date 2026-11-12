<!--
	Ported from upstream's `templates/blocks/components/Dialog/DialogAdaptivePresentation.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	The `AdaptiveDialog` wrapper this block demonstrates is its own helper file,
	because it owns a media-query branch; the state stays here as upstream's does.
-->
<script lang="ts">
	import { Button, HStack, Text, TextArea, TextInput, VStack } from '@astryx-sv/core';
	import AdaptiveDialog from './AdaptiveDialog.svelte';

	let isOpen = $state(false);
	let name = $state('Ruby Cheung');
	let email = $state('ruby@example.com');
	let notes = $state('');
</script>

{#snippet footer()}
	<HStack gap={2} hAlign="end" wrap="wrap">
		<Button label="Cancel" variant="secondary" onclick={() => (isOpen = false)} />
		<Button label="Save profile" variant="primary" onclick={() => (isOpen = false)} />
	</HStack>
{/snippet}

<Button label="Edit profile" onclick={() => (isOpen = true)} />

<!--
	touchPresentation examples:
	- "dialog" keeps Dialog even in touch-oriented <=lg contexts.
	- "fullscreen" uses fullscreen Dialog there.
	- "bottom-sheet" uses BottomSheet there.
	presentation="dialog" | "fullscreen" | "bottom-sheet" overrides the media
	query for tests and unusual environments.
-->
<AdaptiveDialog
	{isOpen}
	onOpenChange={(open) => (isOpen = open)}
	title="Edit profile"
	purpose="form"
	touchPresentation="bottom-sheet"
	bottomSheetHeight="tall"
	{footer}
>
	<VStack gap={4}>
		<Text type="supporting" color="secondary">
			Dialog remains the default presentation. This example explicitly opts into a Bottom Sheet only
			at lg and below when the device has a coarse pointer and no hover. Pass the presentation prop
			to make tests or unusual environments deterministic.
		</Text>
		<Text type="supporting" color="secondary">
			In Bottom Sheet presentation, purpose="form" blocks scrim clicks and swipe dismissal while
			preserving Escape. Use this opt-in only when that contract is acceptable; keep
			AlertDialog/destructive confirmations on Dialog unless a product deliberately chooses
			otherwise.
		</Text>
		<TextInput label="Name" value={name} onChange={(next) => (name = next)} />
		<TextInput label="Email" type="email" value={email} onChange={(next) => (email = next)} />
		<TextArea label="Notes" rows={6} value={notes} onChange={(next) => (notes = next)} />
	</VStack>
</AdaptiveDialog>
