<!--
	Ported from upstream's `templates/blocks/components/Overlay/useOverlayHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Three translations, all this port's standing shapes: the hook takes its
	options as a getter, upstream's `containerRef` is `attachContainer`, and both
	`element` and `renderOverlay` are `<OverlayScrim {...overlay.scrimProps}>` —
	a Svelte hook cannot return markup, and `content` exists upstream only to
	pre-render `element`, so it has no counterpart here.
-->
<script lang="ts">
	import {
		AspectRatio,
		Button,
		Card,
		OverlayScrim,
		Text,
		VStack,
		useOverlay
	} from '@astryx-sv/core';

	const overlay = useOverlay(() => ({
		showOn: 'hover',
		position: 'bottom',
		align: 'center'
	}));
</script>

<Card width={280} padding={0} {@attach overlay.attachContainer} {...overlay.containerProps}>
	<div style="position: relative">
		<a href="#ceramic-mug">
			<AspectRatio ratio={1}>
				<img
					src="https://lookaside.facebook.com/assets/astryx/light-product-1.png"
					alt="Ceramic mug"
					style="width: 100%; height: 100%; object-fit: cover"
				/>
			</AspectRatio>
		</a>
		<OverlayScrim {...overlay.scrimProps}>
			<Button label="Quick view" variant="secondary" size="sm" />
		</OverlayScrim>
	</div>
	<VStack gap={1} padding={3}>
		<Text type="body" weight="bold">Ceramic mug</Text>
		<Text type="supporting" color="secondary">$24</Text>
	</VStack>
</Card>
