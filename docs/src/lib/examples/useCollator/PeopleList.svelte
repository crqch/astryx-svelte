<!--
	Helper for `useCollatorHookUsage.svelte`, transcribed from the `PeopleList`
	component in upstream's block. A separate file because `useCollator` reads
	context during component initialisation, which a snippet cannot do.
-->
<script lang="ts">
	import { List, ListItem, useCollator } from '@astryx-sv/core';

	const PEOPLE = ['Zoë', 'emma', 'Örjan', 'Ana', 'Émile', 'oscar', 'Åsa'];

	const collator = useCollator();
	// Upstream re-runs the sort on every render; `$derived` is what tracks the
	// provider locale here.
	const sorted = $derived([...PEOPLE].sort(collator().compare));
</script>

<List density="compact" hasDividers>
	{#each sorted as name (name)}
		<ListItem label={name} />
	{/each}
</List>
