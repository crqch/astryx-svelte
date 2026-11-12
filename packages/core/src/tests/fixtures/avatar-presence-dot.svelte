<script lang="ts" module>
	export interface AvatarPresenceDotProps {
		/** What the dot reports, e.g. "Online". */
		presence?: string;
	}
</script>

<script lang="ts">
	import AvatarStatusDot from '$lib/components/avatar/avatar-status-dot.svelte';

	/**
	 * The consumer's own wrapper around `AvatarStatusDot` for the P14 cases.
	 *
	 * Its prop is deliberately called `presence`, not `label`, so upstream's
	 * render-time `status.props.label` introspection has nothing to read and the
	 * dot's own report is the only way the label can reach the avatar.
	 */
	const { presence = 'Online' }: AvatarPresenceDotProps = $props();
</script>

<AvatarStatusDot variant="success" label={presence} />
