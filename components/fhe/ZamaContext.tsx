"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useWalletClient } from "wagmi";
import { initZamaSdk, type ZamaInstance } from "@/lib/zama-fhe";

type ZamaSdkModule = Awaited<ReturnType<typeof initZamaSdk>>;

type ZamaState = {
  sdk: ZamaSdkModule | null;
  instance: ZamaInstance | null;
  ready: boolean;
  error: Error | null;
};

const ZamaContext = createContext<ZamaState>({
  sdk: null,
  instance: null,
  ready: false,
  error: null,
});

const RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.ankr.com/eth_sepolia";
const CHAIN_ID = 11155111;

export function ZamaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ZamaState>({
    sdk: null,
    instance: null,
    ready: false,
    error: null,
  });
  const { data: wallet } = useWalletClient();

  // Step 1: Load SDK from CDN
  useEffect(() => {
    let active = true;

    initZamaSdk()
      .then((sdk) => {
        if (active) {
          console.log("[Zama] SDK loaded");
          setState((s) => ({ ...s, sdk, ready: false }));
        }
      })
      .catch((err) => {
        if (active) {
          console.error("[Zama] SDK load failed:", err);
          setState((s) => ({
            ...s,
            ready: false,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      });

    return () => { active = false; };
  }, []);

  // Step 2: Create instance when wallet connected
  const sdk = state.sdk;

  useEffect(() => {
    if (!sdk || !wallet) return;
    let active = true;

    const setup = async () => {
      try {
        const provider = {
          request: (args: unknown) =>
            (wallet as unknown as { request: (a: unknown) => Promise<unknown> }).request(args),
        };

        const config = {
          ...sdk.SepoliaConfig,
          network: RPC_URL,
          chainId: CHAIN_ID,
          signer: provider,
        };

        const instance = await sdk.createInstance(config);
        if (active) {
          console.log("[Zama] Instance ready");
          setState((s) => ({ ...s, instance, ready: true }));
        }
      } catch (err) {
        console.error("[Zama] Instance creation failed:", err);
        if (active) {
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      }
    };

    setup();
    return () => { active = false; };
  }, [sdk, wallet]);

  const value = useMemo(() => state, [state]);

  return <ZamaContext.Provider value={value}>{children}</ZamaContext.Provider>;
}

export function useZama() {
  return useContext(ZamaContext);
}
