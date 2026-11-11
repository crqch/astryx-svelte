<script lang="ts">
	import { createRawSnippet } from 'svelte';
	import InfoTip from '$lib/components/info-tip/info-tip.svelte';
	import InternationalizationProvider from '$lib/i18n/internationalization-provider.svelte';

	const content = createRawSnippet(() => ({ render: () => '<span>Helpful context</span>' }));
</script>

<InternationalizationProvider
	locale="en"
	overrides={{ en: { '@astryx.infoTip.label': 'Learn more' } }}
>
	<InfoTip {content} />
</InternationalizationProvider>
