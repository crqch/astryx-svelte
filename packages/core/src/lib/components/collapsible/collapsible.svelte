<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { AnimatedLayout } from '../../motion/animated-layout.js';

	export interface CollapsibleProps extends BaseProps<HTMLDivElement> {
		/**
		 * Always-visible trigger content, rendered inside the disclosure button. A
		 * string renders as text; a snippet renders element content (upstream's
		 * `ReactNode`, following the `Item.label` `string | Snippet` precedent).
		 */
		trigger: string | Snippet;
		/** Content that collapses/expands. */
		children?: Snippet;
		/** Default open state for uncontrolled usage. @default true */
		defaultIsOpen?: boolean;
		/** Controlled open state. */
		isOpen?: boolean;
		/**
		 * Disable the collapsible. The trigger uses `aria-disabled` (not native
		 * `disabled`) and drops out of the tab order, staying perceivable; an
		 * already-open item is not collapsed. @default false
		 */
		isDisabled?: boolean;
		/** Called when the open state changes. */
		onOpenChange?: (isOpen: boolean) => void;
		/**
		 * The handle from `useAnimatedLayout({ container })`. With it, opening and
		 * closing glides the content after this Collapsible, up to that container,
		 * instead of jumping, and the chevron turns on the same timing.
		 */
		animatedLayout?: AnimatedLayout;
		/**
		 * Logical position of the disclosure chevron.
		 *
		 * - `end` (default): a trailing indicator that points down when collapsed
		 *   and up when expanded.
		 * - `start`: a leading disclosure arrow ahead of the label, pointing inward
		 *   toward the content when collapsed (mirrored under RTL) and down when
		 *   expanded.
		 *
		 * Inside a `CollapsibleGroup` this defaults to the group's
		 * `chevronPosition`. @default 'end'
		 */
		chevronPosition?: CollapsibleChevronPosition;
		/** Identifier for coordination within a `CollapsibleGroup`. */
		value?: string;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import Icon from '../icon/icon.svelte';
	import {
		applyLayoutChangeTransition,
		holdLayoutExit,
		playLayoutChange,
		releaseLayoutExit,
		reportLayoutChange
	} from '../../motion/animated-layout.js';
	import { useLayoutChangeSnapshot } from '../../motion/layout-change-snapshot.svelte.js';
	import {
		moveFocusLeftBehind,
		noteFocusWithin,
		type FocusWithin
	} from '../../utils/focus-return.js';
	import { trackInteractionModality } from '../../utils/interaction-modality.js';
	import { useFocusLeavingChange } from '../../utils/use-focus-leaving-change.svelte.js';
	import {
		setCollapsibleGroupPresentationContext,
		useCollapsibleGroupPresentationContext,
		type CollapsibleChevronPosition
	} from './collapsible-group-context.svelte.js';
	import { useCollapsible } from './use-collapsible.svelte.js';
	import { usePressFeedback } from '../../hooks/use-press-feedback.svelte.js';
	import {
		collapsibleChevronClosedStyle,
		collapsibleChevronOpenStyle,
		collapsibleChevronStartClosedStyle,
		collapsibleChevronStartOpenStyle,
		collapsibleChevronStartStyle,
		collapsibleChevronStyle,
		collapsibleContentAttrs,
		collapsibleRootAttrs,
		collapsibleTriggerAttrs,
		collapsibleTriggerLabelAttrs
	} from './collapsible.stylex.js';

	/**
	 * A primitive that makes any content collapsible: an always-visible trigger
	 * with a chevron, and a content region toggled on click. Self-managed by
	 * default, or coordinated by a `CollapsibleGroup` when given a `value`.
	 *
	 * Collapse is `display:none` (children stay mounted); only the chevron
	 * animates. When inside a divider group, the item draws its own row chrome
	 * from the presentation context — which is reset to null for its children so
	 * nested collapsibles stay chrome-free.
	 */
	const {
		trigger,
		children,
		defaultIsOpen,
		isOpen: controlledIsOpen,
		isDisabled = false,
		onOpenChange,
		animatedLayout,
		chevronPosition,
		value,
		xstyle,
		class: className,
		style: styleProp,
		...rest
	}: CollapsibleProps = $props();

	const contentId = $props.id();

	const collapsible = useCollapsible(() => ({
		isCollapsible:
			controlledIsOpen !== undefined
				? { isOpen: controlledIsOpen, onOpenChange }
				: { defaultIsOpen: defaultIsOpen ?? true, onOpenChange },
		value
	}));

	// With an `animatedLayout` handle, the content's size change animates: the
	// content after this Collapsible, up to the handle's container, glides, and
	// the revealed content plays its own entrance on the same timing
	// (`architecture:react-component-runtime` INV12). Without one, nothing
	// changes.
	let contentEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	const layoutChange = $derived(reportLayoutChange(animatedLayout, () => contentEl));

	// A close with a handle keeps the content rendered while it plays its exit:
	// the exit makes it inert and gives up its space, then the component hides
	// it (`spec:AST-105` FR4). Derived in a pre effect, from the open state as
	// it changes, so the closing commit already keeps it.
	let isExiting = $state(false);
	let renderedIsOpen = collapsible.isOpen;
	$effect.pre(() => {
		const isOpen = collapsible.isOpen;
		untrack(() => {
			if (renderedIsOpen === isOpen) {
				return;
			}
			renderedIsOpen = isOpen;
			isExiting = !isOpen && animatedLayout != null;
		});
	});

	function endExit(): void {
		// holdLayoutExit decides from layout read in the closing commit (the
		// content's place in the area's visible part, Reduce Motion and the
		// pointer, and whether an end margin frees its space); an exit it does
		// not hold hides the content before the frame paints.
		isExiting = false;
	}

	function chevronElement(): HTMLElement | null {
		return triggerEl?.querySelector<HTMLElement>(':scope > .astryx-icon') ?? null;
	}

	function measureChange(): void {
		// The chevron (the trigger's Icon, its `icon` theming target) turns on
		// the glide's motion too.
		applyLayoutChangeTransition(animatedLayout, chevronElement());
		layoutChange.measureBefore();
	}

	// Focus inside the content when it closes would be lost to the page once
	// the content hides or turns inert. It moves to the trigger that closes it
	// (AR4); focus anywhere else is not moved. The trigger's own document's
	// last input decides the moved focus's ring.
	$effect(() => {
		trackInteractionModality();
	});
	const noteClosingFocus = useFocusLeavingChange<boolean, FocusWithin | null>(
		() => collapsible.isOpen,
		(wasOpen) => (wasOpen ? noteFocusWithin(contentEl) : null),
		(focus) => {
			moveFocusLeftBehind(focus, triggerEl, contentEl);
		}
	);

	// Every open-state change, whatever caused it (a click, an owner-set
	// `isOpen`, a group's value), is measured before it lands (`spec:AST-105`
	// FR1).
	useLayoutChangeSnapshot(
		() => collapsible.isOpen,
		(wasOpen) => {
			noteClosingFocus(wasOpen);
			if (animatedLayout != null) {
				measureChange();
			}
		}
	);

	// Commit the change: report it, play the entrance, or hold the exit.
	let wasOpen = collapsible.isOpen;
	$effect(() => {
		const isOpen = collapsible.isOpen;
		const exiting = isExiting;
		const handle = animatedLayout;
		const change = layoutChange;
		const content = contentEl;
		untrack(() => {
			if (wasOpen === isOpen) {
				return;
			}
			wasOpen = isOpen;
			if (content == null) {
				return;
			}
			// A change that was not measured (no handle) lands at once, entrance
			// and exit included, so the content and what follows stay in step.
			const isMeasured = change.animate();
			if (isOpen) {
				// Opened again mid-exit: the content takes its place in flow.
				releaseLayoutExit(content);
				if (isMeasured) {
					playLayoutChange(handle, content);
				}
				return;
			}
			const isHeld = exiting && isMeasured && holdLayoutExit(handle, content, endExit);
			if (exiting && !isHeld) {
				// An exit holdLayoutExit did not hold (unmeasured, out of view,
				// Reduce Motion with a fine pointer, or no margin frees its
				// space): hide the content before this frame paints.
				endExit();
			}
		});
	});
	$effect(() => {
		const isOpen = collapsible.isOpen;
		const exiting = isExiting;
		const content = contentEl;
		untrack(() => {
			if (!isOpen && !exiting && content != null) {
				// Hidden again after its exit: drop the exit's inline values.
				releaseLayoutExit(content);
			}
		});
	});
	// Without a handle the chevron keeps the theme's own turn: a spring a
	// handle set stays only while it is passed (`spec:AST-105` FR2).
	$effect(() => {
		const handle = animatedLayout;
		untrack(() => {
			if (handle == null) {
				applyLayoutChangeTransition(null, chevronElement());
			}
		});
	});

	// Read the group's presentation (dividers/density) from the ancestor, then
	// reset it to null for our own descendants so nested collapsibles stay
	// chrome-free (the coordination context is intentionally NOT reset).
	const presentationGetter = useCollapsibleGroupPresentationContext();
	setCollapsibleGroupPresentationContext(() => null);

	const presentation = $derived(presentationGetter());
	const isDivided = $derived(presentation?.hasDividers ?? false);
	const density = $derived(presentation?.density ?? null);
	// The item wins over the group so a single row can differ, but the group is
	// the level this is normally set at — mixed sides in one list read as a bug.
	const position = $derived(chevronPosition ?? presentation?.chevronPosition ?? 'end');
	const isChevronAtStart = $derived(position === 'start');

	function handleToggle(): void {
		if (isDisabled) {
			return;
		}
		collapsible.toggle();
	}

	const theme = $derived(
		themeProps('collapsible', {
			density: density ?? undefined,
			divided: isDivided ? 'divided' : null
		})
	);
	const contentTheme = $derived(
		themeProps('collapsible-content', {
			density: density ?? undefined,
			open: collapsible.isOpen ? 'open' : null
		})
	);
	const rootAttrs = $derived(collapsibleRootAttrs(isDivided, xstyle));
	// The trigger is a theming target of its own, so a theme can restyle it
	// independently from the content — e.g. a heading font on the trigger while
	// the content keeps the body font. Every visual axis and state the target
	// owns is reflected, as upstream does, so a theme can select them.
	const triggerTheme = $derived(
		themeProps('collapsible-trigger', {
			density: density ?? undefined,
			chevronPosition: position,
			open: collapsible.isOpen ? 'open' : null,
			disabled: isDisabled ? 'disabled' : null
		})
	);
	// The trigger is the pressable: it has no hover surface, so its pressed
	// overlay is the only background it paints.
	const pressable = usePressFeedback();
	const triggerAttrs = $derived(collapsibleTriggerAttrs(density, isDisabled));
	const triggerLabelAttrs = collapsibleTriggerLabelAttrs();
	const contentAttrs = $derived(collapsibleContentAttrs(density, collapsible.isOpen || isExiting));
</script>

<!--
	`{...rest}` last, as upstream spreads `{...props}` last — a consumer's `data-*`
	or `aria-*` overrides the component's own reflection rather than being
	overridden by it. `class`/`style` are destructured out, so they cannot be
	clobbered from here.
-->
<div
	{...theme}
	class={cx(theme.class, rootAttrs.class, className)}
	style={mergeStyle(rootAttrs.style, styleProp as string | undefined)}
	{...rest}
>
	<button
		bind:this={triggerEl}
		type="button"
		onclick={handleToggle}
		aria-disabled={isDisabled || undefined}
		aria-expanded={collapsible.isOpen}
		aria-controls={contentId}
		tabindex={isDisabled ? -1 : undefined}
		{...isDisabled ? undefined : pressable}
		{...triggerTheme}
		class={cx(triggerTheme.class, triggerAttrs.class)}
		style={triggerAttrs.style}
	>
		{#if isChevronAtStart}
			<Icon
				icon="chevronRight"
				size="sm"
				color="secondary"
				xstyle={[
					collapsibleChevronStyle,
					collapsibleChevronStartStyle,
					collapsible.isOpen ? collapsibleChevronStartOpenStyle : collapsibleChevronStartClosedStyle
				]}
			/>
		{/if}
		<span class={triggerLabelAttrs.class} style={triggerLabelAttrs.style}>
			{#if typeof trigger === 'function'}{@render trigger()}{:else}{trigger}{/if}
		</span>
		{#if !isChevronAtStart}
			<Icon
				icon="chevronDown"
				size="sm"
				color="secondary"
				xstyle={[
					collapsibleChevronStyle,
					collapsible.isOpen ? collapsibleChevronOpenStyle : collapsibleChevronClosedStyle
				]}
			/>
		{/if}
	</button>
	<div
		bind:this={contentEl}
		id={contentId}
		{...contentTheme}
		class={cx(contentTheme.class, contentAttrs.class)}
		style={contentAttrs.style}
	>
		<!--
			One box holds the content, so an opening or closing slides it under
			the region's clip: a translation cannot move bare text.
		-->
		<div>
			{@render children?.()}
		</div>
	</div>
</div>
