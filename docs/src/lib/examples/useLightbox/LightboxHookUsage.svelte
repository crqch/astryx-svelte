<!--
	Ported from upstream's `templates/blocks/components/Lightbox/LightboxHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`useLightbox` takes its options as a getter, and upstream's `lightbox.element`
	is `<LightboxLayer>` here — a Svelte hook cannot return markup. The asset
	paths are upstream's `/template-assets/*`, served from the lookaside CDN as
	in every other ported block.
-->
<script lang="ts">
	import { Grid, LightboxLayer, useLightbox } from '@astryx-svelte/core';

	const PHOTOS = [
		{
			src: 'https://lookaside.facebook.com/assets/astryx/Neutral-Backpack.png',
			alt: 'Backpack',
			caption: 'Backpack on a neutral background'
		},
		{
			src: 'https://lookaside.facebook.com/assets/astryx/Neutral-Blanket.png',
			alt: 'Blanket',
			caption: 'Cozy blanket on a neutral background'
		},
		{
			src: 'https://lookaside.facebook.com/assets/astryx/Neutral-Headphones.png',
			alt: 'Headphones',
			caption: 'Wireless headphones on a neutral background'
		},
		{
			src: 'https://lookaside.facebook.com/assets/astryx/Neutral-Tumbler.png',
			alt: 'Tumbler',
			caption: 'Stainless tumbler on a neutral background'
		},
		{
			src: 'https://lookaside.facebook.com/assets/astryx/Neutral-Wallet.png',
			alt: 'Wallet',
			caption: 'Leather wallet on a neutral background'
		},
		{
			src: 'https://lookaside.facebook.com/assets/astryx/Neutral-Watch.png',
			alt: 'Watch',
			caption: 'Wristwatch on a neutral background'
		}
	];

	const lightbox = useLightbox(() => ({ media: PHOTOS }));
</script>

<Grid columns={3} gap={2} width={304}>
	{#each PHOTOS as photo, i (photo.alt)}
		<img
			src={photo.src}
			alt={photo.alt}
			width={96}
			height={96}
			style="object-fit: cover"
			{...lightbox.getTriggerProps(i)}
		/>
	{/each}
</Grid>
<LightboxLayer {lightbox} />
