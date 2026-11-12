<!--
	Helper for `useIconHookUsage.svelte`, transcribed from the `StatusRow`
	component in upstream's block. A separate file because `useIcon` reads
	context during component initialisation, so it must be its own component
	under the `<Theme>` whose icons it resolves.
-->
<script lang="ts">
	import { HStack, Text, useIcon } from '@astryx-svelte/core';

	const success = useIcon(() => 'success');
	const warning = useIcon(() => 'warning');
	const error = useIcon(() => 'error');
</script>

<HStack gap={4}>
	<HStack gap={1} vAlign="center">
		{@render success.current?.()}
		<Text type="body">Passed</Text>
	</HStack>
	<HStack gap={1} vAlign="center">
		{@render warning.current?.()}
		<Text type="body">Flaky</Text>
	</HStack>
	<HStack gap={1} vAlign="center">
		{@render error.current?.()}
		<Text type="body">Failed</Text>
	</HStack>
</HStack>
