"use client";

import { useZama } from "@/components/fhe/ZamaContext";
import { useAccount } from "wagmi";

export function FheStatus() {
  const { sdk, ready, error } = useZama();
  const { isConnected } = useAccount();

  // Not connected - show nothing
  if (!isConnected) {
    return null;
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-950/40 border border-rose-700/30 rounded-full backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]" />
        </span>
        <span className="text-xs font-medium text-rose-400">Offline</span>
      </div>
    );
  }

  // SDK loading
  if (!sdk) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/40 border border-slate-700/30 rounded-full backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
          <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
        </span>
        <span className="text-xs font-medium text-slate-400">Loading</span>
      </div>
    );
  }

  // SDK loaded, waiting for wallet instance
  if (!ready) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-950/30 border border-indigo-700/20 rounded-full backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
          <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
        </span>
        <span className="text-xs font-medium text-indigo-300">Syncing</span>
      </div>
    );
  }

  // Ready
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/30 border border-emerald-700/20 rounded-full backdrop-blur-sm">
      <span className="relative flex h-2 w-2">
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
      </span>
      <span className="text-xs font-medium text-emerald-400">Secure</span>
    </div>
  );
}
