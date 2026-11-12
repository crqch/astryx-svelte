/**
 * Picker-surface vocabulary, ported from Astryx's
 * `utils/inputPresentation.ts` (AST-043).
 *
 * This port publishes `presentation` on `DateInput` and `DateTimeInput`;
 * `TimeInput` still selects a surface from the pointer alone. The policy
 * functions are shared so those components adopt the same vocabulary without
 * re-deriving it.
 */

/** Picker-surface policy for date/time inputs. */
export type InputPresentation =
	| 'text-input'
	| 'popover'
	| 'bottom-sheet'
	| 'native'
	| 'adaptive-bottom-sheet'
	| 'adaptive-native';

/** `presentation` for components without a text-only surface. */
export type PickerPresentation = Exclude<InputPresentation, 'text-input'>;

/** The surface a resolved `InputPresentation` actually renders. */
export type InputPresentationSurface = 'text-input' | 'desktop' | 'sheet' | 'native';

/** The surface a resolved `PickerPresentation` renders. */
export type PickerPresentationSurface = Exclude<InputPresentationSurface, 'text-input'>;

/** Deprecated picker policy. */
export type LegacyNativePicker = 'touch' | 'always' | 'never';

/**
 * Typed as the narrower policy because the default opens a picker for every
 * component; it is still a valid `InputPresentation`.
 */
export const DEFAULT_INPUT_PRESENTATION: PickerPresentation = 'adaptive-native';

/**
 * Map a deprecated `nativePicker` value to its `presentation` equivalent.
 * A DateInput's released `never` was Astryx's own pickers on every pointer, so
 * no value maps to `text-input`.
 */
export function pickerPresentationFromNativePicker(
	nativePicker: LegacyNativePicker
): PickerPresentation {
	switch (nativePicker) {
		case 'touch':
			return 'adaptive-native';
		case 'always':
			return 'native';
		case 'never':
			return 'adaptive-bottom-sheet';
	}
}

/**
 * The effective picker-only policy: explicit `presentation` wins over the
 * deprecated prop.
 */
export function effectivePickerPresentation(
	presentation: PickerPresentation | undefined,
	nativePicker: LegacyNativePicker | undefined
): PickerPresentation {
	if (presentation !== undefined) {
		return presentation;
	}
	if (nativePicker !== undefined) {
		return pickerPresentationFromNativePicker(nativePicker);
	}
	return DEFAULT_INPUT_PRESENTATION;
}

/**
 * The policy a date picker follows in its calendar. `<input type="date">` is
 * Gregorian, so in a calendar it cannot show, the policies that use it
 * (`native` and `adaptive-native`) use the Astryx popover on a fine pointer
 * and the bottom sheet on a coarse one instead.
 */
export function calendarPickerPresentation(
	presentation: PickerPresentation,
	isNativeCalendar: boolean
): PickerPresentation {
	if (!isNativeCalendar && (presentation === 'native' || presentation === 'adaptive-native')) {
		return 'adaptive-bottom-sheet';
	}
	return presentation;
}

/** Resolve a picker-only policy to the surface rendered on this pointer. */
export function resolvePickerPresentation(
	presentation: PickerPresentation,
	isCoarsePointer: boolean
): PickerPresentationSurface {
	switch (presentation) {
		case 'popover':
			return 'desktop';
		case 'bottom-sheet':
			return 'sheet';
		case 'native':
			return 'native';
		case 'adaptive-bottom-sheet':
			return isCoarsePointer ? 'sheet' : 'desktop';
		case 'adaptive-native':
			return isCoarsePointer ? 'native' : 'desktop';
	}
}
