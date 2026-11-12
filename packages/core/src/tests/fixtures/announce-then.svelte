<script lang="ts" module>
	export interface AnnounceThenProps {
		message: string;
		label?: string;
		onDone?: () => void;
	}
</script>

<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';

	/** Announces its message, then performs the owner's close/hand-off action. */
	const { message, label = 'Go', onDone }: AnnounceThenProps = $props();
	const announce = useAnnounce();
</script>

<button
	type="button"
	onclick={() => {
		announce(message);
		onDone?.();
	}}>{label}</button
>
