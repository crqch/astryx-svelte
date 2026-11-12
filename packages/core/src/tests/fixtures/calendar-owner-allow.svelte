<script lang="ts">
	import Calendar from '$lib/components/calendar/calendar.svelte';
	import type { DateRange, ISODateString } from '$lib/utils/date-types.js';

	/**
	 * Upstream's `Owner({allow})`: a controlled focus owner that accepts month
	 * changes only while `allow` is true. The prop is what the test re-renders,
	 * so the owner itself never moves focus.
	 */
	interface Props {
		allow: boolean;
		onChange?: (value: ISODateString | DateRange) => void;
	}

	const { allow, onChange }: Props = $props();

	let focusDate = $state<ISODateString>('2026-01-01');
</script>

<Calendar
	{focusDate}
	onFocusDateChange={(next) => {
		if (allow) {
			focusDate = next;
		}
	}}
	{onChange}
/>
