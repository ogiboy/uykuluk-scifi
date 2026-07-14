const maximumVisualBytes = 25 * 1024 * 1024;

/** Checks browser-visible file constraints before encoding a visual import. */
export function visualFileProblem(file: File): string | null {
  if (![/\.png$/i, /\.jpe?g$/i].some((pattern) => pattern.test(file.name))) {
    return "Choose a PNG or JPEG image.";
  }
  if (file.size > maximumVisualBytes) return "Visual imports must not exceed 25 MiB.";
  return null;
}
