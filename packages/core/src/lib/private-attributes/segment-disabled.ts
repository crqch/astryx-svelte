/** Ported from Astryx's `privateAttributes/segmentDisabled.stylex.ts`. */
const SEGMENT_DISABLED = 'data-astryx-segment-disabled';

/** Spread on a segment: marks it when it is disabled by its own `isDisabled`. */
export function segmentDisabledProps(isDisabled: boolean): Readonly<Record<string, string>> {
	return isDisabled ? { [SEGMENT_DISABLED]: '' } : {};
}

/** Whether a segment element is disabled by its own `isDisabled`. */
export function isSegmentDisabledOnItsOwn(segment: Element): boolean {
	return segment.hasAttribute(SEGMENT_DISABLED);
}
