/** Ported from Astryx's `privateAttributes/segmentTitle.stylex.ts`. */
const SEGMENT_TITLE = 'data-astryx-segment-title';

/** Spread on a segment's title: marks it for the touch layer. */
export const segmentTitleProps: Readonly<Record<string, string>> = {
	[SEGMENT_TITLE]: ''
};

/** The title inside `segment`, or null when the label is hidden. */
export function titleOfSegment(segment: Element): HTMLElement | null {
	return segment.querySelector<HTMLElement>(`[${SEGMENT_TITLE}]`);
}
