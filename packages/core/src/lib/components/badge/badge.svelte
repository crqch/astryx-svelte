<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { BadgeVariant } from './badge.stylex.js';

	export interface BadgeProps extends BaseProps<HTMLSpanElement> {
		/** @default 'neutral' */
		variant?: BadgeVariant;
		/** The badge text. A snippet covers the cases a string can't. */
		label: string | Snippet;
		/** Rendered before the label. */
		icon?: Snippet;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { badgeAttrs, badgeLabelAttrs } from './badge.stylex.js';

	/**
	 * A pill for a status, count or short label.
	 */
	const {
		variant = 'neutral',
		label,
		icon,
		xstyle,
		class: className,
		style: styleProp,
		...rest
	}: BadgeProps = $props();

	// Upstream's `isRenderable(label)`: an empty string renders nothing, so the
	// pill does not grow for a label with no text. A snippet is always a
	// subtree, which upstream counts as renderable.
	const hasLabel = $derived(typeof label === 'function' || label !== '');
	// Clipping a label makes its tail unrecoverable, so the full text has to
	// stay reachable somewhere. String content only — a snippet is a subtree
	// whose text would have to be flattened to a string, and that renders a
	// guess.
	const labelTitle = $derived(typeof label === 'string' && label.length > 0 ? label : undefined);

	const attrs = $derived(badgeAttrs(variant, hasLabel, xstyle));
	const labelAttrs = badgeLabelAttrs();
	const theme = $derived(themeProps('badge', { variant }));
</script>

<span
	title={labelTitle}
	{...rest}
	{...theme}
	class={cx(theme.class, attrs.class, className)}
	style={mergeStyle(attrs.style, styleProp as string | undefined)}
>
	{@render icon?.()}
	<span class={labelAttrs.class} style={labelAttrs.style}>
		{#if typeof label === 'function'}{@render label()}{:else}{label}{/if}
	</span>
</span>
