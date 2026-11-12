<script lang="ts">
	import {
		useCalendarNavigation,
		type UseCalendarNavigationOptions,
		type UseCalendarNavigationReturn
	} from '../../lib/components/calendar/use-calendar-navigation.svelte.js';

	let { options }: { options: UseCalendarNavigationOptions } = $props();

	const nav = useCalendarNavigation(() => options);

	export const getNavigation = (): UseCalendarNavigationReturn => nav;
</script>

<span data-testid="navigation-hook"></span>
