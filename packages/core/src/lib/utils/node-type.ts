/**
 * Ported from Astryx's `utils/nodeType.ts`.
 *
 * Type guards that hold for a node from any window. Each reads the node type or
 * namespace, not `instanceof`: a node from another realm fails an `instanceof`
 * against this window's classes.
 */

/** Whether `value` is a DOM node, from this window or another one. */
export function isNode(value: unknown): value is Node {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { nodeType?: unknown }).nodeType === 'number'
	);
}

/** Whether `value` is an element, from this window or another one. */
export function isElement(value: unknown): value is Element {
	return isNode(value) && value.nodeType === 1;
}

/** Whether `value` is a document, from this window or another one. */
export function isDocument(value: unknown): value is Document {
	return isNode(value) && value.nodeType === 9;
}

/** Whether `value` is a shadow root, from this window or another one. */
export function isShadowRoot(value: unknown): value is ShadowRoot {
	return isNode(value) && value.nodeType === 11 && 'host' in value;
}

/** Whether `value` is an HTML element, from this window or another one. */
export function isHTMLElement(value: unknown): value is HTMLElement {
	return isElement(value) && value.namespaceURI === 'http://www.w3.org/1999/xhtml';
}
