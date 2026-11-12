<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setButtonGroupContext } from '../../internal/contexts.svelte.js';
	import {
		setPressGroupBandContext,
		setPressGroupContext
	} from '../../hooks/press-group-context.svelte.js';
	import { TextClampContext } from '../text/text-clamp-context.svelte.js';

	/**
	 * The private layer content boundary, ported from upstream's
	 * `Layer/layerScopedContext.tsx`.
	 *
	 * A layer promoted to the top layer still sits in its DOM ancestors, so a
	 * surface-scoped context that an ancestor set would otherwise reach unrelated
	 * content opened from inside it. Re-publishing the neutral value stops the
	 * ancestor's membership here; ordinary application contexts keep flowing, and
	 * a nested provider inside the layer still wins for its own descendants.
	 */
	let { children }: { children?: Snippet } = $props();

	setButtonGroupContext(() => ({ orientation: 'horizontal', isDisabled: false }));
	setPressGroupContext(() => null);
	setPressGroupBandContext(() => false);
	TextClampContext.set(() => false);
</script>

{@render children?.()}
