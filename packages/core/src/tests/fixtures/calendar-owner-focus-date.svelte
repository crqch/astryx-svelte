<script lang="ts">
	import Calendar from '$lib/components/calendar/calendar.svelte';
	import type { DateRange, ISODateString } from '$lib/utils/date-types.js';

	/**
	 * Upstream's `Owner({focusDate})`: a controlled owner that ignores every
	 * requested change. The shown months move only when the test re-renders it
	 * with a new `focusDate`, with no focus change of its own.
	 */
	interface Props {
		focusDate: ISODateString;
		onChange?: (value: ISODateString | DateRange) => void;
	}

	const { focusDate, onChange }: Props = $props();
</script>

<Calendar {focusDate} numberOfMonths={2} onFocusDateChange={() => {}} {onChange} />
