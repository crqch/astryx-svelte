<!--
	Ported from upstream's `templates/blocks/components/InfoTip/InfoTipPermissionNotes.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { HStack, InfoTip, Text, VStack } from '@astryx-sv/core';

	const fields = [
		{
			name: 'Owner',
			value: 'Design Systems',
			note: 'Only admins can change the owner.'
		},
		{
			name: 'Visibility',
			value: 'Everyone in the workspace',
			note: 'Editors can change this field; viewers cannot.'
		}
	];
</script>

<VStack gap={4}>
	{#each fields as field (field.name)}
		<VStack gap={1}>
			<HStack gap={1} align="center">
				<Text type="label">{field.name}</Text>
				<InfoTip content={field.note} label={`Who can change ${field.name.toLowerCase()}`} />
			</HStack>
			<Text type="body" color="secondary">{field.value}</Text>
		</VStack>
	{/each}
</VStack>
