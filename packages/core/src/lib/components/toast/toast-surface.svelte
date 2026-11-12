<script lang="ts" module>
	import { INTERACTIVE_SELECTORS } from '../../hooks/use-clickable-container.svelte.js';
	import type { ToastProps } from './toast.svelte';
	import type { ToastGestureDirection } from './use-toast-gesture.js';

	const SWIPE_INTERACTIVE_TARGET_SELECTOR = `${INTERACTIVE_SELECTORS},[tabindex],[contenteditable]:not([contenteditable="false"])`;

	/**
	 * Whether a swipe starting on this target belongs to a control inside the
	 * card rather than to the card. Walks up to the card root (or `<body>`), so a
	 * drag begun on the dismiss button, an action, or any focusable/editable
	 * descendant never turns into a dismissal.
	 */
	function isInteractiveTarget(target: EventTarget | null, root: HTMLElement): boolean {
		if (!(target instanceof Element)) {
			return false;
		}
		let current: Element | null = target;
		while (current != null && current !== root && current !== document.body) {
			if (current.matches(SWIPE_INTERACTIVE_TARGET_SELECTOR)) {
				return true;
			}
			current = current.parentElement;
		}
		return false;
	}

	/**
	 * Deliberately not exported: upstream declares `ToastSurfaceProps` in
	 * `Toast.tsx` without exporting it, and `Toast/index.ts` publishes neither it
	 * nor `ToastSurface`. `gestureDirection` is resolved by `ToastViewport` from
	 * the stack's position, so it stays off the published `ToastProps` — a `Toast`
	 * rendered directly gets upstream's `1`.
	 */
	interface ToastSurfaceProps extends ToastProps {
		gestureDirection: ToastGestureDirection;
		/**
		 * True once the toast's row has started to open. The card then has no
		 * starting style, so a move between modal outlets starts no transition.
		 */
		hasEntryStarted?: boolean;
		/**
		 * Whether the card carries its own live region. The viewport is each
		 * toast's only announcement owner, so it passes false; a standalone
		 * `Toast` keeps upstream's default.
		 */
		isLiveRegion?: boolean;
		/**
		 * A value that changes on an in-place overwrite. The timer effect reads
		 * it so a replacement re-seeds the timer even when the duration did not
		 * change.
		 */
		timerKey?: string;
	}

	/** A condition that holds a toast's auto-hide timer. */
	type PauseSource = 'pointer' | 'focus' | 'gesture' | 'window';
</script>

