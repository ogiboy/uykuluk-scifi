/**
 * Quotes a shell argument for operator-facing copy-paste commands.
 *
 * @param value - The raw argument value.
 * @returns A shell-safe argument string.
 */
const POSIX_SINGLE_QUOTE_ESCAPE = "'\"'\"'";

export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", POSIX_SINGLE_QUOTE_ESCAPE)}'`;
}

/**
 * Renders a shell command from a binary and already-tokenized arguments.
 *
 * @param binary - Command binary or path.
 * @param args - Command arguments.
 * @returns A shell-escaped command line for operator review.
 */
export function shellCommand(binary: string, args: string[]): string {
  return [binary, ...args].map(shellQuote).join(" ");
}
