<script lang="ts" module>
	export interface DrawerInspectorProbeProps {
		unmountWith?: 'save' | 'view';
		hasScrim?: boolean;
	}
</script>

<script lang="ts">
	import Drawer from '$lib/components/drawer/drawer.svelte';

	let { unmountWith = 'save', hasScrim = false }: DrawerInspectorProbeProps = $props();

	let isEditing = $state(false);
	let showView = $state(true);
</script>

<button type="button" data-testid="edit" onclick={() => (isEditing = true)}>Edit</button>
<button type="button" data-testid="elsewhere">Elsewhere</button>

{#if showView && isEditing}
	<Drawer
		isOpen
		onOpenChange={(open) => {
			if (!open) isEditing = false;
		}}
		label="Edit row"
		{hasScrim}
		style="transition-duration: 0.01s"
	>
		<button
			type="button"
			data-testid="save"
			onclick={() => {
				if (unmountWith === 'save') isEditing = false;
				else showView = false;
			}}
		>
			Save
		</button>
	</Drawer>
{/if}
