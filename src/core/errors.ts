export class SafeExitError extends Error {
  constructor(
    message: string,
    public readonly code = 1,
  ) {
    super(message);
    this.name = "SafeExitError";
  }
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new SafeExitError(message);
  }
}
