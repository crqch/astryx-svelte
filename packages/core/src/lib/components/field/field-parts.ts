/**
 * @file field-parts.ts
 * @input FormLayout and InputGroup context, the development warning hook
 * @output FieldContainerStyleProps, FieldControlStyleProps, FieldPartStyleProps,
 *   FieldInputBaseProps, FieldInputStyling and useFieldInputStyling
 * @position Shared styling contract for every Field-composed input. Base props
 *   reach the primary semantic control; there is no root xstyle/class/style,
 *   container* styles the Field box where one renders, and control* styles the
 *   visual control box.
 *
 * Ported from Astryx's `Field/fieldParts.ts`.
 */

import type { BaseProps } from '../../base-props.js';
import type { StyleArg } from '../../internal/sx.js';
import { useDevWarning } from '../../hooks/use-dev-warning.svelte.js';
import { useFormLayout } from '../form-layout/form-layout-context.svelte.js';
import { useInputGroup } from '../input-group/input-group-context.svelte.js';

/**
 * Root styling props a Field-composed input does not accept.
 *
 * Upstream's list names React's `className`; Svelte's base type spells the same
 * prop `class`, so that is the member this port removes.
 */
export type FieldInputForbiddenStyleProp = 'xstyle' | 'class' | 'style';

/** Styling for the Field box (label, control and status together). */
export interface FieldContainerStyleProps {
	/**
	 * StyleX styles for the field container (the Field box around the label,
	 * control and status). Has no effect where no Field box renders: inside an
	 * InputGroup (style the InputGroup instead) and in a `horizontal-labels`
	 * FormLayout.
	 */
	containerXstyle?: StyleArg;
	/** Class name for the field container. Same targeting as `containerXstyle`. */
	containerClassName?: string;
	/** Inline styles for the field container. Same targeting as `containerXstyle`. */
	containerStyle?: string;
}

/** Styling for the visual control box (border, background, icons, end controls). */
export interface FieldControlStyleProps {
	/**
	 * StyleX styles for the visual control box: the element that paints the
	 * field border and background and holds its icons and end controls. Never
	 * the native input.
	 */
	controlXstyle?: StyleArg;
	/** Class name for the visual control box. */
	controlClassName?: string;
	/** Inline styles for the visual control box. */
	controlStyle?: string;
}

export interface FieldPartStyleProps extends FieldContainerStyleProps, FieldControlStyleProps {}

/**
 * BaseProps for a Field-composed input. Root `xstyle`, `class` and `style` are
 * omitted, so passing one is a type error; style the field through `container*`
 * and the control box through `control*`.
 */
export type FieldInputBaseProps<T extends EventTarget = HTMLElement> = Omit<
	BaseProps<T>,
	FieldInputForbiddenStyleProp
> &
	FieldPartStyleProps;

/** Styling props to pass to Field's own `xstyle`/`class`/`style`. */
export interface FieldContainerTarget {
	xstyle?: StyleArg;
	className?: string;
	style?: string;
}

export interface FieldInputStyling<R> {
	/** The caller's remaining props, with any untyped root styling removed. */
	rest: () => R;
	/**
	 * Whether a Field box renders: false inside an InputGroup and in a
	 * `horizontal-labels` FormLayout, where Field lays out its children in the
	 * form's columns without a box of its own.
	 */
	hasFieldBox: () => boolean;
	/** Spread onto `<Field>`; empty where no Field box renders. */
	container: () => FieldContainerTarget;
}

const ROOT_STYLING_MESSAGE =
	'`xstyle`, `class` and `style` are not supported on Field-composed inputs and were ignored. ' +
	'Style the field with `containerXstyle`/`containerClassName`/`containerStyle` and the control box with ' +
	'`controlXstyle`/`controlClassName`/`controlStyle`. `astryx upgrade` rewrites existing usage.';

const CONTAINER_WITHOUT_FIELD_MESSAGE =
	'`containerXstyle`/`containerClassName`/`containerStyle` have no effect here because no Field box renders ' +
	'(inside InputGroup or a `horizontal-labels` FormLayout). Inside InputGroup, style the InputGroup.';

/**
 * Resolve the Field-composed styling contract for an input.
 *
 * Strips root `xstyle`/`class`/`style` that an untyped caller passed (they would
 * otherwise spread onto the native control) and warns once in development.
 * Returns the `container*` props to forward to Field only when a Field box
 * renders, and warns once when they are passed where none does. `control*`
 * props are the caller's to apply to the control box directly.
 *
 * The values are getters rather than snapshots because Svelte props are
 * reactive: a FormLayout can change direction after mount, and an untyped
 * caller can add root styling later. The calling component reads them inside
 * `$derived`, which is the same point upstream re-runs its hook.
 */
export function useFieldInputStyling<R extends object>(
	component: string,
	restProps: R,
	containerProps: FieldContainerStyleProps
): FieldInputStyling<R> {
	const inputGroup = useInputGroup();
	const formLayout = useFormLayout();
	const hasFieldBox = () => inputGroup == null && formLayout().direction !== 'horizontal-labels';

	const untyped = restProps as R & {
		xstyle?: unknown;
		class?: unknown;
		style?: unknown;
	};
	const hasRootStyling = () =>
		untyped.xstyle != null || untyped.class != null || untyped.style != null;

	useDevWarning(component, ROOT_STYLING_MESSAGE, hasRootStyling);

	const { containerXstyle, containerClassName, containerStyle } = containerProps;
	const hasContainerStyling = () =>
		containerXstyle != null || containerClassName != null || containerStyle != null;
	useDevWarning(
		component,
		CONTAINER_WITHOUT_FIELD_MESSAGE,
		() => hasContainerStyling() && !hasFieldBox()
	);

	return {
		rest: () => {
			if (!hasRootStyling()) {
				return restProps;
			}
			const { xstyle: _xstyle, class: _className, style: _style, ...remaining } = untyped;
			return remaining as R;
		},
		hasFieldBox,
		container: () =>
			hasFieldBox()
				? {
						xstyle: containerXstyle,
						className: containerClassName,
						style: containerStyle
					}
				: {}
	};
}
