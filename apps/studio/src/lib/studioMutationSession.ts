import { randomBytes } from "node:crypto";
import { studioSessionCookieName } from "./studioMutationSecurity";

export const studioSessionMaxAgeSeconds = 15 * 60;

export type StudioMutationSession = Readonly<{
  cookie: string;
  maxAgeSeconds: number;
  token: string;
}>;

/**
 * Creates a short-lived local Studio mutation session token and cookie.
 *
 * @returns The token returned to the same-origin client plus the HttpOnly cookie header value.
 */
export function createStudioMutationSession(): StudioMutationSession {
  const token = randomBytes(32).toString("base64url");
  return {
    cookie: [
      `${studioSessionCookieName}=${encodeURIComponent(token)}`,
      "Path=/actions",
      `Max-Age=${studioSessionMaxAgeSeconds}`,
      "HttpOnly",
      "SameSite=Strict",
    ].join("; "),
    maxAgeSeconds: studioSessionMaxAgeSeconds,
    token,
  };
}
