import { describe, expect, it } from "vitest";
import {
  studioActionHeaderName,
  studioSessionCookieName,
  studioSessionHeaderName,
  validateStudioMutationRequest,
} from "../apps/studio/src/lib/mutations/studioMutationSecurity";

const token = "test_session_token_1234567890ABCDEFGH";

describe("Studio mutation security", () => {
  it("accepts exact same-origin guarded JSON requests", () => {
    expect(
      validateStudioMutationRequest(studioRequest("http://localhost:3000"), "ideas.run"),
    ).toEqual({ ok: true });
  });

  it("accepts local loopback aliases on the same protocol and port", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://127.0.0.1:3000", { origin: "http://localhost:3000" }),
        "ideas.run",
      ),
    ).toEqual({ ok: true });
  });

  it("rejects the wildcard bind address as a trusted loopback origin", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://0.0.0.0:3000", { origin: "http://localhost:3000" }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a wildcard Host header even when the runtime request URL remains loopback", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://127.0.0.1:3000", {
          host: "0.0.0.0:3000",
          origin: "http://127.0.0.1:3000",
        }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects requests without a declared Host or forwarded authority", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://127.0.0.1:3000", { host: null }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects local loopback aliases when the port differs", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://127.0.0.1:3210", { origin: "http://localhost:3000" }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("accepts forwarded host and protocol when the app server request URL is internal", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://0.0.0.0:3000", {
          forwardedHost: "localhost:3000",
          forwardedProto: "http",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        }),
        "ideas.run",
      ),
    ).toEqual({ ok: true });
  });

  it("accepts originless local browser mutations when fetch metadata is same-origin", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://127.0.0.1:3000", { fetchSite: "same-origin", origin: null }),
        "ideas.run",
      ),
    ).toEqual({ ok: true });
  });

  it("rejects external, missing, or protocol-mismatched origins", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://localhost:3000", { origin: "https://attacker.example" }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      validateStudioMutationRequest(
        studioRequest("http://localhost:3000", { origin: "https://localhost:3000" }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      validateStudioMutationRequest(
        studioRequest("http://example.test:3000", { fetchSite: "same-origin", origin: null }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      validateStudioMutationRequest(
        studioRequest("http://localhost:3000", { fetchSite: "cross-site", origin: null }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects malformed session cookies as unauthorized without throwing", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://localhost:3000", { cookie: `${studioSessionCookieName}=%E0%A4%A` }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 401 });
  });
});

function studioRequest(
  requestOrigin: string,
  options: Readonly<{
    fetchSite?: "cross-site" | "none" | "same-origin" | "same-site";
    forwardedHost?: string;
    forwardedProto?: "http" | "https";
    host?: string | null;
    origin?: string | null;
    cookie?: string;
  }> = {},
): Request {
  const origin = options.origin === undefined ? requestOrigin : options.origin;
  const headers: Record<string, string> = {
    [studioActionHeaderName]: "ideas.run",
    [studioSessionHeaderName]: token,
    "content-type": "application/json",
    cookie: options.cookie ?? `${studioSessionCookieName}=${token}`,
    host: options.host === undefined ? new URL(requestOrigin).host : (options.host ?? ""),
  };
  if (!headers.host) delete headers.host;
  if (origin) {
    headers.origin = origin;
  }
  if (options.forwardedHost) {
    headers["x-forwarded-host"] = options.forwardedHost;
  }
  if (options.forwardedProto) {
    headers["x-forwarded-proto"] = options.forwardedProto;
  }
  if (options.fetchSite) {
    headers["sec-fetch-site"] = options.fetchSite;
  }
  return new Request(`${requestOrigin}/actions/run-ideas`, { body: "{}", headers, method: "POST" });
}
