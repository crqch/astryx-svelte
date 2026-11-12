import { isShadowRoot } from './node-type.js';

/**
 * Ported from Astryx's `utils/flatTree.ts`.
 *
 * The flat-tree parent the browser scrolls and dispatches through. The input
 * hold, outside-press watch and gesture system share it.
 */

/** The node's parent, crossing out of shadow roots. */
export function parentAcrossShadow(node: Node): Node | null {
	const slot = (node as Partial<Slottable>).assignedSlot;
	if (slot != null) return slot;
	if (node.parentNode != null) {
		return isShadowRoot(node.parentNode) ? node.parentNode.host : node.parentNode;
	}
	return null;
}

/** Whether `node` is `ancestor` or below it along the flat tree. */
export function containsAlongFlatTree(ancestor: Node, node: Node): boolean {
	for (let at: Node | null = node; at != null; at = parentAcrossShadow(at)) {
		if (at === ancestor) return true;
	}
	return false;
}

/** The focused element of `doc`, inside open shadow roots too. */
export function deepActiveElement(doc: Document | null | undefined): Element | null {
	let active = doc?.activeElement ?? null;
	while (active?.shadowRoot?.activeElement != null) {
		active = active.shadowRoot.activeElement;
	}
	return active;
}

/** The host of a shadow root, open or closed and from any window. */
export function shadowHostOf(node: Node): Element | null {
	return isShadowRoot(node) ? node.host : null;
}

/** The shadow roots from `node` out to its document, innermost first. */
export function shadowRootsOutward(
	node: Node
): { readonly root: ShadowRoot; readonly host: Element }[] {
	const roots: { readonly root: ShadowRoot; readonly host: Element }[] = [];
	for (
		let at: Node = node, host = shadowHostOf(at);
		host != null;
		at = host.getRootNode(), host = shadowHostOf(at)
	) {
		roots.push({ root: at as ShadowRoot, host });
	}
	return roots;
}
