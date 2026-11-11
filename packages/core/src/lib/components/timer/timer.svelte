<script lang="ts" module>
	import type { BaseProps } from '../../base-props.js';
	import type { TextColor, TextSize, TextType, TextWeight } from '../text/text.stylex.js';

	/** How a Timer writes its duration. */
	export type TimerFormat = 'elapsed' | 'clock';

	export interface TimerProps extends Omit<BaseProps<HTMLTimeElement>, 'datetime'> {
		/**
		 * Unix time in milliseconds when the measured operation began. Omit it to
		 * start counting from this Timer's mount.
		 */
		startTime?: number;
		/**
		 * Standard duration representation.
		 *
		 * `elapsed` uses compact units and drops seconds after one hour; `clock`
		 * uses `m:ss` or `h:mm:ss`.
		 *
		 * @default 'elapsed'
		 */
		format?: TimerFormat;
		/**
		 * Semantic text type. Matches Timestamp typography behavior.
		 *
		 * @default 'supporting'
		 */
		type?: TextType;
		/** Explicit font size override. Overrides the size from `type`. */
		size?: TextSize;
		/**
		 * Text color.
		 *
		 * @default 'secondary'
		 */
		color?: TextColor;
		/** Font weight override. */
		weight?: TextWeight;
		/** The rendered `<time>` element, for focus management or measurement. */
		ref?: HTMLTimeElement | null;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import Text from '../text/text.svelte';
	import { timerTimeAttrs } from './timer.stylex.js';

	const ONE_SECOND_MS = 1000;
	const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
	const ONE_HOUR_SECONDS = 60 * 60;
	const MAX_TIMEOUT_MS = 2_147_483_647;

	interface TimerPresentation {
		dateTime: string;
		text: string;
	}

	function pad(value: number): string {
		return String(value).padStart(2, '0');
	}

	function resolveFormat(format: TimerFormat): TimerFormat {
		return format === 'clock' ? 'clock' : 'elapsed';
	}

	function getElapsedMilliseconds(now: number, startTime: number): number {
		return Math.max(0, now - startTime);
	}

	function getPresentation(elapsedMilliseconds: number, format: TimerFormat): TimerPresentation {
		const elapsedSeconds = Math.floor(elapsedMilliseconds / ONE_SECOND_MS);

		if (format === 'clock') {
			const hours = Math.floor(elapsedSeconds / ONE_HOUR_SECONDS);
			const minutes = Math.floor((elapsedSeconds % ONE_HOUR_SECONDS) / 60);
			const seconds = elapsedSeconds % 60;
			return {
				dateTime: `PT${elapsedSeconds}S`,
				text:
					hours > 0
						? `${String(hours)}:${pad(minutes)}:${pad(seconds)}`
						: `${String(minutes)}:${pad(seconds)}`
			};
		}

		if (elapsedSeconds < 60) {
			return { dateTime: `PT${elapsedSeconds}S`, text: `${String(elapsedSeconds)}s` };
		}

		const totalMinutes = Math.floor(elapsedSeconds / 60);
		if (totalMinutes < 60) {
			return {
				dateTime: `PT${elapsedSeconds}S`,
				text: `${String(totalMinutes)}m ${pad(elapsedSeconds % 60)}s`
			};
		}

		const representedSeconds = totalMinutes * 60;
		return {
			dateTime: `PT${representedSeconds}S`,
			text: `${String(Math.floor(totalMinutes / 60))}h ${pad(totalMinutes % 60)}m`
		};
	}

	function getMillisecondsUntilNextChange(
		now: number,
		startTime: number,
		elapsedMilliseconds: number,
		format: TimerFormat
	): number {
		if (now < startTime) {
			return Math.min(startTime - now + ONE_SECOND_MS, MAX_TIMEOUT_MS);
		}

		const precision =
			format === 'elapsed' && elapsedMilliseconds >= ONE_HOUR_SECONDS * ONE_SECOND_MS
				? ONE_MINUTE_MS
				: ONE_SECOND_MS;
		return precision - (elapsedMilliseconds % precision);
	}

	/**
	 * Displays a standardized elapsed duration without re-rendering on every tick.
	 *
	 * Timer writes changing text and its ISO 8601 duration directly to the owned
	 * `<time>` node. Use `elapsed` for compact duration text or `clock` for a
	 * stopwatch-like reading.
	 *
	 * @example
	 * ```svelte
	 * <Timer />
	 * <Timer format="clock" />
	 * ```
	 */
	let {
		startTime,
		format = 'elapsed',
		type = 'supporting',
		size,
		color = 'secondary',
		weight,
		ref = $bindable(null),
		xstyle,
		class: className,
		style: styleProp,
		...rest
	}: TimerProps = $props();

	const mountTime = Date.now();
	const resolvedFormat = $derived(resolveFormat(format));
	const initialPresentation = $derived(getPresentation(0, resolvedFormat));
	const timeAttrs = timerTimeAttrs();
	const theme = themeProps('timer');

	let timeElement: HTMLTimeElement | null = $state(null);

	$effect(() => {
		ref = timeElement;
	});

	$effect(() => {
		const resolvedStartTime =
			startTime !== undefined && Number.isFinite(startTime) ? startTime : mountTime;
		const timerFormat = resolvedFormat;
		let timeoutID: ReturnType<typeof setTimeout> | undefined;
		let previousDateTime: string | undefined;
		let previousText: string | undefined;

		const tick = () => {
			const now = Date.now();
			const elapsedMilliseconds = getElapsedMilliseconds(now, resolvedStartTime);
			const presentation = getPresentation(elapsedMilliseconds, timerFormat);
			const node = timeElement;

			if (node != null) {
				if (presentation.text !== previousText) {
					node.textContent = presentation.text;
					previousText = presentation.text;
				}
				if (presentation.dateTime !== previousDateTime) {
					node.dateTime = presentation.dateTime;
					previousDateTime = presentation.dateTime;
				}
			}

			timeoutID = setTimeout(
				tick,
				getMillisecondsUntilNextChange(now, resolvedStartTime, elapsedMilliseconds, timerFormat)
			);
		};

		tick();
		return () => {
			if (timeoutID !== undefined) {
				clearTimeout(timeoutID);
			}
		};
	});
</script>

<Text
	{type}
	{size}
	{color}
	{weight}
	{xstyle}
	{...theme}
	class={cx(theme.class, className)}
	style={styleProp as string | undefined}
>
	<time
		{...rest}
		bind:this={timeElement}
		datetime="PT0S"
		class={timeAttrs.class}
		style={timeAttrs.style}
	>
		{initialPresentation.text}
	</time>
</Text>
