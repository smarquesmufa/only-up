"use client";

import { useState, useMemo } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { pricePredictionContract } from "@/config/contracts";

interface CreateRoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateRoundModal({ isOpen, onClose, onSuccess }: CreateRoundModalProps) {
  const { isConnected } = useAccount();
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetHour, setTargetHour] = useState("");
  const [tolerance, setTolerance] = useState("100");
  
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Calculate min/max dates (48h - 72h from now) in UTC
  const { minDateTime, maxDateTime, minDateTimeStr, maxDateTimeStr } = useMemo(() => {
    const now = new Date();
    const min = new Date(now.getTime() + 48 * 60 * 60 * 1000); // +48h
    const max = new Date(now.getTime() + 72 * 60 * 60 * 1000); // +72h
    return {
      minDateTime: min,
      maxDateTime: max,
      minDateTimeStr: min.toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
      maxDateTimeStr: max.toISOString().slice(0, 16),
    };
  }, []);

  // Convert selected UTC date/hour to timestamp
  const targetTimestamp = useMemo(() => {
    if (!targetDate || !targetHour) return 0;
    const dt = new Date(`${targetDate}T${targetHour}:00:00Z`); // Z = UTC
    return Math.floor(dt.getTime() / 1000);
  }, [targetDate, targetHour]);

  // Validate target time is within range
  const isValidTargetTime = useMemo(() => {
    if (!targetTimestamp) return false;
    const minTs = Math.floor(minDateTime.getTime() / 1000);
    const maxTs = Math.floor(maxDateTime.getTime() / 1000);
    return targetTimestamp >= minTs && targetTimestamp <= maxTs;
  }, [targetTimestamp, minDateTime, maxDateTime]);

  const handleCreate = () => {
    if (!isConnected || !name || !tolerance || Number(tolerance) <= 0 || !isValidTargetTime) return;
    
    writeContract({
      ...pricePredictionContract,
      functionName: "createRound",
      args: [name, BigInt(targetTimestamp), BigInt(tolerance)],
    });
  };

  // Handle success
  if (isSuccess) {
    setTimeout(() => {
      onSuccess();
    }, 500);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">Create Round</h2>
            <p className="text-xs text-amber-400 mt-0.5">Anyone can create, only contract owner can settle</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Name & Tolerance Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Round Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                placeholder="e.g. ETH Dec 2025"
                maxLength={64}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Tolerance</label>
              <input
                type="number"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                placeholder="±100"
                min="1"
              />
            </div>
          </div>

          {/* Target Time */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Time UTC (48h-72h)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                min={minDateTimeStr.split("T")[0]}
                max={maxDateTimeStr.split("T")[0]}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-indigo-500 outline-none [color-scheme:dark]"
              />
              <select
                value={targetHour}
                onChange={(e) => setTargetHour(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-indigo-500 outline-none"
              >
                <option value="">Hour</option>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i.toString().padStart(2, "0")}>
                    {i.toString().padStart(2, "0")}:00 UTC
                  </option>
                ))}
              </select>
            </div>
            {targetDate && targetHour && !isValidTargetTime && (
              <p className="mt-1 text-xs text-red-400">Must be between 48h and 72h from now</p>
            )}
          </div>

          {/* Period Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
              <div className="text-xs text-slate-500">Prediction Period</div>
              <div className="text-sm font-medium text-white">48 hours</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
              <div className="text-xs text-slate-500">Lock Period</div>
              <div className="text-sm font-medium text-white">24 hours</div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
              {error.message.slice(0, 100)}...
            </div>
          )}

          {/* Success */}
          {isSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm text-emerald-400">
              Round created successfully!
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={handleCreate}
            disabled={isPending || isConfirming || !name || !tolerance || !isValidTargetTime}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isPending || isConfirming ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isPending ? "Confirm in wallet..." : "Creating..."}
              </>
            ) : (
              "Create Round"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
