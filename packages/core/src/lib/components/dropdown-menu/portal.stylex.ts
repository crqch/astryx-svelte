import * as stylex from '@stylexjs/stylex';
import type { Attachment } from 'svelte/attachments';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';

/**
 * The two DOM movements this port uses in place of React's `createPortal`,
 * which Svelte does not have.
 *
 * Svelte tears an `{#if}` block down by clearing the range between its anchors
 * in the block's original parent; a node moved out of that range is never
 * reached, so every move has to remove the node in its own cleanup. Removing an
 * already-removed node is idempotent.
 */
const styles = stylex.create({
	host: {
		display: 'contents'
	}
});

/** A box-less wrapper's attrs. */
export function portalHostAttrs(): SvelteStyleAttrs {
	return sx(styles.host);
}

/**
 * An attachment that moves its element into `target` while mounted. Use this
 * when the moved node must be a DIRECT child of the target (a CSS sibling rule
 * reads it), which a wrapper would break.
 */
export function portalTo(target: () => HTMLElement | null): Attachment<HTMLElement> {
	return (node) => {
		const destination = target();
		if (destination == null) {
			return;
		}
		destination.appendChild(node);
		return () => {
			node.remove();
		};
	};
}
