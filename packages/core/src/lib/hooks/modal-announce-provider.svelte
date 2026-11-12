<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export interface ModalAnnounceProviderProps {
		/** The owner's dialog element, read at call time. */
		dialogRef: () => HTMLDialogElement | null;
		/**
		 * The owner's intent for this render: open as a modal, or presented as a
		 * modal step. A non-modal surface, such as a scrimless Drawer or sheet,
		 * passes `false`. Callers inside it route as the page does.
		 */
		isOpen: boolean;
		/**
		 * Whether this scope's own content is in the accessibility tree while the
		 * shared dialog is. Upstream's switcher steps each own a dialog that goes
		 * inert for an exit; this port's shared switcher dialog stays exposed, so a
		 * step passes its own phase here. Omitted for a dialog that owns its
		 * exposure directly, which is every host but the switcher item.
		 */
		isScopeExposed?: () => boolean;
		children?: Snippet;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import {
		forgetPresented,
		handOffUnexposed,
		isExposed,
		notePresented,
		releaseAllHeld,
		releaseHeldBeyond
	} from './modal-announce.js';
	import {
		setModalAnnounceScope,
		useModalAnnounceScope,
		type ModalAnnounceScope
	} from './use-announce.js';
	import { observeMutations } from '../internal/shared-mutation-observer.js';

	/**
	 * Ported from Astryx's `hooks/ModalAnnounceProvider.tsx` (0.7.13).
	 *
	 * Rendered by every Astryx component that owns a native `<dialog>` (Dialog,
	 * BottomSheet, Drawer, Lightbox, MobileNav; CommandPalette through Dialog),
	 * around the dialog's content, so `useAnnounce` beneath it routes into that
	 * dialog while it is open as a modal. The provider watches the dialog's
	 * `open`, `inert` and `aria-hidden` attributes: when the dialog stops being
	 * exposed, any message its containers hold that assistive technology has not
	 * had yet is handed to the channel exposed then — the modal on top, or the
	 * shared channel — and the same happens when the provider unmounts with the
	 * dialog still open. A dialog closed and shown again in one task is exposed
	 * again by the time the change is seen, so its words stay (a hand-over, not a
	 * close).
	 *
	 * Renders no DOM element — a context boundary and a watcher only, which is
	 * why it takes no `xstyle`/`ref` and why its markup is the children alone.
	 * Internal: imported by path inside the package; not exported from the hooks
	 * barrel or the package entry.
	 */
	const { dialogRef, isOpen, isScopeExposed, children }: ModalAnnounceProviderProps = $props();

	const parent = useModalAnnounceScope();
	const scope: ModalAnnounceScope = {
		// Read at call time through the same getter for the life of the provider.
		// svelte-ignore state_referenced_locally
		dialogRef,
		// Read at call time, as upstream reads `scope.isOpen` in every route call:
		// the scope keeps its identity across opens and closes.
		get isOpen() {
			return isOpen;
		},
		parent,
		// A function prop; its body reads the current value.
		// svelte-ignore state_referenced_locally
		isScopeExposed
	};
	setModalAnnounceScope(scope);

	interface Session {
		dialog: HTMLDialogElement;
		stop: () => void;
		wasOpen: boolean;
		wasScopeExposed: boolean;
		closePending: boolean;
	}
	let session: Session | null = null;

	function endSession(): void {
		if (session == null) {
			return;
		}
		const current = session;
		session = null;
		current.stop();
		forgetPresented(current.dialog);
	}

	function startSession(dialog: HTMLDialogElement, scopeExposed: boolean): void {
		notePresented(dialog);
		const current: Session = {
			dialog,
			stop: () => {},
			wasOpen: dialog.open,
			wasScopeExposed: scopeExposed,
			closePending: false
		};
		const onPresentationChange = () => {
			// The order is the top-layer order: only `open` being set moves a dialog
			// up it. A dialog turning inert or aria-hidden for its exit keeps its
			// place, so the step the person went back to stays on top.
			if (dialog.open !== current.wasOpen) {
				current.wasOpen = dialog.open;
				notePresented(dialog);
			}
			if (!dialog.open) {
				// A Svelte effect that re-presents the next step runs on the flush
				// microtask, where React's layout effect runs before the observer
				// sees the close. Check once more after that turn, so a dialog that is
				// open again by then keeps its waiting words — a hand-over, not a
				// close.
				if (current.closePending) {
					return;
				}
				current.closePending = true;
				queueMicrotask(() => {
					current.closePending = false;
					if (session !== current) {
						return;
					}
					if (dialog.open) {
						if (isExposed(dialog)) {
							releaseAllHeld();
						}
						return;
					}
					handOffUnexposed(dialog);
					releaseAllHeld();
					endSession();
				});
				return;
			}
			const exposed = isExposed(dialog);
			if (!exposed) {
				handOffUnexposed(dialog);
			}
			// Exposed again after an exit that was called off: whatever waited for
			// this moment — held by this dialog, or by one this dialog was covering
			// — goes out.
			if (exposed) {
				releaseAllHeld();
			}
		};
		// Core's shared observer watches every open modal's presentation: one
		// observer for all of them, not one per open modal.
		current.stop = observeMutations(
			dialog,
			{ attributes: true, attributeFilter: ['open', 'inert', 'aria-hidden'] },
			onPresentationChange
		);
		session = current;
	}

	// The presentation watch is a session. It starts when the owner intends the
	// dialog open, or finds it open. It follows `open`, `inert` and `aria-hidden`
	// through the exit, and it ends when the dialog really closes or the provider
	// unmounts. A closed dialog at rest holds no observer.
	$effect(() => {
		const dialog = dialogRef();
		const open = isOpen;
		const scopeExposed = isScopeExposed?.() ?? true;
		if (dialog == null) {
			return;
		}
		if (session != null && session.dialog !== dialog) {
			const previous = session;
			session = null;
			previous.stop();
			handOffUnexposed(previous.dialog);
			forgetPresented(previous.dialog);
			releaseHeldBeyond(previous.dialog);
			releaseAllHeld();
		}
		if (session == null) {
			if (!open && !dialog.open) {
				return;
			}
			startSession(dialog, scopeExposed);
			return;
		}
		// A shared switcher dialog stays exposed while a step is not; the step's
		// own exposure is what moves the words on or releases them.
		if (session.wasScopeExposed !== scopeExposed) {
			session.wasScopeExposed = scopeExposed;
			if (!scopeExposed) {
				handOffUnexposed(dialog);
			} else {
				releaseAllHeld();
			}
		}
	});

	// Releases the presentation watch and the held announcements on unmount.
	$effect(() => () => {
		untrack(() => {
			const current = session;
			if (current == null) {
				return;
			}
			session = null;
			current.stop();
			// Unmounted while open: no close event, no attribute change — the words
			// would otherwise stay in a detached container. Handed off before this
			// dialog leaves the order, so the next channel is found from where it
			// stood.
			forgetPresented(current.dialog);
			handOffUnexposed(current.dialog, true);
			releaseHeldBeyond(current.dialog);
			releaseAllHeld();
		});
	});
</script>

{@render children?.()}
