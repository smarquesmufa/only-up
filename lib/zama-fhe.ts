// Zama FHE SDK types and loader

export type EncryptionBuilder = {
  add8: (val: number) => EncryptionBuilder;
  add64: (val: number | bigint) => EncryptionBuilder;
  add256: (val: number | bigint | string) => EncryptionBuilder;
  encrypt: () => Promise<{
    handles: string[];
    inputProof: string;
  }>;
};

export type KeyPair = {
  publicKey: string;
  privateKey: string;
};

export type HandleContractPair = {
  handle: string;
  contractAddress: string;
};

export type EIP712Data = {
  domain: Record<string, unknown>;
  types: { UserDecryptRequestVerification: Array<{ name: string; type: string }> };
  message: Record<string, unknown>;
};

export type ZamaInstance = {
  createEncryptedInput: (contract: string, signer: string) => EncryptionBuilder;
  publicDecrypt: (handles: string[]) => Promise<{
    clearValues: Record<string, bigint | string | number>;
    abiEncodedClearValues: string;
    decryptionProof: string;
  }>;
  generateKeypair: () => KeyPair;
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string,
    durationDays: string
  ) => EIP712Data;
  userDecrypt: (
    handleContractPairs: HandleContractPair[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string,
    durationDays: string
  ) => Promise<Record<string, bigint | number | string>>;
};

type ZamaSdkModule = {
  initSDK: () => Promise<void>;
  createInstance: <T>(cfg: T) => Promise<ZamaInstance>;
  SepoliaConfig: Record<string, unknown>;
};

let pendingLoad: Promise<ZamaSdkModule> | null = null;

function findGlobalInit(): (() => Promise<void>) | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as Record<string, unknown>;
  const keys = ["RelayerSDK", "relayerSDK", "zamaRelayerSDK"];
  for (const k of keys) {
    const mod = win[k] as { initSDK?: () => Promise<void> } | undefined;
    if (mod && typeof mod.initSDK === "function") return mod.initSDK;
  }
  return null;
}

function findGlobalModule(): ZamaSdkModule | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as Record<string, unknown>;
  const keys = ["RelayerSDK", "relayerSDK", "zamaRelayerSDK"];
  for (const k of keys) {
    const mod = win[k] as ZamaSdkModule | undefined;
    if (mod && typeof mod.createInstance === "function") return mod;
  }
  return null;
}

export async function initZamaSdk(): Promise<ZamaSdkModule> {
  if (typeof window === "undefined") {
    throw new Error("Zama SDK requires browser environment");
  }

  if (pendingLoad) return pendingLoad;

  pendingLoad = (async () => {
    let initFn = findGlobalInit();

    // Wait for CDN script to load
    if (!initFn) {
      for (let retry = 0; retry < 50; retry++) {
        await new Promise((r) => setTimeout(r, 100));
        initFn = findGlobalInit();
        if (initFn) break;
      }
    }

    if (!initFn) {
      throw new Error("Zama SDK not found - check CDN script");
    }

    await initFn();

    const sdk = findGlobalModule();
    if (!sdk) {
      throw new Error("Zama SDK module not available");
    }

    return sdk;
  })();

  return pendingLoad;
}
