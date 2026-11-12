<script lang="ts">
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import {
		InternationalizationContext,
		type InternationalizationContextValue
	} from '../../lib/i18n/internationalization-context.svelte.js';
	import { useCalendarSystem } from '../../lib/i18n/use-calendar-system.svelte.js';

	let { calendar }: { calendar?: CalendarSystem } = $props();

	const get = InternationalizationContext.getOr((): InternationalizationContextValue => ({
		locale: 'en',
		direction: 'ltr',
		messages: {}
	}));
	const requested = $derived(get().calendar ?? 'none');
	const shown = useCalendarSystem(() => calendar, 'Probe');
</script>

<span data-testid="requested">{requested}</span>
<span data-testid="shown">{shown()}</span>
