<script lang="ts">
	import Calendar from '$lib/components/calendar/calendar.svelte';
	import type { DateRange, ISODateString } from '$lib/utils/date-types.js';

	/**
	 * Upstream's inline `RefusingOwner`: a controlled focus owner that ignores
	 * every requested change until its own `allow` button is clicked, then lets
	 * the Next button page the months without moving focus itself.
	 */
	interface Props {
		onChange?: (value: ISODateString | DateRange) => void;
	}

	const { onChange }: Props = $props();

	let focusDate = $state<ISODateString>('2026-01-01');
	let allow = $state(false);
</script>

<button type="button" onclick={() => (allow = true)}>allow</button>
<Calendar
	{focusDate}
	onFocusDateChange={(next) => {
		if (allow) {
			focusDate = next;
		}
	}}
	{onChange}
/>
