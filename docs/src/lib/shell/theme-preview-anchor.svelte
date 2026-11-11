<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The inert anchor upstream's `ThemePackagePage` installs through its
	 * `LinkProvider` (`PreviewAnchor`).
	 *
	 * Every link inside the theme-showcase template is a demo affordance with
	 * `href="#"`. Without a provider, clicking one is a real same-page navigation:
	 * the URL gains `#` and the browser scrolls the docs page to the top. Upstream
	 * prevents the default on the anchor; this is that anchor as a component, the
	 * form `LinkProvider` takes here.
	 */
	interface Props {
		href?: string;
		onclick?: (event: MouseEvent) => void;
		children?: Snippet;
		[key: string]: unknown;
	}

	const { href, onclick, children, ...rest }: Props = $props();
</script>

<a
	{href}
	onclick={(event) => {
		event.preventDefault();
		onclick?.(event);
	}}
	{...rest}
>
	{@render children?.()}
</a>
