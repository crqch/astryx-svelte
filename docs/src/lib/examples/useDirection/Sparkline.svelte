<!--
	Helper for `useDirectionHookUsage.svelte`, transcribed from the `Sparkline`
	component in upstream's block. A separate file because it owns a canvas ref
	and an effect.
-->
<script lang="ts">
	import { useDirection } from '@astryx-sv/core';

	const DATA_POINTS = [10, 25, 18, 40, 32, 60, 48, 75];

	const direction = useDirection();
	let canvas = $state<HTMLCanvasElement | null>(null);

	$effect(() => {
		const element = canvas;
		const dir = direction();
		if (!element) return;
		const ctx = element.getContext('2d');
		if (!ctx) return;

		const width = element.width;
		const height = element.height;
		ctx.clearRect(0, 0, width, height);

		const step = width / (DATA_POINTS.length - 1);
		const maxVal = Math.max(...DATA_POINTS);
		const minVal = Math.min(...DATA_POINTS);
		const range = maxVal - minVal || 1;

		ctx.beginPath();
		ctx.strokeStyle = '#0064e0';
		ctx.lineWidth = 2;

		DATA_POINTS.forEach((val, i) => {
			// In LTR: oldest data starts at 0 (left), newest at right.
			// In RTL: oldest data starts at right (width), newest at left.
			const x = dir === 'rtl' ? width - i * step : i * step;
			const y = height - ((val - minVal) / range) * (height - 10) - 5;
			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		});
		ctx.stroke();

		// Draw point at latest value.
		const lastIndex = DATA_POINTS.length - 1;
		const lastX = dir === 'rtl' ? 0 : width;
		const lastY = height - ((DATA_POINTS[lastIndex] - minVal) / range) * (height - 10) - 5;
		ctx.beginPath();
		ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
		ctx.fillStyle = '#0064e0';
		ctx.fill();
	});
</script>

<canvas
	bind:this={canvas}
	width={200}
	height={60}
	data-testid="sparkline-canvas"
	data-direction={direction()}
	style="border: 1px solid #e1e4e8; border-radius: 4px"
></canvas>
