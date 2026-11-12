<script lang="ts">
	import { Button, Heading, HStack, Section, Text, VStack } from '@astryx-sv/core';
	import Seo from '$lib/seo/seo.svelte';
	import { componentsHref, homeHref, topicHref } from '$lib/shell/links.js';

	/**
	 * The site's real 404 page.
	 *
	 * A static host needs a `404.html` at the root of the asset directory, and
	 * Cloudflare's `not_found_handling: "404-page"` serves that file for a
	 * navigation request that matches no asset. Prerendering this route writes
	 * `404.html`, which replaces the plaintext fallback `adapter-cloudflare`
	 * emits before `writePrerendered` runs.
	 *
	 * `/404` is not linked from the site and `<Seo noindex>` keeps it out of
	 * search results. It is a destination for the host's error path, not a
	 * page readers should land on by browsing.
	 */
</script>

<Seo
	title="Page not found"
	description="That page is not here. Start from the documentation home page or browse the component gallery."
	noindex
/>

<Section maxWidth={680} padding={10}>
	<VStack gap={5} hAlign="center">
		<Text type="code" color="secondary">404</Text>
		<Heading level={1} type="display-2" justify="center">This page does not exist.</Heading>
		<Text type="large" color="secondary" justify="center">
			The link may be stale, or the page may have moved. The docs home page and the component
			gallery are the best places to start again.
		</Text>
		<HStack gap={2} wrap="wrap" hAlign="center">
			<Button href={homeHref()} label="Go to the docs" variant="primary" />
			<Button href={componentsHref()} label="Browse components" variant="secondary" />
			<Button href={topicHref('getting-started')} label="Getting started" variant="ghost" />
		</HStack>
	</VStack>
</Section>
