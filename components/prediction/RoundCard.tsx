"use client";

import { useRouter } from "next/navigation";
import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import { formatUTC } from "@/lib/time";
import { pricePredictionContract } from "@/config/contracts";

enum RoundStatus {
  Predicting,
  Locked,
  Settling,
  Revealed,
  Distributing,
  Finished,
}

interface RoundCardProps {
  roundId: number;
}

export function RoundCard({ roundId }: RoundCardProps) {
  const router = useRouter();

  const { data: roundSummary } = useReadContract({
    ...pricePredictionContract,
    functionName: "getRoundSummary",
    args: [BigInt(roundId)],
  });

  const roundName = roundSummary ? (roundSummary[0] as string) : `Round #${roundId}`;
  const targetTime = roundSummary ? Number(roundSummary[2]) : 0;
  const status = roundSummary ? (roundSummary[3] as number) : RoundStatus.Finished;
  const tolerance = roundSummary ? Number(roundSummary[4]) : 0;
  const totalPool = roundSummary ? formatEther(roundSummary[6] as bigint) : "0";
  const participants = roundSummary ? Number(roundSummary[7]) : 0;
  const predictionEndsIn = roundSummary ? Number(roundSummary[10]) : 0;

  const getStatusColor = (s: RoundStatus) => {
    switch (s) {
      case RoundStatus.Predicting: return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case RoundStatus.Locked: return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case RoundStatus.Settling: return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
      case RoundStatus.Distributing: return "text-pink-400 bg-pink-500/10 border-pink-500/20";
      default: return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    }
  };

  const formatTimeLeft = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div
      onClick={() => router.push(`/predict/${roundId}`)}
      className="bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700 cursor-pointer transition-all duration-300 hover:border-indigo-500/60 hover:shadow-xl hover:shadow-indigo-500/20 group overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm font-bold">
              #{roundId + 1}
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm group-hover:text-indigo-300 transition-colors">{roundName}</h3>
              <div className="text-xs text-slate-500 mt-0.5">Binance Spot</div>
            </div>
          </div>
          <div className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getStatusColor(status)}`}>
            {RoundStatus[status]}
          </div>
        </div>
      </div>

      {/* Target Time */}
      {targetTime > 0 && (
        <div className="px-4 py-3 bg-indigo-500/5 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-slate-400">Target:</span>
            <span className="text-xs text-indigo-300 font-medium">{formatUTC(targetTime)}</span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-slate-900/50 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">Pool</div>
            <div className="text-white font-semibold text-sm">{parseFloat(totalPool).toFixed(3)}</div>
            <div className="text-xs text-slate-500">ETH</div>
          </div>
          <div className="text-center p-2 bg-slate-900/50 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">Players</div>
            <div className="text-white font-semibold text-sm">{participants}</div>
            <div className="text-xs text-slate-500">joined</div>
          </div>
          <div className="text-center p-2 bg-slate-900/50 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">Tolerance</div>
            <div className="text-indigo-300 font-mono text-sm">±{tolerance}</div>
            <div className="text-xs text-slate-500">USD</div>
          </div>
        </div>

        {/* Time Left / Action */}
        <div className="mt-3 flex items-center justify-between">
          {status === RoundStatus.Predicting && predictionEndsIn > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-slate-400">Prediction ends in</span>
              <span className="text-emerald-400 font-medium">{formatTimeLeft(predictionEndsIn)}</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500">{RoundStatus[status]}</div>
          )}
          <div className="flex items-center gap-1 text-xs text-slate-400 group-hover:text-indigo-400 transition-colors">
            <span>View</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
