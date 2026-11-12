<!--
	Ported from upstream's `templates/blocks/components/Icon/useIconHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	The theme registers Heroicons' solid glyphs, as upstream does. A theme's
	`icons` hold snippets here rather than rendered nodes, and the theme is
	defined at module scope, so each glyph is a `createRawSnippet` carrying
	upstream's exact path data.
-->
<script module lang="ts">
	import { createRawSnippet } from 'svelte';
	import { defineTheme } from '@astryx-sv/core/theme';

	const successIcon = createRawSnippet(() => ({
		render: () => `<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="currentColor"
	width="1em"
	height="1em"
	aria-hidden="true"
>
	<path
		fill-rule="evenodd"
		d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
		clip-rule="evenodd"
	/>
</svg>`
	}));

	const warningIcon = createRawSnippet(() => ({
		render: () => `<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="currentColor"
	width="1em"
	height="1em"
	aria-hidden="true"
>
	<path
		fill-rule="evenodd"
		d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
		clip-rule="evenodd"
	/>
</svg>`
	}));

	const errorIcon = createRawSnippet(() => ({
		render: () => `<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="currentColor"
	width="1em"
	height="1em"
	aria-hidden="true"
>
	<path
		fill-rule="evenodd"
		d="m6.72 5.66 11.62 11.62A8.25 8.25 0 0 0 6.72 5.66Zm10.56 12.68L5.66 6.72a8.25 8.25 0 0 0 11.62 11.62ZM5.105 5.106c3.807-3.808 9.98-3.808 13.788 0 3.808 3.807 3.808 9.98 0 13.788-3.807 3.808-9.98 3.808-13.788 0-3.808-3.807-3.808-9.98 0-13.788Z"
		clip-rule="evenodd"
	/>
</svg>`
	}));

	const statusIconTheme = defineTheme({
		name: 'status-icons-docs',
		icons: {
			success: successIcon,
			warning: warningIcon,
			error: errorIcon
		}
	});
</script>

<script lang="ts">
	import { Text, Theme, useTheme, VStack } from '@astryx-sv/core';
	import StatusRow from './StatusRow.svelte';

	const theme = useTheme();
</script>

<VStack gap={4}>
	<VStack gap={2}>
		<Text type="supporting" color="secondary">Current theme</Text>
		<StatusRow />
	</VStack>
	<Theme theme={statusIconTheme} mode={theme.mode}>
		<VStack gap={2}>
			<Text type="supporting" color="secondary">Theme with its own status icons</Text>
			<StatusRow />
		</VStack>
	</Theme>
</VStack>
