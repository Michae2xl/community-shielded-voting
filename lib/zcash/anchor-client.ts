import { ZcashConfigError, zcashMocksAllowed } from "@/lib/zcash/runtime";

export interface AnchorResult {
  txid: string;
  submittedAt: string;
}

export type AnchorClientErrorKind =
  | "SAFE_PRE_SUBMISSION_FAILURE"
  | "UNKNOWN_SUBMISSION_STATE";

export class AnchorClientError extends Error {
  constructor(
    message: string,
    public readonly kind: AnchorClientErrorKind
  ) {
    super(message);
    this.name = "AnchorClientError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface AnchorClient {
  anchorPoll(memo: string): Promise<AnchorResult>;
}

type ZcashNetwork = "regtest" | "testnet" | "mainnet";

interface ZalletAnchorConfig {
  rpcUrl: string;
  fromAddress: string;
  rpcUser?: string;
  rpcPassword?: string;
  minconf: number;
  sendAmountZec: number;
  privacyPolicy: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  network: ZcashNetwork;
}

interface JsonRpcEnvelope<T> {
  result: T | null;
  error: { code?: number; message?: string } | null;
}

function parseIntegerEnv(name: string, value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be an integer`);
  }

  return Number(value);
}

function parseNumberEnv(name: string, value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return parsed;
}

function readNetwork(): ZcashNetwork {
  const value = process.env.ZCASH_NETWORK;

  if (!value) {
    return "testnet";
  }

  if (value === "regtest" || value === "testnet" || value === "mainnet") {
    return value;
  }

  throw new Error("ZCASH_NETWORK must be regtest, testnet, or mainnet");
}

function defaultMinconf(network: ZcashNetwork) {
  switch (network) {
    case "regtest":
      return 1;
    case "testnet":
      return 3;
    case "mainnet":
      return 1;
  }
}

function defaultPollTimeoutMs(network: ZcashNetwork) {
  switch (network) {
    case "regtest":
      return 120_000;
    case "testnet":
      return 300_000;
    case "mainnet":
      return 600_000;
  }
}

function readZalletAnchorConfig(): ZalletAnchorConfig | null {
  const rpcUrl = process.env.ZALLET_RPC_URL;
  const fromAddress = process.env.ZALLET_FROM_ADDRESS;

  if (!rpcUrl || !fromAddress) {
    return null;
  }

  const network = readNetwork();

  return {
    rpcUrl,
    fromAddress,
    rpcUser: process.env.ZALLET_RPC_USER,
    rpcPassword: process.env.ZALLET_RPC_PASSWORD,
    minconf: parseIntegerEnv(
      "ZALLET_MINCONF",
      process.env.ZALLET_MINCONF,
      defaultMinconf(network)
    ),
    sendAmountZec: parseNumberEnv(
      "ZALLET_SEND_AMOUNT_ZEC",
      process.env.ZALLET_SEND_AMOUNT_ZEC,
      0.00000001
    ),
    privacyPolicy: process.env.ZALLET_PRIVACY_POLICY ?? "FullPrivacy",
    pollIntervalMs: parseIntegerEnv(
      "ZALLET_POLL_INTERVAL_MS",
      process.env.ZALLET_POLL_INTERVAL_MS,
      1000
    ),
    pollTimeoutMs: parseIntegerEnv(
      "ZALLET_POLL_TIMEOUT_MS",
      process.env.ZALLET_POLL_TIMEOUT_MS,
      defaultPollTimeoutMs(network)
    ),
    network
  };
}

export class MockAnchorClient implements AnchorClient {
  async anchorPoll(_memo: string): Promise<AnchorResult> {
    return {
      txid: "mock-anchor-txid",
      submittedAt: new Date().toISOString()
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHexTxid(value: string) {
  return /^[0-9a-f]{64}$/i.test(value);
}

export class ZalletAnchorClient implements AnchorClient {
  constructor(private readonly config: ZalletAnchorConfig) {}

  private async callRpc<T>(method: string, params: unknown[]) {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (this.config.rpcUser) {
      const basic = Buffer.from(
        `${this.config.rpcUser}:${this.config.rpcPassword ?? ""}`,
        "utf8"
      ).toString("base64");
      headers.authorization = `Basic ${basic}`;
    }

    const response = await fetch(this.config.rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "1.0",
        id: "zcap",
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`${method} returned HTTP ${response.status}`);
    }

    const json = (await response.json()) as JsonRpcEnvelope<T>;

    if (json.error) {
      throw new Error(json.error.message ?? `${method} failed`);
    }

    if (json.result === null || json.result === undefined) {
      throw new Error(`${method} returned no result`);
    }

    return json.result;
  }

  private async pollOperation(operationId: string) {
    const deadline = Date.now() + this.config.pollTimeoutMs;

    while (Date.now() <= deadline) {
      const statuses = await this.callRpc<
        Array<{
          id?: string;
          status?: string;
          result?: { txid?: string };
          error?: { message?: string };
        }>
      >("z_getoperationstatus", [[operationId]]);

      const match = statuses.find((status) => status.id === operationId);

      if (!match || match.status === "queued" || match.status === "executing") {
        await sleep(this.config.pollIntervalMs);
        continue;
      }

      if (match.status === "success") {
        const txid = match.result?.txid;

        if (!txid || !isHexTxid(txid)) {
          throw new AnchorClientError(
            "z_getoperationstatus returned an invalid txid",
            "UNKNOWN_SUBMISSION_STATE"
          );
        }

        return txid;
      }

      if (match.status === "failed") {
        throw new AnchorClientError(
          match.error?.message ?? "z_sendmany failed",
          "SAFE_PRE_SUBMISSION_FAILURE"
        );
      }

      throw new AnchorClientError(
        `unknown operation status: ${match.status ?? "missing"}`,
        "UNKNOWN_SUBMISSION_STATE"
      );
    }

    throw new AnchorClientError(
      "z_sendmany operation timed out",
      "UNKNOWN_SUBMISSION_STATE"
    );
  }

  async anchorPoll(memo: string): Promise<AnchorResult> {
    const memoHex = Buffer.from(memo, "utf8").toString("hex");

    let operationId: string;

    try {
      operationId = await this.callRpc<string>("z_sendmany", [
        this.config.fromAddress,
        [
          {
            address: this.config.fromAddress,
            amount: this.config.sendAmountZec,
            memo: memoHex
          }
        ],
        this.config.minconf,
        null,
        this.config.privacyPolicy
      ]);
    } catch (error) {
      throw new AnchorClientError(
        error instanceof Error ? error.message : "z_sendmany request failed",
        "SAFE_PRE_SUBMISSION_FAILURE"
      );
    }

    try {
      const txid = await this.pollOperation(operationId);

      return {
        txid,
        submittedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof AnchorClientError) {
        throw error;
      }

      throw new AnchorClientError(
        error instanceof Error ? error.message : "anchor submission state is unknown",
        "UNKNOWN_SUBMISSION_STATE"
      );
    }
  }
}

export function getAnchorClient(): AnchorClient {
  const config = readZalletAnchorConfig();

  if (!config) {
    if (!zcashMocksAllowed()) {
      throw new ZcashConfigError("Zcash anchor wallet is not configured");
    }

    return new MockAnchorClient();
  }

  return new ZalletAnchorClient(config);
}
