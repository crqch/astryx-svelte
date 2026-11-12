<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { SizeValue, SpacingStep } from '../../internal/types.js';
	import type {
		ScrollAxis,
		ScrollKeyboardAccess,
		ScrollOverscroll,
		ScrollStickyContainment
	} from '../../hooks/use-scrollable-area.svelte.js';

	export type ScrollableAreaStickyContainment = ScrollStickyContainment;

	export interface ScrollableAreaProps extends Omit<
		BaseProps<HTMLDivElement>,
		'aria-label' | 'children' | 'role' | 'tabindex'
	> {
		/** Content rendered inside the observed content box. */
		children?: Snippet;
		/** Logical axis or axes where scrolling is allowed. @default 'block' */
		axis?: ScrollAxis;
		/** Accessible name used when an effective viewport enters the tab order. */
		label: string;
		/** Semantics for the named scroll viewport. @default 'group' */
		role?: 'group' | 'region';
		/** Whether effective axes pass scroll gestures to ancestors at an edge. @default 'allow' */
		overscroll?: ScrollOverscroll;
		/** Width of the viewport; numbers are interpreted as pixels. */
		width?: SizeValue;
		/** Height of the viewport; numbers are interpreted as pixels. */
		height?: SizeValue;
		/** Maximum width of the viewport. */
		maxWidth?: SizeValue;
		/** Minimum height of the viewport. */
		minHeight?: SizeValue;
		/** Whether a fitting viewport deliberately remains a Sticky containing boundary. @default 'whenScrollable' */
		stickyContainment?: ScrollableAreaStickyContainment;
		/** Content padding using the shared spacing scale. @default 0 */
		padding?: SpacingStep;
		/** Logical inline-axis content padding; overrides `padding` on that axis. */
		paddingInline?: SpacingStep;
		/** Logical inline-start content padding; overrides broader padding values. */
		paddingInlineStart?: SpacingStep;
		/** Logical inline-end content padding; overrides broader padding values. */
		paddingInlineEnd?: SpacingStep;
		/** Logical block-axis content padding; overrides `padding` on that axis. */
		paddingBlock?: SpacingStep;
		/** Logical block-start content padding; overrides broader padding values. */
		paddingBlockStart?: SpacingStep;
		/** Logical block-end content padding; overrides broader padding values. */
		paddingBlockEnd?: SpacingStep;
		/** Let the viewport escape inherited container padding. @default false */
		isFullBleed?: boolean;
		/** Ref connected to the native scroll viewport. */
		ref?: HTMLDivElement | null;
	}
</script>

<script lang="ts">
	import { createAttachmentKey } from 'svelte/attachments';
	import { cx } from '../../internal/sx.js';
	import { useScrollableArea } from '../../hooks/use-scrollable-area.svelte.js';
	import { themeProps } from '../../internal/theme-props.js';
	import {
		containerPaddingBlockEndVarStyles,
		containerPaddingBlockStartVarStyles,
		containerPaddingInlineEndVarStyles,
		containerPaddingInlineStartVarStyles,
		containerPaddingInlineVarStyles,
		paddingBlockEndStyles,
		paddingBlockStartStyles,
		paddingBlockStyles,
		paddingInlineEndStyles,
		paddingInlineStartStyles,
		paddingInlineStyles,
		paddingStyles
	} from '../../internal/padding.stylex.js';
	import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
	import {
		scrollableAreaContentStyle,
		scrollableAreaContentWithInlineOverflowStyle,
		scrollableAreaFullBleedStyle,
		scrollableAreaSizingStyle,
		scrollableAreaViewportStyle
	} from './scrollable-area.stylex.js';

	/**
	 * A native scroll viewport with axis-aware accessibility and chaining.
	 *
	 * Ported from Astryx's `ScrollableArea/ScrollableArea.tsx`. The root is the
	 * viewport; its single child is a normal block content box with a 100% minimum
	 * size, so children participate in that box rather than directly in viewport
	 * flex/grid layout.
	 */
	let {
		children,
		axis = 'block',
		label,
		role = 'group',
		overscroll = 'allow',
		width,
		height,
		maxWidth,
		minHeight,
		stickyContainment = 'whenScrollable',
		padding = 0,
		paddingInline,
		paddingInlineStart,
		paddingInlineEnd,
		paddingBlock,
		paddingBlockStart,
		paddingBlockEnd,
		isFullBleed = false,
		ref = $bindable(null),
		xstyle,
		class: className,
		style: styleProp,
		...rest
	}: ScrollableAreaProps = $props();

	const hook = useScrollableArea(() => ({
		axis,
		keyboardAccess: { owner: 'viewport', label, role } satisfies ScrollKeyboardAccess,
		overscroll,
		stickyContainment
	}));
	const theme = $derived(themeProps('scrollable-area', { axis }));
	const refKey = createAttachmentKey();

	const viewportProps = $derived(
		hook.getViewportProps({
			...rest,
			...theme,
			class: cx(theme.class, className),
			style: styleProp,
			xstyle: [
				scrollableAreaViewportStyle,
				isFullBleed && scrollableAreaFullBleedStyle,
				focusOutlineStyles.focusVisible,
				scrollableAreaSizingStyle(
					width ?? null,
					height ?? null,
					maxWidth ?? null,
					minHeight ?? null
				),
				xstyle
			],
			[refKey]: (node: HTMLElement) => {
				ref = node as HTMLDivElement;
			}
		})
	);

	const contentProps = $derived(
		hook.getContentProps({
			xstyle: [
				scrollableAreaContentStyle,
				axis !== 'block' && scrollableAreaContentWithInlineOverflowStyle,
				paddingStyles[padding],
				containerPaddingInlineVarStyles[padding],
				containerPaddingBlockStartVarStyles[padding],
				containerPaddingBlockEndVarStyles[padding],
				paddingInline != null && paddingInlineStyles[paddingInline],
				paddingInline != null && containerPaddingInlineVarStyles[paddingInline],
				paddingBlock != null && paddingBlockStyles[paddingBlock],
				paddingBlock != null && containerPaddingBlockStartVarStyles[paddingBlock],
				paddingBlock != null && containerPaddingBlockEndVarStyles[paddingBlock],
				paddingInlineStart != null && paddingInlineStartStyles[paddingInlineStart],
				paddingInlineStart != null && containerPaddingInlineStartVarStyles[paddingInlineStart],
				paddingInlineEnd != null && paddingInlineEndStyles[paddingInlineEnd],
				paddingInlineEnd != null && containerPaddingInlineEndVarStyles[paddingInlineEnd],
				paddingBlockStart != null && paddingBlockStartStyles[paddingBlockStart],
				paddingBlockStart != null && containerPaddingBlockStartVarStyles[paddingBlockStart],
				paddingBlockEnd != null && paddingBlockEndStyles[paddingBlockEnd],
				paddingBlockEnd != null && containerPaddingBlockEndVarStyles[paddingBlockEnd]
			]
		})
	);
</script>

<div {...viewportProps}>
	<div {...contentProps}>{@render children?.()}</div>
</div>
