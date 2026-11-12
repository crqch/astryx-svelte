<script lang="ts" module>
	/**
	 * Every inline flow upstream's `ToastViewport.test.tsx` declares: the focus
	 * flows (a toast updated or dismissed by a control inside another toast), the
	 * no-mounted-row dismissals, and the one-handler collision flows.
	 */
	export type ToastFlow =
		| 'offline'
		| 'offline-only'
		| 'upload'
		| 'overwrite'
		| 'overwrite-autohide'
		| 'overwrite-autohide-quiet'
		| 'network'
		| 'overwrite-remove'
		| 'quiet-and-b'
		| 'pausable'
		| 'hidden-twice'
		| 'hidden-slot'
		| 'dismiss-before-render'
		| 'two-ignored'
		| 'repeat-and-dismiss'
		| 'undo'
		| 'push-dismiss'
		| 'replace-dismiss';
</script>

<script lang="ts">
	import ShowToastButton from './show-toast-button.svelte';
	import { useToast } from '$lib/components/toast/use-toast.svelte.js';
	import type {
		ToastContentRenderProps,
		ToastDismissFn,
		ToastDismissReason,
		ToastOptions
	} from '$lib/components/toast/types.js';

	/**
	 * The bespoke flows upstream declares inline in its cases.
	 *
	 * A flow needs to keep the dismiss function a toast returned (to dismiss it
	 * from a control inside a later toast, or in the same handler that raised it),
	 * and a `.test.ts` cannot hold the markup that captures one. This component is
	 * rendered *inside* the viewport so `useToast()` reads the provider context,
	 * exactly as upstream's inline flow components sit inside `<ToastViewport>`.
	 */
	const {
		flow,
		onHide
	}: {
		flow: ToastFlow;
		onHide?: (reason: ToastDismissReason) => void;
	} = $props();

	const toast = useToast();

	// Upstream's refs; nothing renders from them.
	let dismissSaved: ToastDismissFn | null = null;
	let dismissOffline: ToastDismissFn | null = null;
	let dismissA: ToastDismissFn | null = null;
	let dismissFirst: ToastDismissFn | null = null;
	let dismissDeleted: ToastDismissFn | null = null;

	const OFFLINE = 'offline';
	const UPLOAD = 'upload';
	const NETWORK = 'network';

	// --- Focus flows ---------------------------------------------------------

	function showOffline(body: string): void {
		const options: ToastOptions = {
			uniqueID: OFFLINE,
			isAutoHide: false,
			body,
			endContent: retry
		};
		dismissOffline = toast(options);
	}

	function upload(percent: number): ToastOptions {
		return {
			body: `Uploading ${percent}%`,
			uniqueID: UPLOAD,
			collisionBehavior: 'overwrite',
			isAutoHide: false,
			endContent: cancelUpload
		};
	}

	function showTwo(): void {
		toast({ isAutoHide: false, body: 'Alpha' });
		toast({ isAutoHide: false, body: 'Bravo' });
	}

	function showSaved(): void {
		dismissSaved = toast({
			isAutoHide: false,
			body: 'Saved',
			endContent: uploadAction
		});
	}

	function uploadTwo(): void {
		toast({ isAutoHide: false, body: 'Uploading' });
		toast({ isAutoHide: false, body: 'Uploaded' });
		dismissSaved?.();
	}

	function syncStatus(body: string, options: Partial<ToastOptions>): ToastOptions {
		return { body, uniqueID: NETWORK, ...options };
	}

	// --- Dismissals with no mounted row --------------------------------------

	function showA(): void {
		dismissA = toast({ body: 'Toast A', isAutoHide: false, onHide });
	}

	// --- One-handler collisions ----------------------------------------------

	function showRepeat(): void {
		dismissFirst = toast({
			uniqueID: OFFLINE,
			isAutoHide: false,
			body: 'Offline',
			onHide
		});
	}

	function repeatAndDismiss(): void {
		toast({ uniqueID: OFFLINE, isAutoHide: false, body: 'Still offline' });
		dismissFirst?.();
	}

	function showDeleted(): void {
		dismissDeleted = toast({ isAutoHide: false, body: 'Deleted', onHide });
	}

	function undo(): void {
		// An undo shows its confirmation, then dismisses its own toast.
		toast({ isAutoHide: false, body: 'Restored' });
		dismissDeleted?.();
	}

	function showPushedSaved(): void {
		dismissFirst = toast({ isAutoHide: false, body: 'Saved', onHide });
	}
</script>

