<script lang="ts">
	import { useAnnounce } from '$lib/hooks/use-announce.js';

	/** Upstream's `AppForm`: app code rendered inside a Dialog. */
	const announce = useAnnounce();
</script>

<form
	onsubmit={(event) => {
		event.preventDefault();
		announce('Saved');
	}}
>
	<button type="submit">Save</button>
</form>
