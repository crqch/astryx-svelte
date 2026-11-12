<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { SizeValue, SpacingStep } from '../../internal/types.js';
	import type { SectionDivider, SectionVariant } from './section.stylex.js';

	export interface SectionProps extends BaseProps<HTMLElement> {
		/**
		 * - `section`: surface background
		 * - `transparent`: no background
		 * - `muted`: a de-emphasised surface
		 * @default 'section'
		 */
		variant?: SectionVariant;
		/** Numbers are pixels; strings are used as-is. */
		width?: SizeValue;
		height?: SizeValue;
		maxWidth?: SizeValue;
		minHeight?: SizeValue;
		/** Which sides get a divider border. `start`/`end` respect RTL. */
		dividers?: SectionDivider[];
		/**
		 * Inner padding, on the spacing scale. Left unset, the section takes the
		 * theme's `--astryx-section-padding`.
		 * @default 4 (16px)
		 */
		padding?: SpacingStep;
		/**
		 * Inline (horizontal) padding override. When set, overrides only the inline
		 * axis padding while preserving block padding from `padding` or the
		 * container theme default.
		 */
		paddingInline?: SpacingStep;
		/**
		 * Inline-start padding override. Logical: the left edge in LTR, the right
		 * edge in RTL. Takes precedence over `paddingInline` and `padding` on that
		 * edge only; every other edge is left alone.
		 */
		paddingInlineStart?: SpacingStep;
		/**
		 * Inline-end padding override. Logical: the right edge in LTR, the left
		 * edge in RTL. Takes precedence over `paddingInline` and `padding` on that
		 * edge only; every other edge is left alone.
		 */
		paddingInlineEnd?: SpacingStep;
		/**
		 * Block (vertical) padding override. Overrides only the block axis, leaving
		 * inline padding from `padding` or the theme default in place.
		 */
		paddingBlock?: SpacingStep;
		/**
		 * Block-start (top) padding override. Takes precedence over `paddingBlock`
		 * and `padding` on that edge only; the block-end edge and both inline edges
		 * are left alone.
		 */
		paddingBlockStart?: SpacingStep;
		/**
		 * Block-end (bottom) padding override. Takes precedence over `paddingBlock`
		 * and `padding` on that edge only; the block-start edge and both inline
		 * edges are left alone.
		 */
		paddingBlockEnd?: SpacingStep;
		children?: Snippet;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { sectionInnerAttrs, sectionOuterAttrs } from './section.stylex.js';

	/**
	 * A section container with background variants, rendered as two nested divs:
	 * an outer wrapper that escapes the parent's container padding and an inner
	 * region that carries the background, dividers and padding cascade.
	 *
	 * Upstream spreads rest props, `class` and `style` onto the *outer* wrapper —
	 * not the styled region — so an `id`/`role`/`aria-*` lands on the transparent
	 * wrapper. That is upstream's structure and is preserved verbatim.
	 */
	const {
		variant = 'section',
		width,
		height,
		maxWidth,
		minHeight,
		dividers,
		padding,
		paddingInline,
		paddingInlineStart,
		paddingInlineEnd,
		paddingBlock,
		paddingBlockStart,
		paddingBlockEnd,
		children,
		class: className,
		style: styleProp,
		xstyle,
		...rest
	}: SectionProps = $props();

	const outer = $derived(sectionOuterAttrs({ width, height, maxWidth, minHeight }, xstyle));
	const inner = $derived(
		sectionInnerAttrs({
			variant,
			padding,
			paddingInline,
			paddingInlineStart,
			paddingInlineEnd,
			paddingBlock,
			paddingBlockStart,
			paddingBlockEnd,
			dividers
		})
	);
	const theme = $derived(themeProps('section', { variant }));
</script>

<div
	{...rest}
	class={cx(outer.class, className)}
	style={mergeStyle(outer.style, styleProp as string | undefined)}
>
	<div {...theme} class={cx(theme.class, inner.class)} style={inner.style}>
		{@render children?.()}
	</div>
</div>
