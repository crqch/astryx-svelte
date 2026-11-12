<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { StyleArg } from '../../../internal/sx.js';

	/** @internal Portable renderer composed by Markdown for built-in headings only. */
	export interface HeadingLinksRendererProps {
		readonly children: Snippet;
		readonly headingId: string;
		readonly headingLabel: string;
		readonly permalinkUrl: string;
		readonly contentWidth: string | null;
		readonly contentAlign: 'start' | 'center';
		readonly headingTextStyle: StyleArg;
		readonly blockSpacingStyle: StyleArg;
		/** The heading's own direction; the copy control follows its inline end. */
		readonly dir?: 'ltr' | 'rtl';
	}
</script>

<script lang="ts">
	import Button from '../../button/button.svelte';
	import Icon from '../../icon/icon.svelte';
	import { useClipboard } from '../../../hooks/use-clipboard.svelte.js';
	import { useContainerReveal } from '../../../hooks/use-container-reveal.svelte.js';
	import { useTranslator } from '../../../i18n/use-translator.svelte.js';
	import { cx, mergeStyle } from '../../../internal/sx.js';
	import {
		headingLinksBaselineProbeAttrs,
		headingLinksControlSlotAttrs,
		headingLinksCopyButtonXstyle,
		headingLinksGlyphAttrs,
		headingLinksRowAttrs
	} from './heading-links.stylex.js';

	/**
	 * Ported from Astryx's `Markdown/plugins/HeadingLinksRenderer.tsx`.
	 *
	 * One honest copy button per built-in heading. The heading stays the
	 * document's incoming fragment target; activating `#` copies the canonical
	 * URL and never mutates location, scrolls, or implies a link. The button is
	 * hidden at fine-pointer rest by `useContainerReveal`, reveals on heading-row
	 * hover or keyboard focus, and stays visible under coarse-pointer semantics.
	 */
	let {
		children,
		headingId,
		headingLabel,
		permalinkUrl,
		contentWidth,
		contentAlign,
		headingTextStyle,
		blockSpacingStyle,
		dir
	}: HeadingLinksRendererProps = $props();

	const COPY_FEEDBACK_MS = 1500;

	const t = useTranslator();
	const copiedLabel = $derived(t('@astryx.markdownHeadingLinks.copied'));
	const copyLabel = $derived(
		t('@astryx.markdownHeadingLinks.copy', { heading: headingLabel || headingId })
	);
	const clipboard = useClipboard(() => ({
		announce: copiedLabel,
		resetAfterMs: COPY_FEEDBACK_MS
	}));
	const reveal = useContainerReveal();

	const row = $derived(
		headingLinksRowAttrs(headingTextStyle, blockSpacingStyle, contentWidth, contentAlign)
	);
	const container = $derived(reveal.getContainerProps());
	const revealProps = $derived(reveal.getContentRevealProps({ isLayoutPreserved: true }));
	const controlSlot = headingLinksControlSlotAttrs();
	const baselineProbe = headingLinksBaselineProbeAttrs();
	const glyph = headingLinksGlyphAttrs();

	function isUnmodifiedPrimaryActivation(event: MouseEvent): boolean {
		return (
			event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
		);
	}

	function handleClick(event: MouseEvent): void {
		if (!isUnmodifiedPrimaryActivation(event)) {
			return;
		}
		// This is deliberately an honest copy button rather than an anchor: the
		// heading remains an incoming fragment target, while activating the `#`
		// never mutates location, scrolls, or implies open-in-new-tab semantics.
		void clipboard.copy(new URL(permalinkUrl, window.location.href).href);
	}
</script>

<div
	{...dir != null ? { dir } : {}}
	class={cx(row.class, container.class)}
	style={mergeStyle(row.style, container.style)}
>
	{@render children()}
	<span class={controlSlot.class} style={controlSlot.style}>
		<span aria-hidden="true" class={baselineProbe.class} style={baselineProbe.style}>#</span>
		<Button
			type="button"
			variant="ghost"
			size="sm"
			label={clipboard.isCopied ? copiedLabel : copyLabel}
			isIconOnly
			onclick={handleClick}
			xstyle={headingLinksCopyButtonXstyle}
			class={revealProps.class}
			style={revealProps.style}
		>
			{#snippet icon()}
				<span aria-hidden="true" class={glyph.class} style={glyph.style}>
					{#if clipboard.isCopied}
						<Icon icon="check" size="sm" color="inherit" />
					{:else}
						#
					{/if}
				</span>
			{/snippet}
		</Button>
	</span>
</div>
