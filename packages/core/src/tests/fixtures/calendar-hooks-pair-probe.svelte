<script lang="ts">
	import {
		useCalendarNavigation,
		type UseCalendarNavigationOptions
	} from '../../lib/components/calendar/use-calendar-navigation.svelte.js';
	import { useCalendarDays } from '../../lib/components/calendar/use-calendar-days.svelte.js';

	let { options }: { options: UseCalendarNavigationOptions } = $props();

	const nav = useCalendarNavigation(() => options);
	const first = useCalendarDays(() => ({
		...nav.visibleCalendarMonths[0],
		calendar: options.calendar
	}));
	const second = useCalendarDays(() => ({
		...nav.visibleCalendarMonths[1],
		calendar: options.calendar
	}));

	export const getPair = () => ({ nav, grids: [first, second] });
</script>

<span data-testid="pair-label">{nav.monthYearLabel}</span>
