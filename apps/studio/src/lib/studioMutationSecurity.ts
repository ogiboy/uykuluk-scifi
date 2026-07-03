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
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }
  return origin === requestOrigin;
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
