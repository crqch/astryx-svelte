<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export interface MenuBottomSheetProps {
		/** The element that receives focus after the sheet's exit completes. */
		finalFocusRef?: () => HTMLElement | null;
		isOpen: boolean;
		onOpenChange: (isOpen: boolean) => void;
		label: string;
		children: Snippet;
	}
</script>

<script lang="ts">
	import BottomSheet from '../bottom-sheet/bottom-sheet.svelte';

	/**
	 * Ported from Astryx's `DropdownMenu/MenuBottomSheet.tsx`.
	 *
	 * The internal action-sheet host shared by the menu family. The sheet
	 * renders nothing at rest: it mounts as it opens, and after it closes it
	 * stays only until its dialog has closed, so the exit plays out and focus
	 * returns to the trigger. The sheet has no content padding: callers inset
	 * their content with `menuBottomSheetStyles.content`, so no wrapper sits
	 * between the sheet and it.
	 *
	 * Upstream's lazy wrapper has no Svelte counterpart; the component is
	 * statically imported, and the closed state renders no dialog.
	 */
	let { finalFocusRef, isOpen, onOpenChange, label, children }: MenuBottomSheetProps = $props();

	// Seeded from the initial prop, as upstream's `useState(isOpen)` is: a sheet
	// mounted already-open is presented from the first frame.
	// svelte-ignore state_referenced_locally
	let isMounted = $state(isOpen);
	let panelEl = $state<HTMLElement | null>(null);

	// `$effect.pre` mounts the sheet before the DOM update that opens it, so an
	// open never paints a frame without the sheet.
	$effect.pre(() => {
		if (isOpen && !isMounted) {
			isMounted = true;
		}
	});

	// The panel's native dialog has closed: the exit is over, so the sheet may
	// leave the tree. A dialog that is already closed means the same thing.
	$effect(() => {
		if (isOpen || !isMounted) {
			return;
		}
		const dialog = panelEl?.closest('dialog');
		if (dialog == null || !dialog.open) {
			isMounted = false;
			return;
		}
		const handleClose = () => {
			isMounted = false;
		};
		dialog.addEventListener('close', handleClose);
		return () => dialog.removeEventListener('close', handleClose);
	});
</script>

{#if isMounted}
	<BottomSheet
		{@attach (element: HTMLElement) => {
			panelEl = element;
		}}
		{finalFocusRef}
		{isOpen}
		{onOpenChange}
		{label}
		height="hug"
		padding={0}
		purpose="info"
	>
		{@render children()}
	</BottomSheet>
{/if}
