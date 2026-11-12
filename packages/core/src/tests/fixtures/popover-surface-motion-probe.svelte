<script lang="ts">
	import { usePopoverSurfaceMotion } from '$lib/components/popover/use-popover-surface-motion.svelte.js';

	/**
	 * The probe for `use-popover-surface-motion.svelte.test.ts`: runs the hook
	 * and exposes its two calls as instance members, the port's substitute for
	 * `renderHook().result.current`.
	 */
	const surfaceMotion = usePopoverSurfaceMotion();

	export function present(
		layer: HTMLElement | null,
		source: HTMLElement | null,
		entrance: HTMLElement | null = null
	): void {
		surfaceMotion.present(layer, source, entrance);
	}

	export function closeStart(): void {
		surfaceMotion.closeStart();
	}
</script>

<div data-testid="probe"></div>
