<!--
	Ported from upstream's `templates/blocks/components/AvatarGroup/AvatarGroupInteractive.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Avatar, AvatarGroup, AvatarGroupOverflow, Stack, Text } from '@astryx-sv/core';

	const MEMBERS = [
		{ name: 'Alex Daniels', key: 'alex', href: '/team/alex' },
		{ name: 'Ann Smith', key: 'ann', href: '/team/ann' },
		{ name: 'Carol Davis', key: 'carol', href: '/team/carol' }
	];

	const TOTAL_MEMBERS = 18;
</script>

<Stack direction="vertical" gap={8}>
	<Stack direction="vertical" gap={3}>
		<Text type="supporting" color="secondary">Reviewers</Text>
		<AvatarGroup size="lg" aria-label="Reviewers">
			{#each MEMBERS as member (member.key)}
				<Avatar name={member.name} href={member.href} />
			{/each}
			<AvatarGroupOverflow count={TOTAL_MEMBERS - MEMBERS.length} onclick={() => {}} />
		</AvatarGroup>
	</Stack>
	<Stack direction="vertical" gap={3}>
		<Text type="supporting" color="secondary">Compact, static</Text>
		<AvatarGroup size="sm" aria-label="Attendees">
			{#each MEMBERS as member (member.key)}
				<Avatar name={member.name} />
			{/each}
			<AvatarGroupOverflow count={TOTAL_MEMBERS - MEMBERS.length} />
		</AvatarGroup>
	</Stack>
</Stack>
