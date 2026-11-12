<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { AriaRole } from 'svelte/elements';
	import type { BaseProps } from '../../base-props.js';
	import type { SizeValue, SpacingStep } from '../../internal/types.js';
	import type { ResizableProps } from '../resizable/use-resizable.svelte.js';

	export interface LayoutPanelProps extends BaseProps<HTMLDivElement> {
		children?: Snippet;
		/**
		 * Adds a themed border on the edge facing the content — the end edge in a
		 * start panel, the start edge in an end panel. Without one, that edge's
		 * spacing collapses so the panel merges into the content.
		 * @default false
		 */
		hasDivider?: boolean;
		/**
		 * Internal padding, on the spacing scale. Overrides the padding the layout
		 * container would otherwise hand down.
		 */
		padding?: SpacingStep;
		/**
		 * Scroll the panel's overflow. Set it false for an auto-height layout where
		 * sticky positioning has to work against a parent container.
		 * @default true
		 */
		isScrollable?: boolean;
		/**
		 * Accessible name for the landmark. Required when `role` is set and more
		 * than one landmark of that type exists.
		 */
		label?: string;
		/**
		 * Use `navigation` or `complementary` only in a top-level layout, never in
		 * a nested one.
		 */
		role?: AriaRole;
		/**
		 * Numbers are pixels; strings are used as-is. Ignored when `resizable` is
		 * given — the region controls the width then.
		 */
		width?: SizeValue;
		/**
		 * A region's props from `useResizable()`. The panel's width comes from the
		 * region, and a `ResizeHandle` for the same region goes beside the panel.
		 *
		 * @example
		 * ```svelte
		 * const sidebar = useResizable(() => ({ defaultSize: 250, minSizePx: 200 }));
		 * <LayoutPanel resizable={sidebar.props}>…</LayoutPanel>
		 * <ResizeHandle resizable={sidebar.props} />
		 * ```
		 */
		resizable?: ResizableProps;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { useLayoutChangeSnapshot } from '../../motion/layout-change-snapshot.svelte.js';
	import {
		createResizablePaneLink,
		regionOfProps,
		type LayoutEdge
	} from '../resizable/resizable-pane.js';
	import { useLayoutArea } from './layout-area-context.svelte.js';
	import { layoutPanelAttrs } from './layout-panel.stylex.js';
	import { useLayoutSlots } from './layout-slots-context.svelte.js';

	/**
	 * A side panel for a `Layout`'s `start` or `end` slot — navigation on one
	 * side, an inspector on the other. Which edge its divider sits on is read
	 * from the slot it was placed in, not from a prop.
	 *
	 * It provides its own padding and scroll containment, so children should add
	 * neither; pass `padding={0}` for edge-to-edge content.
	 */
	const {
		children,
		hasDivider = false,
		isScrollable = true,
		label,
		padding,
		role,
		width,
		resizable,
		class: className,
		style: styleProp,
		xstyle,
		...rest
	}: LayoutPanelProps = $props();

	// A resizable region drives the width; the prop is ignored while one is set.
	const effectiveWidth = $derived(resizable ? resizable._size : width);
	// A collapsed region sizes its panel to 0.
	const isZeroWidth = $derived(effectiveWidth === 0);

	const area = useLayoutArea();
	const slots = useLayoutSlots();
	let panelEl: HTMLDivElement | undefined = $state();

	// The panel lends its element to the region that sizes it, so the region's
	// handle can draw a rubber band over it, its close slide can measure it,
	// and its collapse can play an edge reveal. A hand-built `resizable` object
	// has no region: it lends nothing and never moves.
	const paneLink = createResizablePaneLink();
	const paneRegion = $derived(resizable ? regionOfProps(resizable) : undefined);
	// Without resizable props, a ResizeHandle beside the panel that has a
	// region's props finds it through the panes lent beside it.
	const isFoundBeside = $derived(resizable == null);
	const contentFacingEdge = $derived<LayoutEdge>(area() === 'end' ? 'inline-start' : 'inline-end');

	$effect(() => {
		const element = panelEl ?? null;
		const isLent = isFoundBeside || paneRegion != null;
		const pane = paneLink.attach(isLent ? element : null, isFoundBeside);
		paneRegion?.attach(pane);
		return () => {
			paneLink.attach(null, isFoundBeside);
			paneRegion?.attach(null);
		};
	});
	// Before the DOM changes in the update that renders width 0, or away from it.
	useLayoutChangeSnapshot(
		() => isZeroWidth,
		(toCollapsed) => paneLink.beforeChange(toCollapsed)
	);
	// After every update: the width and edge this one rendered.
	$effect(() => {
		paneLink.committed(effectiveWidth, contentFacingEdge);
	});

	const attrs = $derived(
		layoutPanelAttrs(
			{
				area: area(),
				slots: slots(),
				hasDivider,
				isScrollable: isScrollable && !isZeroWidth,
				padding,
				width: effectiveWidth,
				isZeroWidth
			},
			xstyle
		)
	);
	const theme = themeProps('layout-panel');
</script>

<div
	bind:this={panelEl}
	{role}
	aria-label={label}
	{...theme}
	class={cx(theme.class, attrs.class, className)}
	style={mergeStyle(attrs.style, styleProp as string | undefined)}
	{...rest}
>
	{@render children?.()}
</div>
