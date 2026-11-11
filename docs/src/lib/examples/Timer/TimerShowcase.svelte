<!--
	Ported from upstream's `templates/blocks/components/Timer/TimerShowcase.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Stack, Text, Timer } from '@astryx-svelte/core';

	const startedAt = Date.now() - 3_753_000;
</script>

<Stack direction="vertical" gap={4}>
	<Text type="large" color="primary" weight="semibold">Processing</Text>
	<Stack direction="horizontal" gap={6} vAlign="center">
		<Stack direction="vertical" gap={1}>
			<Text type="supporting" color="secondary">Elapsed</Text>
			<Timer startTime={startedAt} type="body" size="xl" color="primary" weight="semibold" />
		</Stack>
		<Stack direction="vertical" gap={1}>
			<Text type="supporting" color="secondary">Clock</Text>
			<Timer
				format="clock"
				startTime={startedAt}
				type="body"
				size="xl"
				color="primary"
				weight="semibold"
			/>
		</Stack>
	</Stack>
</Stack>
