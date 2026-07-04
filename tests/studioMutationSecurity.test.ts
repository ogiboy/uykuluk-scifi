import { describe, expect, it } from "vitest";
import {
  studioActionHeaderName,
  studioSessionCookieName,
  studioSessionHeaderName,
  validateStudioMutationRequest,
} from "../apps/studio/src/lib/studioMutationSecurity";

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
        studioRequest("http://0.0.0.0:3000", { origin: "http://localhost:3000" }),
        "ideas.run",
      ),
    ).toEqual({ ok: true });
    expect(
      validateStudioMutationRequest(
        studioRequest("http://127.0.0.1:3000", { origin: "http://localhost:3000" }),
        "ideas.run",
      ),
    ).toEqual({ ok: true });
  });

  it("accepts forwarded host and protocol when the app server request URL is internal", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://0.0.0.0:3000", {
          forwardedHost: "localhost:3000",
          forwardedProto: "http",
          origin: "http://localhost:3000",
        }),
        "ideas.run",
      ),
    ).toEqual({ ok: true });
  });

  it("rejects external, missing, or port-mismatched origins", () => {
    expect(
      validateStudioMutationRequest(
        studioRequest("http://localhost:3000", { origin: "https://attacker.example" }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      validateStudioMutationRequest(
        studioRequest("http://localhost:3000", { origin: "http://localhost:4000" }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      validateStudioMutationRequest(
        studioRequest("http://localhost:3000", { origin: null }),
        "ideas.run",
      ),
    ).toMatchObject({ ok: false, status: 403 });
  });
});

function studioRequest(
  requestOrigin: string,
  options: Readonly<{
    forwardedHost?: string;
    forwardedProto?: "http" | "https";
    origin?: string | null;
  }> = {},
): Request {
  const origin = options.origin === undefined ? requestOrigin : options.origin;
  const headers: Record<string, string> = {
    [studioActionHeaderName]: "ideas.run",
    [studioSessionHeaderName]: token,
    "content-type": "application/json",
    cookie: `${studioSessionCookieName}=${token}`,
  };
  if (origin) {
    headers.origin = origin;
  }
  if (options.forwardedHost) {
    headers["x-forwarded-host"] = options.forwardedHost;
  }
  if (options.forwardedProto) {
    headers["x-forwarded-proto"] = options.forwardedProto;
  }
  return new Request(`${requestOrigin}/actions/run-ideas`, {
    body: "{}",
    headers,
    method: "POST",
  });
}
