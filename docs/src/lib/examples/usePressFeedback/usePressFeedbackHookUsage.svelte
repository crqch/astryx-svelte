<!--
	Ported from upstream's `templates/blocks/components/Hooks/usePressFeedbackHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Upstream's two docs-only helpers are inlined here: `DemoHint` is the wrapper
	and hint line, and `PlayingCardContents` is written out for the one card this
	block shows (the queen of hearts). Its StyleX rules become a scoped `<style>`
	block, since a `.svelte` file may not import StyleX.
-->
<script lang="ts">
	import {
		Card,
		Text,
		focusOutlineStyles,
		interactionOverlayStyles,
		usePressFeedback
	} from '@astryx-sv/core';

	const pressable = usePressFeedback();
	let isFaceUp = $state(true);

	function flip() {
		isFaceUp = !isFaceUp;
	}

	/** The queen's crown, in the helper's 24 × 16 box. */
	const QUEEN_HEADDRESS = 'M3 15 L4 6 L9 10.5 L12 4 L15 10.5 L20 6 L21 15 Z';
</script>

<div class="hinted">
	<Card
		{...pressable}
		xstyle={[interactionOverlayStyles.backgroundImage, focusOutlineStyles.focusVisible]}
		width={120}
		padding={1}
		role="button"
		tabindex={0}
		aria-label="Flip card"
		aria-pressed={!isFaceUp}
		onclick={flip}
		onkeydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				flip();
			}
		}}
	>
		{#if isFaceUp}
			<span role="img" aria-label="Queen of hearts" class="playing-card card-face">
				<span aria-hidden="true" class="corner corner-start">
					<span class="corner-rank">Q</span>
					<span class="corner-suit">♥</span>
				</span>
				<span aria-hidden="true" class="court">
					<span class="court-half">
						<svg viewBox="0 0 24 16" class="headdress">
							<path d={QUEEN_HEADDRESS} fill="currentColor" />
						</svg>
						<span class="court-rank">
							Q
							<span class="court-suit">♥</span>
						</span>
					</span>
					<span class="court-half upside-down">
						<svg viewBox="0 0 24 16" class="headdress">
							<path d={QUEEN_HEADDRESS} fill="currentColor" />
						</svg>
						<span class="court-rank">
							Q
							<span class="court-suit">♥</span>
						</span>
					</span>
				</span>
				<span aria-hidden="true" class="corner corner-end">
					<span class="corner-rank">Q</span>
					<span class="corner-suit">♥</span>
				</span>
			</span>
		{:else}
			<span role="img" aria-label="Card back" class="playing-card">
				<span class="card-back"></span>
			</span>
		{/if}
	</Card>
	<Text
		type="supporting"
		color="secondary"
		style="max-inline-size: 40ch; text-align: center; text-wrap: balance"
	>
		Press and hold the card to see the press; tap, click, Enter or Space to flip it.
	</Text>
</div>

<style>
	.hinted {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-3);
	}

	.playing-card {
		position: relative;
		display: block;
		aspect-ratio: 5 / 7;
		inline-size: 100%;
		container-type: inline-size;
		user-select: none;
	}

	.card-face {
		color: var(--color-text-red);
		font-family: var(--font-family-heading);
	}

	.corner {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-inline-size: 12cqi;
		line-height: 1;
	}

	.corner-start {
		top: 3cqi;
		left: 3cqi;
	}

	.corner-end {
		bottom: 3cqi;
		right: 3cqi;
		transform: rotate(180deg);
	}

	.corner-rank {
		font-size: 14cqi;
		font-weight: var(--font-weight-semibold);
		letter-spacing: -0.05em;
	}

	.corner-suit {
		font-size: 12cqi;
	}

	.court {
		position: absolute;
		top: 13%;
		bottom: 13%;
		left: 17%;
		right: 17%;
		display: grid;
		grid-template-rows: 1fr 1fr;
		border-width: 1px;
		border-style: solid;
		border-color: currentColor;
		border-radius: var(--radius-inner);
		background-color: var(--color-background-red);
		overflow: hidden;
	}

	.court-half {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1cqi;
		padding-block-start: 2cqi;
	}

	.upside-down {
		rotate: 180deg;
	}

	.headdress {
		inline-size: 28cqi;
		block-size: auto;
	}

	.court-rank {
		display: flex;
		align-items: baseline;
		gap: 1cqi;
		font-size: 22cqi;
		font-weight: var(--font-weight-semibold);
		line-height: 1;
	}

	.court-suit {
		font-size: 14cqi;
	}

	.card-back {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-inner);
		background-color: var(--color-accent);
		background-image:
			repeating-linear-gradient(
				45deg,
				transparent 0 3cqi,
				color-mix(in srgb, var(--color-on-accent) 22%, transparent) 3cqi 4cqi
			),
			repeating-linear-gradient(
				-45deg,
				transparent 0 3cqi,
				color-mix(in srgb, var(--color-on-accent) 22%, transparent) 3cqi 4cqi
			);
		box-shadow:
			inset 0 0 0 4cqi var(--color-accent),
			inset 0 0 0 5cqi var(--color-on-accent);
	}
</style>
