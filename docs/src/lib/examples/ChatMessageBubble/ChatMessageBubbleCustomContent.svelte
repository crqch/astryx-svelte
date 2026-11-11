<!--
	Ported from upstream's `templates/blocks/components/ChatMessageBubble/ChatMessageBubbleCustomContent.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		ChatMessage,
		ChatMessageBubble,
		ChatMessageList,
		ChatMessageMetadata,
		ClickableCard,
		Text,
		Timestamp
	} from '@astryx-svelte/core';
</script>

{#snippet reportTimestamp()}
	<Timestamp value="2026-04-28T09:45:00" format="time" />
{/snippet}

{#snippet reportFooter()}
	<Text type="supporting" color="secondary">Claude Opus 4.6</Text>
{/snippet}

{#snippet reportMetadata()}
	<ChatMessageMetadata timestamp={reportTimestamp} footer={reportFooter} />
{/snippet}

<ChatMessageList style="max-width: 520px">
	<ChatMessage sender="user">
		<ChatMessageBubble>Can you pull up the Q3 report?</ChatMessageBubble>
	</ChatMessage>
	<ChatMessage sender="assistant">
		<ChatMessageBubble name="Navi">Sure, here is the artifact from last quarter.</ChatMessageBubble>
		<!--
			A ghost bubble aligns custom content with the bubble text column;
			width="100%" spans the full message column instead of the default
			bubble width cap. Metadata rides the bubble's metadata slot.
		-->
		<ChatMessageBubble variant="ghost" width="100%" metadata={reportMetadata}>
			<ClickableCard label="Open Q3 performance report" onclick={() => {}}>
				<Text type="body" weight="semibold" display="block">Q3 Performance Report</Text>
				<Text type="supporting" color="secondary" display="block">
					12 pages · updated 2 days ago
				</Text>
			</ClickableCard>
		</ChatMessageBubble>
	</ChatMessage>
</ChatMessageList>