<script lang="ts">
	import Button from '../button/button.svelte';
	import Icon from '../icon/icon.svelte';
	import MediaTheme from '../../theme/media-theme.svelte';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { cx } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { useThemeMode } from '../../internal/theme-mode.svelte.js';
	import { useToastGesture } from './use-toast-gesture.js';
	import {
		toastRootAttrs,
		toastInnerAttrs,
		toastContentAttrs,
		toastEndContentAttrs
	} from './toast.stylex.js';

	/**
	 * Upstream's `ToastSurface`: the whole toast, plus the one prop `Toast` does
	 * not take. `Toast` is the published wrapper and renders this with
	 * `gestureDirection={1}`; `ToastViewport` renders it directly so a stack
	 * anchored to the top edge swipes upward.
	 */
	const {
		type,
		body,
		endContent,
		isAutoHide,
		autoHideDuration,
		isExiting = false,
		onDismiss,
		renderContent,
		gestureDirection,
		hasEntryStarted = false,
		isLiveRegion = true,
		timerKey
	}: ToastSurfaceProps = $props();

	const t = useTranslator();
	const themeMode = useThemeMode();

	let gestureRoot = $state<HTMLElement | null>(null);

	// Deliberately plain `let`, not `$state`: these are upstream's refs. Nothing
	// renders from them, and making them reactive would feed the timer effect
	// below its own writes.
	let timer: ReturnType<typeof setTimeout> | null = null;
	/**
	 * Every condition that holds the auto-hide timer — pointer over the card,
	 * focus inside it, a touch or pen gesture, the window blurred — is tracked on
	 * its own, so one ending resumes the timer only when no other still holds.
	 */
	const pauseSources = new Set<PauseSource>();
	// Capturing the initial value is the point — this is upstream's
	// `useRef(autoHideDuration)`. The effect below re-seeds it whenever the prop
	// genuinely changes; a live read would defeat `pauseTimer`'s bookkeeping.
	// svelte-ignore state_referenced_locally
	let remaining = autoHideDuration;
	let startTime: number | null = null;

	/**
	 * Upstream reads `onDismiss` through a ref because the viewport re-creates it
	 * on every render, and a `startTimer` depending on it would restart — and
	 * un-pause — this toast's timer whenever another toast arrives or leaves.
	 *
	 * Svelte obviates the ref twice over: a prop read is always current, and the
	 * read below happens inside a `setTimeout` callback, which is asynchronous
	 * and therefore outside the effect's tracking. So the timer effect depends on
	 * `autoHideDuration`, `timerKey` and `isAutoHide`, exactly as upstream's
	 * dependency list does.
	 */
	function startTimer(): void {
		if (!isAutoHide || pauseSources.size > 0) {
			return;
		}
		if (timer) {
			clearTimeout(timer);
		}
		startTime = Date.now();
		timer = setTimeout(() => {
			onDismiss('auto');
		}, remaining);
	}

	function pauseTimer(source: PauseSource): void {
		const wasRunning = pauseSources.size === 0;
		pauseSources.add(source);
		if (!wasRunning) {
			return;
		}
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		if (startTime != null) {
			const elapsed = Date.now() - startTime;
			// Upstream's 1000ms floor: a toast paused with under a second left is
			// *extended* to a second so it cannot vanish the instant focus returns.
			remaining = Math.max(remaining - elapsed, 1000);
		}
	}

	function resumeTimer(source: PauseSource): void {
		if (!pauseSources.delete(source)) {
			return;
		}
		const root = gestureRoot;
		if (pauseSources.has('focus') && root != null && !root.contains(document.activeElement)) {
			pauseSources.delete('focus');
		}
		if (pauseSources.size > 0) {
			return;
		}
		startTimer();
	}

	function pauseForPointer(): void {
		pauseTimer('pointer');
	}
	function resumeForPointer(): void {
		resumeTimer('pointer');
	}
	function pauseForFocus(): void {
		pauseTimer('focus');
	}
	function resumeForFocus(event: FocusEvent): void {
		// Focus moving between controls inside the card keeps it held.
		const next = event.relatedTarget;
		if (next instanceof Node && (event.currentTarget as Node).contains(next)) {
			return;
		}
		resumeTimer('focus');
	}

	$effect(() => {
		remaining = autoHideDuration;
		// Read the key so an in-place overwrite re-seeds the timer even when the
		// duration did not change.
		void timerKey;
		const root = gestureRoot;
		// An update in place can remove the focused control, which fires no blur:
		// a focus hold whose focus has left the card is stale.
		if (pauseSources.has('focus') && root != null && !root.contains(document.activeElement)) {
			pauseSources.delete('focus');
		}
		startTimer();
		return () => {
			if (timer) {
				clearTimeout(timer);
			}
		};
	});

	// Pause the auto-hide timer while the window is not focused, so a toast
	// doesn't silently expire while the user is in another window or tab.
	$effect(() => {
		if (!isAutoHide) {
			return;
		}
		const pauseForWindow = (): void => pauseTimer('window');
		const resumeForWindow = (): void => resumeTimer('window');
		window.addEventListener('blur', pauseForWindow);
		window.addEventListener('focus', resumeForWindow);
		// A toast raised while the window is already blurred gets no blur event,
		// so it starts held, and the window's next focus resumes it.
		if (!document.hasFocus()) {
			pauseForWindow();
		}
		return () => {
			window.removeEventListener('blur', pauseForWindow);
			window.removeEventListener('focus', resumeForWindow);
			// With the listeners gone, no focus event would clear the window hold.
			pauseSources.delete('window');
		};
	});

	function handleDismiss(): void {
		onDismiss('manual');
	}

	/**
	 * Touch/pen swipe dismissal. `gestureRoot` is bound on the card below; the
	 * hook attaches the pan that claims a finger and returns the pointer/touch
	 * bindings, exactly where upstream sets `ref` and spreads `bindings`.
	 */
	const gesture = useToastGesture(
		() => ({
			direction: gestureDirection,
			enabled: !isExiting,
			canPauseTimer: isAutoHide,
			isTimerPaused: () => pauseSources.has('gesture'),
			pauseTimer: () => pauseTimer('gesture'),
			resumeTimer: () => resumeTimer('gesture'),
			dismiss: handleDismiss,
			shouldIgnoreTarget: isInteractiveTarget
		}),
		() => gestureRoot
	);

	const isError = $derived(type === 'error');
	// The surface's media side is **measured**, not assumed — a theme can define
	// `--color-background-inverted` as anything, including a colour whose
	// contrast makes the assumed side unreadable. This is only the value
	// `mode="auto"` falls back to before the measurement lands.
	const fallbackMediaMode = $derived(isError || themeMode.current === 'light' ? 'dark' : 'light');

	const theme = $derived(themeProps('toast', { type }));
	const root = $derived(toastRootAttrs(isError, hasEntryStarted, isExiting));
	const inner = toastInnerAttrs();
	const content = toastContentAttrs();
	const end = toastEndContentAttrs();
