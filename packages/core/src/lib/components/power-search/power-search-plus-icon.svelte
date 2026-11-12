<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	/**
	 * Ported from `PlusIcon` in Astryx's `PowerSearchBottomSheet.tsx`.
	 *
	 * Core's default icon set has no plus. The sheet uses it as the trailing
	 * glyph on a one-tap field row and as the Add filter actions' icon. Upstream
	 * forwards `SVGProps` and spreads them after its own attributes; Svelte's
	 * `...rest` keeps the same order.
	 */
	let { ...rest }: SVGAttributes<SVGSVGElement> = $props();
</script>

<svg
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={1.5}
	stroke-linecap="round"
	stroke-linejoin="round"
	{...rest}
>
	<path d="M5 12h14" />
	<path d="M12 5v14" />
</svg>
