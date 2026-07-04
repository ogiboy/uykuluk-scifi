export const studioActionHeaderName = "x-uykuluk-studio-action";
export const studioSessionCookieName = "uykuluk_studio_session";
export const studioSessionHeaderName = "x-uykuluk-studio-session";

export type StudioMutationSecurityResult =
  | {
      ok: true;
    }
  | {
      message: string;
      ok: false;
      status: 400 | 401 | 403 | 415;
    };

/**
 * Validates the common browser-to-Studio mutation boundary.
 *
 * @param request - The incoming Studio mutation request.
 * @param actionId - The expected mutation action identifier.
 * @returns A success result, or the rejection status and safe operator-facing message.
 */
export function validateStudioMutationRequest(
  request: Request,
  actionId: string,
): StudioMutationSecurityResult {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return {
      message: "Studio mutations require application/json requests.",
      ok: false,
      status: 415,
    };
  }
  if (request.headers.get(studioActionHeaderName) !== actionId) {
    return {
      message: "Studio mutation action header is missing or invalid.",
      ok: false,
      status: 403,
    };
  }
  if (!isSameOriginMutation(request)) {
    return {
      message: "Studio mutations require a same-origin request.",
      ok: false,
      status: 403,
    };
  }
  if (!hasValidStudioSession(request)) {
    return {
      message:
        "Studio mutations require a valid local session token. Refresh the local web control session before retrying.",
      ok: false,
      status: 401,
    };
  }
  return { ok: true };
}

function isSameOriginMutation(request: Request): boolean {
  const origin = parseOrigin(request.headers.get("origin"));
  if (!origin) {
    return false;
  }
  return requestOriginCandidates(request).some((candidate) => originsMatch(origin, candidate));
}

function hasValidStudioSession(request: Request): boolean {
  const headerToken = request.headers.get(studioSessionHeaderName);
  if (!headerToken || !isStudioSessionToken(headerToken)) {
    return false;
  }
  return cookieValue(request.headers.get("cookie") ?? "", studioSessionCookieName) === headerToken;
}

function cookieValue(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return null;
}

function isStudioSessionToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

function requestOriginCandidates(request: Request): URL[] {
  return uniqueOrigins([
    parseOrigin(request.url),
    hostHeaderOrigin(request),
    forwardedHeaderOrigin(request),
  ]);
}

function forwardedHeaderOrigin(request: Request): URL | null {
  const host = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const protocol = forwardedProtocol(request);
  return host && protocol ? parseOrigin(`${protocol}://${host}`) : null;
}

function hostHeaderOrigin(request: Request): URL | null {
  const host = request.headers.get("host");
  const protocol = forwardedProtocol(request) ?? parseOrigin(request.url)?.protocol.slice(0, -1);
  return host && protocol ? parseOrigin(`${protocol}://${host}`) : null;
}

function forwardedProtocol(request: Request): "http" | "https" | null {
  const value = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  return value === "http" || value === "https" ? value : null;
}

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",").at(0)?.trim() || null;
}

function parseOrigin(value: string | null | undefined): URL | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(new URL(value).origin);
  } catch {
    return null;
  }
}

function originsMatch(left: URL, right: URL): boolean {
  if (left.origin === right.origin) {
    return true;
  }
  return (
    left.protocol === right.protocol &&
    normalizedPort(left) === normalizedPort(right) &&
    isLoopbackLikeHost(left.hostname) &&
    isLoopbackLikeHost(right.hostname)
  );
}

function normalizedPort(url: URL): string {
  if (url.port) {
    return url.port;
  }
  return url.protocol === "https:" ? "443" : "80";
}

function isLoopbackLikeHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]"
  );
}

function uniqueOrigins(origins: Array<URL | null>): URL[] {
  const seen = new Set<string>();
  return origins.filter((origin): origin is URL => {
    if (!origin || seen.has(origin.origin)) {
      return false;
    }
    seen.add(origin.origin);
    return true;
  });
}