{#snippet retry()}
	<button
		type="button"
		onclick={() => {
			const dismissPressed = dismissOffline;
			showOffline('Still offline');
			dismissPressed?.();
		}}>Retry</button
	>
{/snippet}

{#snippet uploadAction()}
	<button type="button" onclick={uploadTwo}>Upload</button>
{/snippet}

{#snippet cancelUpload()}
	<button type="button">Cancel upload</button>
{/snippet}

{#snippet quiet({ body }: ToastContentRenderProps)}
	<span data-testid="quiet-content">{body}</span>
{/snippet}

{#snippet undoButton()}
	<button type="button">Undo</button>
{/snippet}

{#if flow === 'offline'}
	<button type="button" onclick={showTwo}>Show two</button>
	<button type="button" onclick={() => showOffline('Offline')}>Show offline</button>
{:else if flow === 'offline-only'}
	<button type="button" onclick={() => showOffline('Offline')}>Show offline</button>
{:else if flow === 'upload'}
	<button type="button" onclick={showSaved}>Save</button>
{:else if flow === 'overwrite'}
	<ShowToastButton options={upload(10)} triggerLabel="Start" />
	<ShowToastButton options={upload(60)} triggerLabel="Progress" />
{:else if flow === 'overwrite-autohide'}
	<ShowToastButton
		triggerLabel="Start"
		options={{
			body: 'Uploading',
			uniqueID: UPLOAD,
			isAutoHide: false,
			endContent: cancelUpload
		}}
	/>
	<ShowToastButton
		triggerLabel="Finish"
		options={{
			body: 'Upload done',
			uniqueID: UPLOAD,
			autoHideDuration: 2000,
			onHide,
			endContent: cancelUpload
		}}
	/>
{:else if flow === 'overwrite-autohide-quiet'}
	<ShowToastButton
		triggerLabel="Start"
		options={{
			body: 'Uploading',
			uniqueID: UPLOAD,
			isAutoHide: false,
			endContent: cancelUpload
		}}
	/>
	<ShowToastButton
		triggerLabel="Finish"
		options={{
			body: 'Uploaded',
			uniqueID: UPLOAD,
			autoHideDuration: 2000,
			onHide,
			renderContent: quiet
		}}
	/>
{:else if flow === 'network'}
	<ShowToastButton
		triggerLabel="Sync"
		options={syncStatus('Syncing', { autoHideDuration: 2000 })}
	/>
	<ShowToastButton triggerLabel="Lose network" options={syncStatus('Offline', { type: 'error' })} />
	<ShowToastButton
		triggerLabel="Reconnect"
		options={syncStatus('Back online', { autoHideDuration: 2000, onHide })}
	/>
{:else if flow === 'overwrite-remove'}
	<ShowToastButton
		triggerLabel="Start"
		options={{
			body: 'Uploading',
			uniqueID: UPLOAD,
			isAutoHide: false,
			endContent: cancelUpload
		}}
	/>
	<ShowToastButton
		triggerLabel="Finish"
		options={{
			body: 'Uploaded',
			uniqueID: UPLOAD,
			isAutoHide: false,
			renderContent: quiet
		}}
	/>
{:else if flow === 'quiet-and-b'}
	<ShowToastButton
		triggerLabel="Trigger quiet"
		options={{
			body: 'Synced',
			isAutoHide: false,
			renderContent: quiet
		}}
	/>
	<ShowToastButton triggerLabel="Trigger B" options={{ body: 'Toast B' }} />
{:else if flow === 'pausable'}
	<ShowToastButton
		triggerLabel="Show held"
		options={{
			body: 'Held',
			autoHideDuration: 3000,
			endContent: undoButton,
			onHide
		}}
	/>
{:else if flow === 'hidden-twice'}
	<button type="button" onclick={showA}>Show A</button>
	<ShowToastButton triggerLabel="Show B" options={{ body: 'Toast B', isAutoHide: false }} />
	<button
		type="button"
		onclick={() => {
			// Both calls land in one batch, before the list renders without A.
			dismissA?.();
			dismissA?.();
		}}>Dismiss A twice</button
	>
{:else if flow === 'hidden-slot'}
	<button type="button" onclick={showA}>Show A</button>
	<ShowToastButton triggerLabel="Show B" options={{ body: 'Toast B', isAutoHide: false }} />
	<ShowToastButton triggerLabel="Show C" options={{ body: 'Toast C', isAutoHide: false }} />
	<button type="button" onclick={() => dismissA?.()}>Dismiss A</button>
{:else if flow === 'dismiss-before-render'}
	<button
		type="button"
		onclick={() => {
			const dismiss = toast({
				body: 'Toast gone',
				isAutoHide: false,
				onHide
			});
			dismiss();
		}}>Show and dismiss</button
	>
{:else if flow === 'two-ignored'}
	<button
		type="button"
		onclick={() => {
			toast({
				uniqueID: OFFLINE,
				collisionBehavior: 'ignore',
				isAutoHide: false,
				body: 'You are offline'
			});
			toast({
				uniqueID: OFFLINE,
				collisionBehavior: 'ignore',
				isAutoHide: false,
				body: 'Still offline'
			});
		}}>Show twice</button
	>
{:else if flow === 'repeat-and-dismiss'}
	<button type="button" onclick={showRepeat}>Show first</button>
	<button type="button" onclick={repeatAndDismiss}>Repeat and dismiss</button>
{:else if flow === 'undo'}
	<button type="button" onclick={showDeleted}>Delete</button>
	<button type="button" onclick={undo}>Undo</button>
{:else if flow === 'push-dismiss'}
	<button type="button" onclick={showPushedSaved}>Show first</button>
	<ShowToastButton triggerLabel="Show second" options={{ isAutoHide: false, body: 'Uploaded' }} />
	<button type="button" onclick={() => dismissFirst?.()}>Dismiss first</button>
{:else}
	<button
		type="button"
		onclick={() => {
			const dismissFirstToast = toast({
				uniqueID: OFFLINE,
				isAutoHide: false,
				body: 'Offline',
				onHide
			});
			toast({ uniqueID: OFFLINE, isAutoHide: false, body: 'Still offline' });
			dismissFirstToast();
			dismissFirstToast();
		}}>Show, replace and dismiss</button
	>
{/if}
