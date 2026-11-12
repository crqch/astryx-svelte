<script lang="ts">
	import {
		useCalendarDays,
		type UseCalendarDaysOptions,
		type UseCalendarDaysReturn
	} from '../../lib/components/calendar/use-calendar-days.svelte.js';

	let { options }: { options: UseCalendarDaysOptions } = $props();

	const grid = useCalendarDays(() => options);

	export const getGrid = (): UseCalendarDaysReturn => grid;
</script>

<span data-testid="days-hook"></span>
