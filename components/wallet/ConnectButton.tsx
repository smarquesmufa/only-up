"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { useBalance, useAccount } from "wagmi";

// Generate unique gradient from address
function getGradientFromAddress(address: string): string {
  const hash = address.slice(2, 10);
  const h1 = parseInt(hash.slice(0, 4), 16) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 70%, 50%), hsl(${h2}, 80%, 40%))`;
}

export function ConnectButton() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });

  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        // Format balance from wagmi
        const formattedBalance = balance
          ? `${(Number(balance.value) / 10 ** balance.decimals).toFixed(4)} ${balance.symbol}`
          : account?.displayBalance;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="group relative px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl overflow-hidden shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:shadow-indigo-500/40 hover:scale-105 active:scale-95"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 transition-opacity duration-300 group-hover:opacity-90" />
                    <span className="relative flex items-center gap-2">
                      Connect Wallet
                      <svg 
                        className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="px-6 py-2.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 font-medium rounded-xl transition-all duration-300 backdrop-blur-sm"
                  >
                    Wrong Network
                  </button>
                );
              }

              const gradient = address ? getGradientFromAddress(address) : "linear-gradient(135deg, #6366f1, #8b5cf6)";

              return (
                <div className="flex items-center gap-2">
                  {/* Chain Selector */}
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 rounded-xl transition-all duration-300 backdrop-blur-sm group"
                  >
                    {chain.hasIcon && (
                      <div
                        className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-white/10"
                        style={{ background: chain.iconBackground }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? "Chain"}
                            src={chain.iconUrl}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    )}
                    <svg className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Account Button */}
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-3 pl-3 pr-2 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 rounded-xl transition-all duration-300 backdrop-blur-sm group"
                  >
                    <div className="flex flex-col items-end leading-none gap-0.5">
                      <span className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
                        {account.displayName}
                      </span>
                      {formattedBalance && (
                        <span className="text-[11px] font-medium text-slate-400 group-hover:text-indigo-300 transition-colors">
                          {formattedBalance}
                        </span>
                      )}
                    </div>
                    {/* Unique Avatar */}
                    <div
                      className="w-8 h-8 rounded-lg ring-2 ring-white/10 group-hover:ring-indigo-500/30 transition-all shadow-lg"
                      style={{ background: gradient }}
                    >
                      <div className="w-full h-full flex items-center justify-center text-white/80 text-xs font-bold">
                        {account.displayName?.slice(0, 2)}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
