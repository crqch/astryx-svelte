<script lang="ts">
	import Calendar from '$lib/components/calendar/calendar.svelte';
	import type { ISODateString } from '$lib/utils/date-types.js';

	/**
	 * Upstream's `ControlledFocusCalendar`: a controlled Calendar whose owner
	 * follows the focus-date changes. `focusDate` is the controlled prop and the
	 * owner writes each requested change straight back, so navigation moves the
	 * visible month.
	 */
	interface Props {
		onFocusDateChange?: (iso: string) => void;
	}

	const { onFocusDateChange }: Props = $props();

	let focusDate = $state<ISODateString>('2026-01-01');
</script>

<Calendar
	{focusDate}
	onFocusDateChange={(iso) => {
		onFocusDateChange?.(iso);
		focusDate = iso;
	}}
/>
