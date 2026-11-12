<script lang="ts" module>
	export interface ExpansionChevronProps {
		/** Is the row this chevron belongs to currently expanded? */
		isExpanded: boolean;
		/** Toggles this row. */
		onToggle: () => void;
		/** Accessible name, resolved by the hook so every `t()` call site stays there. */
		ariaLabel: string;
	}
</script>

<script lang="ts">
	import Icon from '../../../icon/icon.svelte';
	import { useTableContext } from '../../table-context.svelte.js';
	import {
		expansionChevronButtonAttrs,
		expansionGlyphBoxAttrs,
		expansionGlyphCenterAttrs
	} from './row-expansion.stylex.js';

	/**
	 * Ported from Astryx's `ExpansionChevron`, the module-private component
	 * `useTableRowExpansion.tsx` renders in the synthetic expansion column.
	 *
	 * Module-private upstream, so the props type is exported for `$props()`
	 * typing but is deliberately not on the barrel.
	 *
	 * The rotation rides the fixed glyph box rather than the button: the button
	 * is the hit target and carries the hover chip, and turning that swings the
	 * rounded rectangle and its highlight around with the arrow.
	 */
	let { isExpanded, onToggle, ariaLabel }: ExpansionChevronProps = $props();

	const tableContext = useTableContext();
	const density = $derived(tableContext?.().density ?? 'balanced');

	const buttonAttrs = $derived(expansionChevronButtonAttrs(isExpanded, density));
	const glyphBoxAttrs = $derived(expansionGlyphBoxAttrs(isExpanded));
	const glyphCenterAttrs = expansionGlyphCenterAttrs();
</script>

<button
	type="button"
	data-expansion-toggle=""
	class={buttonAttrs.class}
	style={buttonAttrs.style}
	onclick={(e) => {
		e.stopPropagation();
		onToggle();
	}}
	aria-label={ariaLabel}
	aria-expanded={isExpanded}
>
	<span class={glyphBoxAttrs.class} style={glyphBoxAttrs.style}>
		<span class={glyphCenterAttrs.class} style={glyphCenterAttrs.style}>
			<Icon icon="chevronRight" size="xsm" />
		</span>
	</span>
</button>
