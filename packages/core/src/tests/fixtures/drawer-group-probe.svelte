<script lang="ts">
	import Button from '$lib/components/button/button.svelte';
	import ButtonGroup from '$lib/components/button-group/button-group.svelte';
	import Drawer from '$lib/components/drawer/drawer.svelte';

	export const pressed: string[] = [];
</script>

<ButtonGroup label="Outer" isDisabled>
	{#snippet children()}
		<Button label="Outer member" />
		<Drawer isOpen onOpenChange={() => {}} label="Details">
			<Button label="Independent" onclick={() => pressed.push('Independent')} />
			<Button label="Explicit disabled" isDisabled />
			<ButtonGroup label="Inner" isDisabled>
				{#snippet children()}
					<Button label="Inner member" />
				{/snippet}
			</ButtonGroup>
		</Drawer>
	{/snippet}
</ButtonGroup>
