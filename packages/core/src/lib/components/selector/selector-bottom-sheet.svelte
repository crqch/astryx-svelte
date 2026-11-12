<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export interface SelectorBottomSheetProps {
		children: Snippet;
		/** The element that receives focus after the sheet's exit completes. */
		finalFocusRef: () => HTMLElement | null;
		/** The element focused when the sheet opens (the search field or listbox). */
		initialFocusRef: () => HTMLElement | null;
		isOpen: boolean;
		label: string;
		onOpenChange: (isOpen: boolean) => void;
	}
</script>

<script lang="ts">
	import BottomSheet from '../bottom-sheet/bottom-sheet.svelte';
	import Heading from '../heading/heading.svelte';
	import Section from '../section/section.svelte';
	import {
		selectorBottomSheetContentAttrs,
		selectorBottomSheetHeadingStyle
	} from './selector-bottom-sheet.stylex.js';

	/**
	 * Ported from Astryx's `Selector/SelectorBottomSheet.tsx`.
	 *
	 * The shared mobile listbox sheet for `Selector` and `MultiSelector`: a
	 * content-hugging modal sheet with the field label as its heading. Focus
	 * enters the search field (when present) or the listbox on open, and returns
	 * to `finalFocusRef` after the sheet's exit completes.
	 *
	 * Upstream lazy-loads `BottomSheet` through `React.lazy` so the surface is
	 * not in the initial bundle until the first sheet opens. Svelte has no
	 * component-level lazy boundary; this is a static import, and `BottomSheet`
	 * is already in the selector's bundle whenever the sheet branch is rendered.
	 */
	const {
		children,
		finalFocusRef,
		initialFocusRef,
		isOpen,
		label,
		onOpenChange
	}: SelectorBottomSheetProps = $props();
	const contentAttrs = selectorBottomSheetContentAttrs();

	/**
	 * Upstream's `SelectorBottomSheetInitialFocus`: one frame after the open
	 * state reaches the sheet, move focus to the search field or the listbox.
	 * The sheet's native dialog focusing steps land on the panel first, so the
	 * deferred move is what puts the keyboard on the list.
	 */
	$effect(() => {
		if (!isOpen) {
			return;
		}
		const frame = requestAnimationFrame(() => {
			initialFocusRef()?.focus({ preventScroll: true });
		});
		return () => cancelAnimationFrame(frame);
	});
</script>

<BottomSheet {isOpen} {onOpenChange} {finalFocusRef} {label} height="hug" purpose="info">
	<Section paddingBlockStart={4} paddingBlockEnd={0} paddingInline={1}>
		<div class={contentAttrs.class} style={contentAttrs.style}>
			<Heading level={3} xstyle={selectorBottomSheetHeadingStyle}>{label}</Heading>
			{@render children()}
		</div>
	</Section>
</BottomSheet>
