import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeBflAdapter,
  type FetchLike,
  image,
  imageResponse,
  jsonResponse,
  plan,
  readyResponse,
  submitResponse,
} from "./blackForestLabsFlux2ProTestHelpers";

const initialApiKey = process.env.BFL_API_KEY;
let expectedJpeg: Buffer;
let wrongSizeJpeg: Buffer;

beforeAll(async () => {
  expectedJpeg = await image("jpeg", 1920, 1080);
  wrongSizeJpeg = await image("jpeg", 1280, 720);
});

beforeEach(() => {
  process.env.BFL_API_KEY = "fixture-bfl-api-key";
});

afterAll(() => {
  if (initialApiKey === undefined) {
    delete process.env.BFL_API_KEY;
  } else {
    process.env.BFL_API_KEY = initialApiKey;
  }
});

describe("Black Forest Labs FLUX.2 Pro reserved adapter", () => {
  it("submits once, polls the returned BFL URL, downloads locally, and reconciles credits", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse(submitResponse()))
      .mockResolvedValueOnce(jsonResponse(readyResponse(9)))
      .mockResolvedValueOnce(imageResponse(expectedJpeg, "image/jpeg"));
    const outcome = await executeBflAdapter(fetchMock);

    expect(outcome).toMatchObject({
      kind: "success",
      actualUsdMicros: 90_000,
      value: {
        extension: "jpg",
        media: { format: "jpeg", width: 1920, height: 1080 },
        provider: { service: "black-forest-labs", modelId: "flux-2-pro", outputFormat: "jpeg" },
        providerBilling: { billableCredits: 9, usdPerCredit: 0.01, derivedUsdMicros: 90_000 },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.bfl.ai/v1/flux-2-pro");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.bfl.ai/v1/get_result?id=task-123");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://delivery.bfl.ai/signed/image.jpg");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ "x-key": "fixture-bfl-api-key" }),
      body: JSON.stringify({
        prompt: plan.scenes[0]?.prompt,
        seed: 42,
        width: 1920,
        height: 1080,
        safety_tolerance: 2,
        output_format: "jpeg",
      }),
    });
    expect(fetchMock.mock.calls[2]?.[1]?.headers).not.toHaveProperty("x-key");
    expect(fetchMock.mock.calls[2]?.[1]?.redirect).toBe("error");
    expect(JSON.stringify(outcome)).not.toContain("signed/image.jpg");
    expect(JSON.stringify(outcome)).not.toContain("fixture-bfl-api-key");
  });

  it("reports provider terminal failure without a duplicate submit", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse(submitResponse()))
      .mockResolvedValueOnce(jsonResponse({ id: "task-123", status: "Failed", cost: 9 }));

    await expect(executeBflAdapter(fetchMock)).resolves.toMatchObject({
      kind: "unknown",
      reason: "provider-error",
      providerRequestId: "task-123",
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("treats an abort after submit as an unknown timeout", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<FetchLike>(async () => {
      if (fetchMock.mock.calls.length === 1) return jsonResponse(submitResponse());
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });

    await expect(executeBflAdapter(fetchMock, controller.signal)).resolves.toMatchObject({
      kind: "unknown",
      reason: "timeout",
      providerRequestId: "task-123",
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("rejects malformed submit responses after one possibly billable request", async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValueOnce(jsonResponse({ id: "task-123" }));

    await expect(executeBflAdapter(fetchMock)).resolves.toEqual({
      kind: "unknown",
      reason: "indeterminate",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses to poll a returned URL outside an HTTPS BFL host", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(
        jsonResponse(submitResponse("https://attacker.invalid/get_result?id=task-123")),
      );

    await expect(executeBflAdapter(fetchMock)).resolves.toMatchObject({
      kind: "unknown",
      reason: "indeterminate",
      providerRequestId: "task-123",
      requestEvidence: [
        expect.objectContaining({
          requestIdHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          reportedUnits: 9,
        }),
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses image delivery outside the BFL delivery hosts", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse(submitResponse()))
      .mockResolvedValueOnce(
        jsonResponse(readyResponse(9, "https://attacker.invalid/signed/image.jpg")),
      );

    await expect(executeBflAdapter(fetchMock)).resolves.toMatchObject({
      kind: "unknown",
      reason: "indeterminate",
      providerRequestId: "task-123",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts a regional BFL delivery host without following redirects", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse(submitResponse()))
      .mockResolvedValueOnce(
        jsonResponse(readyResponse(9, "https://delivery.eu.bfl.ai/signed/image.jpg")),
      )
      .mockResolvedValueOnce(imageResponse(expectedJpeg, "image/jpeg"));

    await expect(executeBflAdapter(fetchMock)).resolves.toMatchObject({ kind: "success" });
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://delivery.eu.bfl.ai/signed/image.jpg");
    expect(fetchMock.mock.calls[2]?.[1]?.redirect).toBe("error");
  });

  it.each([
    ["wrong content type", () => imageResponse(expectedJpeg, "text/html")],
    ["wrong dimensions", () => imageResponse(wrongSizeJpeg, "image/jpeg")],
  ])("treats %s as an uncertain paid result", async (_label, responseFactory) => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse(submitResponse()))
      .mockResolvedValueOnce(jsonResponse(readyResponse(9)))
      .mockResolvedValueOnce(responseFactory());

    await expect(executeBflAdapter(fetchMock)).resolves.toMatchObject({
      kind: "unknown",
      providerRequestId: "task-123",
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("requires provider billing and refuses charges above the exact scene cap", async () => {
    const missingBilling = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(
        jsonResponse({
          id: "task-123",
          polling_url: "https://api.bfl.ai/v1/get_result?id=task-123",
        }),
      )
      .mockResolvedValueOnce(jsonResponse(readyResponse(undefined)));
    await expect(executeBflAdapter(missingBilling)).resolves.toMatchObject({
      kind: "unknown",
      reason: "indeterminate",
    });

    const overCap = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse(submitResponse(undefined, 10)))
      .mockResolvedValueOnce(jsonResponse(readyResponse(10)));
    await expect(executeBflAdapter(overCap)).resolves.toMatchObject({
      kind: "unknown",
      reason: "indeterminate",
      providerRequestId: "task-123",
    });
    expect(overCap).toHaveBeenCalledTimes(2);
  });

  it("does not retry an ambiguous submit transport failure", async () => {
    const fetchMock = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new Error("fixture-bfl-api-key transport detail"));

    const outcome = await executeBflAdapter(fetchMock);
    expect(outcome).toEqual({ kind: "unknown", reason: "transport" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(outcome)).not.toContain("fixture-bfl-api-key");
  });

  it("fails before send when the server credential is absent", async () => {
    delete process.env.BFL_API_KEY;
    const fetchMock = vi.fn<FetchLike>();

    await expect(executeBflAdapter(fetchMock)).resolves.toEqual({
      kind: "definitely-not-sent",
      reason: "adapter-validation",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
