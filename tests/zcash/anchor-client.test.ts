import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

import {
  AnchorClientError,
  getAnchorClient,
  MockAnchorClient,
  ZalletAnchorClient
} from "@/lib/zcash/anchor-client";
import { ZcashConfigError } from "@/lib/zcash/runtime";

function jsonRpcOk(result: unknown) {
  return new Response(
    JSON.stringify({
      jsonrpc: "1.0",
      id: "zcap",
      result,
      error: null
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    }
  );
}

function jsonRpcError(message: string) {
  return new Response(
    JSON.stringify({
      jsonrpc: "1.0",
      id: "zcap",
      result: null,
      error: {
        code: -1,
        message
      }
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    }
  );
}

describe("anchor-client", () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    ZALLET_RPC_URL: process.env.ZALLET_RPC_URL,
    ZALLET_FROM_ADDRESS: process.env.ZALLET_FROM_ADDRESS,
    ZALLET_RPC_USER: process.env.ZALLET_RPC_USER,
    ZALLET_RPC_PASSWORD: process.env.ZALLET_RPC_PASSWORD,
    ZALLET_MINCONF: process.env.ZALLET_MINCONF,
    ZALLET_SEND_AMOUNT_ZEC: process.env.ZALLET_SEND_AMOUNT_ZEC,
    ZALLET_PRIVACY_POLICY: process.env.ZALLET_PRIVACY_POLICY,
    ZALLET_POLL_INTERVAL_MS: process.env.ZALLET_POLL_INTERVAL_MS,
    ZALLET_POLL_TIMEOUT_MS: process.env.ZALLET_POLL_TIMEOUT_MS
  };

  beforeEach(() => {
    fetchMock.mockReset();
    for (const key of Object.keys(originalEnv)) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("uses the mock client when zallet envs are missing", () => {
    expect(getAnchorClient()).toBeInstanceOf(MockAnchorClient);
  });

  it("throws in production when zallet envs are missing", () => {
    process.env.NODE_ENV = "production";

    expect(() => getAnchorClient()).toThrowError(ZcashConfigError);
  });

  it("uses the zallet client when rpc envs are present", () => {
    process.env.ZALLET_RPC_URL = "http://127.0.0.1:8232/";
    process.env.ZALLET_FROM_ADDRESS = "utest1collector";

    expect(getAnchorClient()).toBeInstanceOf(ZalletAnchorClient);
  });

  it("broadcasts a self-spend anchor through z_sendmany and polling", async () => {
    process.env.ZALLET_RPC_URL = "http://127.0.0.1:8232/";
    process.env.ZALLET_FROM_ADDRESS = "utest1collector";
    process.env.ZALLET_POLL_INTERVAL_MS = "1";
    process.env.ZALLET_POLL_TIMEOUT_MS = "10";

    fetchMock
      .mockResolvedValueOnce(jsonRpcOk("opid-1"))
      .mockResolvedValueOnce(
        jsonRpcOk([
          {
            id: "opid-1",
            status: "success",
            result: {
              txid: "ab".repeat(32)
            }
          }
        ])
      );

    const client = getAnchorClient();
    const result = await client.anchorPoll("POLL|v1|poll_1|hash|open|close");

    expect(result.txid).toBe("ab".repeat(32));
    expect(typeof result.submittedAt).toBe("string");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(firstBody.method).toBe("z_sendmany");
    expect(firstBody.params[0]).toBe("utest1collector");
    expect(firstBody.params[1][0].memo).toBe(
      Buffer.from("POLL|v1|poll_1|hash|open|close", "utf8").toString("hex")
    );
  });

  it("surfaces safe pre-submission failures when z_sendmany is rejected", async () => {
    process.env.ZALLET_RPC_URL = "http://127.0.0.1:8232/";
    process.env.ZALLET_FROM_ADDRESS = "utest1collector";

    fetchMock.mockResolvedValueOnce(jsonRpcError("wallet rejected request"));

    const client = getAnchorClient();

    await expect(client.anchorPoll("hello")).rejects.toMatchObject({
      name: "AnchorClientError",
      kind: "SAFE_PRE_SUBMISSION_FAILURE"
    });
  });

  it("surfaces unknown submission state when polling times out", async () => {
    process.env.ZALLET_RPC_URL = "http://127.0.0.1:8232/";
    process.env.ZALLET_FROM_ADDRESS = "utest1collector";
    process.env.ZALLET_POLL_INTERVAL_MS = "1";
    process.env.ZALLET_POLL_TIMEOUT_MS = "3";

    fetchMock
      .mockResolvedValueOnce(jsonRpcOk("opid-1"))
      .mockResolvedValue(jsonRpcOk([{ id: "opid-1", status: "executing" }]));

    const client = getAnchorClient();

    await expect(client.anchorPoll("hello")).rejects.toMatchObject({
      name: "AnchorClientError",
      kind: "UNKNOWN_SUBMISSION_STATE"
    });
  });

  it("preserves AnchorClientError prototype", () => {
    const error = new AnchorClientError("x", "SAFE_PRE_SUBMISSION_FAILURE");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AnchorClientError);
    expect(error.kind).toBe("SAFE_PRE_SUBMISSION_FAILURE");
  });
});
