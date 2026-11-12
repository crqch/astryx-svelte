<!--
	Ported from upstream's `templates/blocks/components/Hooks/useImageModeHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	The two photos are upstream's `/template-assets/…` files, served from their
	v0.7.13 source. The hook samples them with a CORS fetch, which the CDN the
	other ported examples use does not allow — GitHub's raw host serves the same
	files with `Access-Control-Allow-Origin: *`.
-->
<script lang="ts">
	import { AspectRatio, MediaTheme, Switch, Text, useImageMode, VStack } from '@astryx-svelte/core';

	const TEMPLATE_ASSETS =
		'https://raw.githubusercontent.com/meta/astryx/7a298e616fa241b9858670757c8b3fa99abdf5f7' +
		'/apps/docsite/public/template-assets';

	const NIGHT_PHOTO = `${TEMPLATE_ASSETS}/moody-scene-horizontal-1.png`;
	const BEACH_PHOTO = `${TEMPLATE_ASSETS}/light-scene-horizontal-1.png`;

	const CAPTION_REGION = { x: 0, y: 0, width: 1, height: 0.3 };

	let isBeach = $state(false);
	const src = $derived(isBeach ? BEACH_PHOTO : NIGHT_PHOTO);
	const mode = useImageMode(
		() => src,
		() => ({
			region: CAPTION_REGION,
			threshold: 0.4,
			fallback: 'dark'
		})
	);
</script>

<VStack gap={3}>
	<AspectRatio
		ratio={3 / 2}
		style="width: 360px; max-width: 100%; border-radius: var(--radius-container)"
	>
		<img
			{src}
			alt={isBeach ? 'A beach under a pale sky' : 'Snowy peaks at night'}
			style="width: 100%; height: 100%; object-fit: cover"
		/>
		<div style="position: absolute; inset: 0 0 auto; padding: 16px">
			<MediaTheme mode={mode.mode ?? 'off'}>
				<VStack gap={1}>
					<Text type="body" weight="bold">
						{isBeach ? 'Afternoon at the beach' : 'Night in the mountains'}
					</Text>
					<Text type="supporting">Sky behind the caption: {mode.mode}</Text>
				</VStack>
			</MediaTheme>
		</div>
	</AspectRatio>
	<Switch label="Beach photo" value={isBeach} onChange={(next) => (isBeach = next)} />
</VStack>
