<script lang="ts">
	import { usePresentationHold } from '$lib/components/layer/presentation-hold.svelte.js';

	/**
	 * Upstream's `renderHook((props) => usePresentationHold(props))`, rendered so
	 * a Svelte test can read the returned getters out of the DOM.
	 */
	interface Props {
		isOpen?: boolean;
		presentation?: string;
	}

	let { isOpen = false, presentation = 'sheet' }: Props = $props();

	const hold = usePresentationHold(() => ({ isOpen, presentation }));

	/** Exposed for the release-identity case; React's `result.current.release`. */
	export function getRelease(): () => void {
		return hold.release;
	}
</script>

<span data-testid="presentation">{hold.presentation ?? 'null'}</span>
<span data-testid="is-held">{String(hold.isHeld)}</span>
<button data-testid="release" type="button" onclick={() => hold.release()}>Release</button>
