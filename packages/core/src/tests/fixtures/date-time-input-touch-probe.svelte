<script lang="ts">
	import DateTimeInput from '$lib/components/date-time-input/date-time-input.svelte';
	import type { DateTimeInputProps } from '$lib/components/date-time-input/date-time-input.svelte';

	/**
	 * Upstream's local `DateTimeInput` wrapper in
	 * `DateTimeInput/DateTimeInputTouch.test.tsx`: every case renders through it
	 * with `nativePicker="never"`, so the suite keeps exercising Astryx's
	 * coarse-pointer bottom sheet now that `DateTimeInput` defaults to the
	 * platform date picker on touch.
	 */
	let { ...props }: DateTimeInputProps = $props();
</script>

<DateTimeInput {...props} nativePicker="never" />
