<!--
	Ported from upstream's `templates/blocks/components/ChatDictation/ChatDictationDictationInComposer.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		ChatComposer,
		ChatDictationButton,
		Stack,
		Text,
		type UseSpeechRecognitionReturn
	} from '@astryx-svelte/core';

	const noop = () => {};

	const idleDictation: UseSpeechRecognitionReturn = {
		volume: 0,
		rawBands: [0, 0, 0, 0, 0],
		bands: [0, 0, 0, 0, 0],
		isSupported: true,
		isListening: false,
		isSpeaking: false,
		interimTranscript: '',
		start: noop,
		stop: noop,
		abort: noop,
		toggle: noop
	};
</script>

<Stack direction="vertical" gap={3} style="width: 100%; max-width: 450px">
	<Text type="supporting" color="secondary">Dictation button in the sendActions slot</Text>
	<ChatComposer onSubmit={() => {}} placeholder="Type or tap the mic to dictate...">
		{#snippet sendActions()}
			<ChatDictationButton dictation={idleDictation} />
		{/snippet}
	</ChatComposer>
</Stack>
