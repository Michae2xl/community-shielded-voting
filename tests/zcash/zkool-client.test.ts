import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

import { ZkoolClient } from "@/lib/zcash/zkool-client";

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

describe("ZkoolClient", () => {
  const originalEnv = {
    ZKOOL_URL: process.env.ZKOOL_URL,
    POLL_COLLECTOR_ACCOUNT_ID: process.env.POLL_COLLECTOR_ACCOUNT_ID,
    ZALLET_RPC_URL: process.env.ZALLET_RPC_URL,
    ZALLET_RPC_USER: process.env.ZALLET_RPC_USER,
    ZALLET_RPC_PASSWORD: process.env.ZALLET_RPC_PASSWORD,
    POLL_COLLECTOR_ACCOUNT_UUID: process.env.POLL_COLLECTOR_ACCOUNT_UUID
  };

  beforeEach(() => {
    fetchMock.mockReset();
    delete process.env.ZKOOL_URL;
    delete process.env.POLL_COLLECTOR_ACCOUNT_ID;
    delete process.env.ZALLET_RPC_URL;
    delete process.env.ZALLET_RPC_USER;
    delete process.env.ZALLET_RPC_PASSWORD;
    delete process.env.POLL_COLLECTOR_ACCOUNT_UUID;
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

  it("returns no incoming votes when the collector wallet is not configured", async () => {
    const client = new ZkoolClient();

    await expect(client.fetchIncomingVotes()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rotates a new diversified address for vote requests", async () => {
    process.env.ZKOOL_URL = "http://zkool.local/graphql";
    process.env.POLL_COLLECTOR_ACCOUNT_ID = "7";

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          newAddresses: {
            ua: "utest1collectoraddress",
            orchard: "utest1collectoraddress"
          }
        }
      })
    );

    const client = new ZkoolClient();

    await expect(client.allocateVoteAddress()).resolves.toBe(
      "utest1collectoraddress"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://zkool.local/graphql");
  });

  it("hydrates incoming vote candidates from transactions and outputs", async () => {
    process.env.ZKOOL_URL = "http://zkool.local/graphql";
    process.env.POLL_COLLECTOR_ACCOUNT_ID = "7";

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          transactionsByAccount: [
            {
              id: 11,
              txid: "txid_1",
              height: 123,
              outputs: [
                {
                  address: "utest1votea",
                  memo: "A",
                  value: "0.0001"
                },
                {
                  address: "utest1external",
                  memo: null,
                  value: "0.4000"
                }
              ]
            },
            {
              id: 12,
              txid: "txid_unconfirmed",
              height: 0,
              outputs: [
                {
                  address: "utest1voteb",
                  memo: "B",
                  value: "0.0002"
                }
              ]
            }
          ]
        }
      })
    );

    const client = new ZkoolClient();

    await expect(client.fetchIncomingVotes()).resolves.toEqual([
      {
        shieldedAddress: "utest1votea",
        txid: "txid_1",
        amountZat: 10000n,
        memo: "A",
        blockHeight: 123
      }
    ]);
  });

  it("rotates a new zallet-derived address when the zallet collector is configured", async () => {
    process.env.ZALLET_RPC_URL = "http://zallet.local";
    process.env.ZALLET_RPC_USER = "rpc";
    process.env.ZALLET_RPC_PASSWORD = "pw";
    process.env.POLL_COLLECTOR_ACCOUNT_UUID = "account-uuid-1";

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        jsonrpc: "1.0",
        id: "zcap-collector",
        result: {
          address: "u1collectorvote"
        },
        error: null
      })
    );

    const client = new ZkoolClient();

    await expect(client.allocateVoteAddress()).resolves.toBe("u1collectorvote");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.method).toBe("z_getaddressforaccount");
    expect(body.params).toEqual(["account-uuid-1", ["orchard"]]);
  });

  it("hydrates incoming vote candidates from zallet listunspent output", async () => {
    process.env.ZALLET_RPC_URL = "http://zallet.local";
    process.env.POLL_COLLECTOR_ACCOUNT_UUID = "account-uuid-1";

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        jsonrpc: "1.0",
        id: "zcap-collector",
        result: [
          {
            txid: "txid_1",
            address: "u1votea",
            confirmations: 4,
            account_uuid: "account-uuid-1",
            valueZat: 10000,
            memoStr: "A"
          },
          {
            txid: "txid_other_account",
            address: "u1voteb",
            confirmations: 3,
            account_uuid: "other-account",
            valueZat: 20000,
            memoStr: "B"
          },
          {
            txid: "txid_without_memo",
            address: "u1votec",
            confirmations: 2,
            account_uuid: "account-uuid-1",
            valueZat: 30000,
            memoStr: null
          }
        ],
        error: null
      })
    );

    const client = new ZkoolClient();

    await expect(client.fetchIncomingVotes()).resolves.toEqual([
      {
        shieldedAddress: "u1votea",
        txid: "txid_1",
        amountZat: 10000n,
        memo: "A",
        blockHeight: null
      }
    ]);
  });

  it("can include unconfirmed zallet notes when duplicate prevention needs immediate observation", async () => {
    process.env.ZALLET_RPC_URL = "http://zallet.local";
    process.env.POLL_COLLECTOR_ACCOUNT_UUID = "account-uuid-1";

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        jsonrpc: "1.0",
        id: "zcap-collector",
        result: [
          {
            txid: "txid_0conf",
            address: "u1voteb",
            confirmations: 0,
            account_uuid: "account-uuid-1",
            valueZat: 10000,
            memoStr: "B"
          }
        ],
        error: null
      })
    );

    const client = new ZkoolClient();

    await expect(
      client.fetchIncomingVotes({ minConfirmations: 0 })
    ).resolves.toEqual([
      {
        shieldedAddress: "u1voteb",
        txid: "txid_0conf",
        amountZat: 10000n,
        memo: "B",
        blockHeight: null
      }
    ]);
  });
});
