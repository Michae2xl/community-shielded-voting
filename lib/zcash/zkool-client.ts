export interface IncomingVoteNote {
  shieldedAddress: string;
  txid: string;
  amountZat: bigint;
  memo: string;
  blockHeight: number | null;
}

interface ZkoolConfig {
  url: string;
  collectorAccountId: number;
}

interface ZalletCollectorConfig {
  rpcUrl: string;
  rpcUser?: string;
  rpcPassword?: string;
  collectorAccount: string;
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

interface JsonRpcEnvelope<T> {
  result: T | null;
  error: { code?: number; message?: string } | null;
}

function readConfig(): ZkoolConfig | null {
  const url = process.env.ZKOOL_URL;
  const collectorAccountId = process.env.POLL_COLLECTOR_ACCOUNT_ID;

  if (!url || !collectorAccountId) {
    return null;
  }

  if (!/^\d+$/.test(collectorAccountId)) {
    throw new Error("POLL_COLLECTOR_ACCOUNT_ID must be an integer");
  }

  return {
    url,
    collectorAccountId: Number(collectorAccountId)
  };
}

function readZalletCollectorConfig(): ZalletCollectorConfig | null {
  const rpcUrl = process.env.ZALLET_RPC_URL;
  const collectorAccount = process.env.POLL_COLLECTOR_ACCOUNT_UUID;

  if (!rpcUrl || !collectorAccount) {
    return null;
  }

  return {
    rpcUrl,
    rpcUser: process.env.ZALLET_RPC_USER,
    rpcPassword: process.env.ZALLET_RPC_PASSWORD,
    collectorAccount
  };
}

function zecDecimalToZat(value: string | number) {
  const normalized = String(value).trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid ZEC decimal amount: ${normalized}`);
  }

  const [whole, fractional = ""] = normalized.split(".");
  const paddedFractional = fractional.padEnd(8, "0");

  if (paddedFractional.length > 8) {
    throw new Error(`Too many decimal places for ZEC amount: ${normalized}`);
  }

  return BigInt(whole) * 100000000n + BigInt(paddedFractional || "0");
}

export class ZkoolClient {
  isConfigured() {
    return readConfig() !== null || readZalletCollectorConfig() !== null;
  }

  private requireConfig() {
    const config = readConfig();

    if (config) {
      return config;
    }

    throw new Error(
      "Collector wallet is not configured. Expected either ZKOOL_URL + POLL_COLLECTOR_ACCOUNT_ID or ZALLET_RPC_URL + POLL_COLLECTOR_ACCOUNT_UUID"
    );
  }

  private async gql<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    const { url } = this.requireConfig();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`zkool GraphQL error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as GraphqlResponse<T>;

    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message ?? "zkool GraphQL request failed");
    }

    if (!json.data) {
      throw new Error("zkool GraphQL response is missing data");
    }

    return json.data;
  }

  private async callZalletRpc<T>(method: string, params: unknown[]) {
    const config = readZalletCollectorConfig();

    if (!config) {
      throw new Error(
        "ZALLET_RPC_URL and POLL_COLLECTOR_ACCOUNT_UUID must be configured"
      );
    }

    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (config.rpcUser) {
      const basic = Buffer.from(
        `${config.rpcUser}:${config.rpcPassword ?? ""}`,
        "utf8"
      ).toString("base64");
      headers.authorization = `Basic ${basic}`;
    }

    const response = await fetch(config.rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "1.0",
        id: "zcap-collector",
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

  async allocateVoteAddress(): Promise<string> {
    const zalletConfig = readZalletCollectorConfig();

    if (zalletConfig) {
      const data = await this.callZalletRpc<{
        address: string;
      }>("z_getaddressforaccount", [zalletConfig.collectorAccount, ["orchard"]]);

      if (!data.address) {
        throw new Error("zallet did not return a collector address");
      }

      return data.address;
    }

    const { collectorAccountId } = this.requireConfig();
    const data = await this.gql<{
      newAddresses: {
        ua: string | null;
        orchard?: string | null;
      };
    }>(
      `mutation NewAddresses($idAccount: Int!) {
        newAddresses(idAccount: $idAccount) {
          ua
          orchard
        }
      }`,
      {
        idAccount: collectorAccountId
      }
    );

    const address = data.newAddresses.ua ?? data.newAddresses.orchard;

    if (!address) {
      throw new Error("zkool did not return a shielded collector address");
    }

    return address;
  }

  async syncWallet(): Promise<{ ok: true }> {
    if (!this.isConfigured()) {
      return { ok: true };
    }

    if (readZalletCollectorConfig()) {
      return { ok: true };
    }

    const { collectorAccountId } = this.requireConfig();

    await this.gql<{ synchronize: number }>(
      `mutation Synchronize($idAccounts: [Int!]!) {
        synchronize(idAccounts: $idAccounts)
      }`,
      {
        idAccounts: [collectorAccountId]
      }
    );

    return { ok: true };
  }

  async fetchIncomingVotes(options?: {
    minConfirmations?: number;
  }): Promise<IncomingVoteNote[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const minConfirmations = options?.minConfirmations ?? 1;
    const zalletConfig = readZalletCollectorConfig();

    if (zalletConfig) {
      const notes = await this.callZalletRpc<
        Array<{
          txid: string;
          address?: string;
          confirmations?: number;
          account_uuid?: string;
          valueZat?: number | string;
          value?: number | string;
          memoStr?: string | null;
        }>
      >("z_listunspent", [minConfirmations, 9999999, true]);

      return notes
        .filter(
          (note) =>
            note.account_uuid === zalletConfig.collectorAccount &&
            Boolean(note.address) &&
            Boolean(note.memoStr) &&
            typeof note.confirmations === "number" &&
            note.confirmations >= minConfirmations
        )
        .map((note) => ({
          shieldedAddress: note.address!,
          txid: note.txid,
          amountZat:
            note.valueZat !== undefined
              ? BigInt(note.valueZat)
              : zecDecimalToZat(note.value ?? 0),
          memo: note.memoStr!,
          blockHeight: null
        }));
    }

    const { collectorAccountId } = this.requireConfig();
    const data = await this.gql<{
      transactionsByAccount: Array<{
        id: number;
        txid: string;
        height: number;
        outputs: Array<{
          address: string;
          memo: string | null;
          value: string | number;
        }>;
      }>;
    }>(
      `query TransactionsByAccount($idAccount: Int!) {
        transactionsByAccount(idAccount: $idAccount) {
          id
          txid
          height
          outputs {
            address
            memo
            value
          }
        }
      }`,
      {
        idAccount: collectorAccountId
      }
    );

    return data.transactionsByAccount.flatMap((transaction) => {
      if (minConfirmations > 0 && transaction.height <= 0) {
        return [];
      }

      return transaction.outputs
        .filter((output) => output.address && output.memo)
        .map((output) => ({
          shieldedAddress: output.address,
          txid: transaction.txid,
          amountZat: zecDecimalToZat(output.value),
          memo: output.memo!,
          blockHeight: transaction.height > 0 ? transaction.height : null
        }));
    });
  }
}

const defaultClient = new ZkoolClient();

export function getZkoolClient() {
  return defaultClient;
}
