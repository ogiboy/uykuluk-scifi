const maximumImageBytes = 25 * 1024 * 1024;
const maximumJsonBytes = 64 * 1024;

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type WaitForPoll = (milliseconds: number, signal: AbortSignal) => Promise<void>;

export async function readBlackForestLabsJsonResponse(response: Response): Promise<unknown> {
  if (normalizedContentType(response.headers.get("content-type")) !== "application/json") {
    throw new Error("Provider response was not JSON.");
  }
  const bytes = await readBoundedBody(response, maximumJsonBytes);
  return JSON.parse(bytes.toString("utf8")) as unknown;
}

export async function readBlackForestLabsImageResponse(input: {
  response: Response;
  outputFormat: "jpeg" | "png";
}): Promise<Buffer> {
  if (
    !input.response.ok ||
    normalizedContentType(input.response.headers.get("content-type")) !==
      expectedImageContentType(input.outputFormat)
  ) {
    throw new Error("Provider image response was invalid.");
  }
  return readBoundedBody(input.response, maximumImageBytes);
}

export function expectedImageContentType(outputFormat: "jpeg" | "png"): "image/jpeg" | "image/png" {
  return outputFormat === "jpeg" ? "image/jpeg" : "image/png";
}

export function isTrustedBflPollingUrl(value: string): boolean {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    (url.hostname === "bfl.ai" || url.hostname.endsWith(".bfl.ai"))
  );
}

export function isSecureProviderResultUrl(value: string): boolean {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}

export async function waitForBlackForestLabsPoll(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function readBoundedBody(response: Response, maximumBytes: number): Promise<Buffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0 || declaredBytes > maximumBytes) {
      throw new Error("Provider response exceeded the byte limit.");
    }
  }
  if (!response.body) {
    throw new Error("Provider response did not contain a body.");
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maximumBytes) {
      throw new Error("Provider response exceeded the byte limit.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, totalBytes);
}

function normalizedContentType(value: string | null): string | undefined {
  return value?.split(";", 1)[0]?.trim().toLowerCase();
}
