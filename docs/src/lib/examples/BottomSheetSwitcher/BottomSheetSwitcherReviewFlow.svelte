<!--
	Ported from upstream's `templates/blocks/components/BottomSheet/BottomSheetSwitcherReviewFlow.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	One state value names the open step; Continue and Back close one sheet and
	open the other in the same update, which replaces it in place. A step that
	closes because the person moved on must not undo the move.
-->
<script lang="ts">
	import { BottomSheet, Button, HStack, Heading, Section, Text, VStack } from '@astryx-svelte/core';

	type Step = 'review' | 'confirm' | null;

	let step = $state<Step>(null);

	function close(own: Step) {
		return (isOpen: boolean) => {
			if (!isOpen) {
				step = step === own ? null : step;
			}
		};
	}
</script>

<Button label="Review settings" onclick={() => (step = 'review')} />

<BottomSheet
	isOpen={step === 'review'}
	onOpenChange={close('review')}
	label="Review notification settings"
	height="hug"
	purpose="form"
>
	<Section padding={4}>
		<VStack gap={4}>
			<VStack gap={1}>
				<Heading level={3}>Review settings</Heading>
				<Text type="supporting" color="secondary">Daily summaries will be sent by email.</Text>
			</VStack>
			<HStack gap={2} hAlign="end">
				<Button label="Cancel" variant="secondary" onclick={() => (step = null)} />
				<Button label="Continue" onclick={() => (step = 'confirm')} />
			</HStack>
		</VStack>
	</Section>
</BottomSheet>

<BottomSheet
	isOpen={step === 'confirm'}
	onOpenChange={close('confirm')}
	label="Confirm settings"
	height="hug"
>
	<Section padding={4}>
		<VStack gap={4}>
			<VStack gap={1}>
				<Heading level={3}>Confirm settings</Heading>
				<Text type="supporting" color="secondary">
					Your notification settings are ready to save.
				</Text>
			</VStack>
			<HStack gap={2} hAlign="end">
				<Button label="Back" variant="secondary" onclick={() => (step = 'review')} />
				<Button label="Save" onclick={() => (step = null)} />
			</HStack>
		</VStack>
	</Section>
</BottomSheet>
