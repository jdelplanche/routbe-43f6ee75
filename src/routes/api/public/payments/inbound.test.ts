import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Route } from "./inbound";

// The handler is a plain function of { request }; we exercise it directly so the
// public webhook contract (401 / 400) is covered without a running server.
const handlers = (Route.options as unknown as {
  server: { handlers: { POST: (ctx: { request: Request }) => Promise<Response> } };
}).server.handlers;

const post = (body: string, init: RequestInit = {}) =>
  handlers.POST({
    request: new Request("https://rout.be/api/public/payments/inbound", {
      method: "POST",
      body,
      ...init,
    }),
  });

describe("/api/public/payments/inbound", () => {
  beforeEach(() => {
    process.env["INBOUND_EMAIL_TOKEN"] = "test-token";
  });
  afterEach(() => {
    delete process.env["INBOUND_EMAIL_TOKEN"];
  });

  it("rejects a request without a token", async () => {
    const res = await post("{}", { headers: { "content-type": "application/json" } });
    expect(res.status).toBe(401);
  });

  it("rejects a request with the wrong token", async () => {
    const res = await post("{}", {
      headers: { "content-type": "application/json", "x-inbound-token": "nope" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects malformed JSON from an authorised caller", async () => {
    const res = await post("{not-json", {
      headers: { "content-type": "application/json", "x-inbound-token": "test-token" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects an empty body from an authorised caller", async () => {
    const res = await post("", { headers: { "x-inbound-token": "test-token" } });
    expect(res.status).toBe(400);
  });

  it("grades a payload without reference or amount as level 3", async () => {
    const res = await post(JSON.stringify({ text: "no reference here" }), {
      headers: { "content-type": "application/json", "x-inbound-token": "test-token" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      level: 3,
      reason: "no_match",
      reference: null,
    });
  });

});
