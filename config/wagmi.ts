import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { sepolia } from "wagmi/chains";

// Zama FHEVM on Sepolia
export const config = getDefaultConfig({
  appName: "Only Up - Price Prediction",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "demo",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  ssr: true,
});

// Contract address (update after deployment)
export const PRICE_PREDICTION_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

// Zama Gateway
export const GATEWAY_ADDRESS = process.env.NEXT_PUBLIC_GATEWAY_ADDRESS || "https://gateway.sepolia.zama.ai";
