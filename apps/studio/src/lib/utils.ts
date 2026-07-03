import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Applies a shadcn/Radix select value to typed state, ignoring values outside the allowed set.
 *
 * @param value - The raw string value emitted by the select control.
 * @param allowedValues - The allowed enum values for the target state.
 * @param setValue - Setter used to update the current selection.
 */
export function applyEnumSelectValue<T extends string>(
  value: string,
  allowedValues: readonly T[],
  setValue: (value: T) => void,
): void {
  if (allowedValues.includes(value as T)) {
    setValue(value as T);
  }
}
