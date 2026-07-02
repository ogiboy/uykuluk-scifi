import { afterEach, describe, expect, it, vi } from "vitest";
import { studioMutationJsonHeaders } from "../apps/studio/src/lib/studioMutationClient";
import {
  studioActionHeaderName,
  studioSessionCookieName,
  studioSessionHeaderName,
} from "../apps/studio/src/lib/studioMutationSecurity";
import {
  createStudioMutationSession,
  studioSessionMaxAgeSeconds,
} from "../apps/studio/src/lib/studioMutationSession";

describe("Studio local mutation sessions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an HttpOnly same-site session cookie with a bearer header token", () => {
    const session = createStudioMutationSession();

    expect(session.maxAgeSeconds).toBe(studioSessionMaxAgeSeconds);
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(session.cookie).toContain(
      `${studioSessionCookieName}=${encodeURIComponent(session.token)}`,
    );
    expect(session.cookie).toContain("Path=/actions");
    expect(session.cookie).toContain(`Max-Age=${studioSessionMaxAgeSeconds}`);
    expect(session.cookie).toContain("HttpOnly");
    expect(session.cookie).toContain("SameSite=Strict");
  });

  it("fetches a no-store Studio session token before building mutation headers", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ status: "ok", token: "session_token_1234567890ABCDEFGH" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const headers = await studioMutationJsonHeaders("render.decide");

    expect(fetchMock).toHaveBeenCalledWith("/actions/session", {
      cache: "no-store",
      method: "GET",
    });
    expect(headers).toEqual({
      [studioActionHeaderName]: "render.decide",
      [studioSessionHeaderName]: "session_token_1234567890ABCDEFGH",
      "content-type": "application/json",
    });
  });

  it("fails closed when the Studio session endpoint cannot provide a token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ status: "error" }, { status: 500 })),
    );

    await expect(studioMutationJsonHeaders("idea.approve")).rejects.toThrow(
      "Studio local session could not be established.",
    );
  });

  it("fails closed when the Studio session payload is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ status: "ok", token: "" })),
    );

    await expect(studioMutationJsonHeaders("script.approve")).rejects.toThrow(
      "Studio local session could not be established.",
    );
  });
});
