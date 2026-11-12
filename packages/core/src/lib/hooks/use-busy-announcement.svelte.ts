/**
 * Ported from Astryx's `hooks/useBusyAnnouncement.ts` (0.7.13).
 *
 * Announces each busy start once, through the shared polite channel or a
 * persistent region inside the open modal dialog holding the control.
 *
 * A control that shows a decorative busy Spinner announces its busy state once
 * per busy start. A re-render does not repeat it, and the settle re-arms it. An
 * owner calls the returned function when it announces the outcome; a busy start
 * that is not yet announced is then dropped, so it never follows its own
 * outcome. While a native modal is open the page-body channel is not exposed,
 * so a control in a modal announces through that dialog's polite region — also
 * in a modal an app renders without Astryx.
 *
 * Reactive inputs are getters, per this port's hook convention; the message is
 * read once when the effect runs, exactly as upstream's dependency list reads
 * it.
 *
 * Internal: a shared detail of the busy controls, not exported from the hooks
 * barrel, as upstream.
 */

import {
	announceInModal,
	enclosingModalDialog,
	takeJoinedAnnouncement,
	useAnnounce,
	withdrawPendingAnnouncement,
	type WithdrawAnnouncement
} from './use-announce.js';

export function useBusyAnnouncement(
	isBusy: () => boolean,
	message: () => string,
	elementRef: () => Element | null | undefined
): () => void {
	const announce = useAnnounce();
	let hasAnnounced = false;
	let frame: number | null = null;
	// This busy start's share of the shared channel's pending text, until it
	// settles.
	let channelMessage: object | null = null;
	// Or how to take back its write inside a modal, wherever the modal moves it,
	// until it settles.
	let modalMessage: WithdrawAnnouncement | null = null;

	// Syncs the live region with the busy state. When it becomes true, the busy
	// message is announced one frame later.
	$effect(() => {
		const busy = isBusy();
		const text = message();
		if (!busy) {
			hasAnnounced = false;
			channelMessage = null;
			modalMessage = null;
			return;
		}
		if (hasAnnounced) {
			return;
		}
		// Choose the route a frame later: a Dialog opening in the same commit
		// calls showModal() in its own effect, which runs after this one.
		const scheduled = requestAnimationFrame(() => {
			frame = null;
			hasAnnounced = true;
			// The nearest open native modal around the control's element, Astryx or
			// app-rendered. Else the shared `useAnnounce` route, which follows the
			// nearest Astryx modal around this hook's caller.
			const dialog = enclosingModalDialog(elementRef());
			if (dialog != null) {
				modalMessage = announceInModal(dialog, text);
			} else {
				announce(text, 'polite');
				channelMessage = takeJoinedAnnouncement();
			}
		});
		frame = scheduled;
		return () => {
			cancelAnimationFrame(scheduled);
			frame = null;
		};
	});

	return () => {
		if (frame != null) {
			cancelAnimationFrame(frame);
			frame = null;
			// Still busy until the settled state commits; do not schedule again.
			hasAnnounced = true;
		}
		// Written to the channel, or inside the modal, but not yet exposed:
		// withdraw it too.
		if (channelMessage != null) {
			withdrawPendingAnnouncement(channelMessage, 'polite');
			channelMessage = null;
		}
		if (modalMessage != null) {
			const withdraw = modalMessage;
			modalMessage = null;
			withdraw();
		}
	};
}