</script>

<!--
	Upstream uses `onFocusCapture`/`onBlurCapture` — React's `onFocus`/`onBlur`
	are delegated `focusin`/`focusout`, and the `*Capture` variants are their
	capture phase. Svelte spells that with a `capture` suffix, so the literal
	translation is `onfocusincapture`/`onfocusoutcapture`.

	The phase is load-bearing rather than incidental: on the bubble phase a
	descendant calling `stopPropagation()` on `focusin` would silently strip the
	pause, and an auto-hiding toast would expire under the user's cursor while
	they were tabbing through its own controls.
-->
<div
	bind:this={gestureRoot}
	role={isLiveRegion ? (isError ? 'alert' : 'status') : undefined}
	aria-live={isLiveRegion ? (isError ? 'assertive' : 'polite') : undefined}
	aria-atomic={isLiveRegion ? 'true' : undefined}
	onmouseenter={pauseForPointer}
	onmouseleave={resumeForPointer}
	onfocusincapture={pauseForFocus}
	onfocusoutcapture={resumeForFocus}
	{...gesture}
	{...theme}
	class={cx(theme.class, root.class)}
	style={root.style}
>
	<MediaTheme mode="auto" fallback={fallbackMediaMode}>
		{#if renderContent}
			{@render renderContent({
				body,
				endContent,
				type,
				isAutoHide,
				autoHideDuration,
				dismiss: handleDismiss
			})}
		{:else}
			<div class={inner.class} style={inner.style}>
				<div class={content.class} style={content.style}>
					{#if typeof body === 'function'}
						{@render body()}
					{:else}
						{body}
					{/if}
				</div>

				<div class={end.class} style={end.style}>
					{#if typeof endContent === 'function'}
						{@render endContent()}
					{:else}
						{endContent}
					{/if}
					<Button
						variant="ghost"
						size="sm"
						icon={dismissIcon}
						label={t('@astryx.toast.dismiss')}
						onclick={handleDismiss}
						isIconOnly
					/>
				</div>
			</div>
		{/if}
	</MediaTheme>
</div>

{#snippet dismissIcon()}
	<Icon icon="close" size="sm" color="inherit" />
{/snippet}
