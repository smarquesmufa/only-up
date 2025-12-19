"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { Navbar } from "@/components/layout/Navbar";
import { pricePredictionContract } from "@/config/contracts";

enum RoundStatus {
  Predicting,
  Locked,
  Settling,
  Revealed,
  Distributing,
  Finished,
}

type RoundData = {
  roundId: number;
  name: string;
  settlementPrice: number;
  totalPool: string;
  winnerCount: number;
  status: RoundStatus;
  userActive?: boolean;
  userVerified?: boolean;
  userClaimed?: boolean;
};

export default function HistoryPage() {
  const router = useRouter();
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const [filter, setFilter] = useState<"all" | "my">("all");
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRounds = useCallback(async () => {
    if (!publicClient) return;
    
    setIsLoading(true);
    
    try {
      // Get round count
      const count = await publicClient.readContract({
        ...pricePredictionContract,
        functionName: "roundCount",
      }) as bigint;

      const roundsData: RoundData[] = [];

      for (let i = 0; i < Number(count); i++) {
        try {
          // Get round summary
          const summary = await publicClient.readContract({
            ...pricePredictionContract,
            functionName: "getRoundSummary",
            args: [BigInt(i)],
          });

          const s = summary as readonly unknown[];
          const status = Number(s[3]);
          let userActive = false;
          
          // Check if user participated
          let userVerified = false;
          let userClaimed = false;
          if (address) {
            try {
              const prediction = await publicClient.readContract({
                ...pricePredictionContract,
                functionName: "getPrediction",
                args: [BigInt(i), address],
              });
              const pred = prediction as readonly unknown[];
              userActive = Boolean(pred[1]);
              userVerified = Boolean(pred[3]);
              userClaimed = Boolean(pred[4]);
            } catch {
              // User has no prediction
            }
          }

          // Include finished rounds OR rounds where user is active
          if (status >= RoundStatus.Finished || userActive) {
            roundsData.push({
              roundId: i,
              name: String(s[0]),
              settlementPrice: Number(s[5]),
              totalPool: formatEther(s[6] as bigint),
              winnerCount: Number(s[8]),
              status: status,
              userActive,
              userVerified,
              userClaimed,
            });
          }
        } catch {
          // Skip failed fetches
        }
      }

      setRounds(roundsData.reverse()); // Newest first
    } catch (err) {
      console.error("Failed to fetch rounds:", err);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, address]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const displayedRounds = filter === "my" 
    ? rounds.filter(r => r.userActive)
    : rounds;

  const getStatusBadge = (status: RoundStatus, winnerCount: number, userActive: boolean) => {
    if (status === RoundStatus.Finished) {
      if (winnerCount > 0) {
        return { text: "Settled", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
      }
      return { text: "No Winner", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
    }
    if (status === RoundStatus.Predicting) {
      return { text: userActive ? "Participating" : "Open", class: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" };
    }
    if (status === RoundStatus.Locked) {
      return { text: "Locked", class: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
    }
    return { text: RoundStatus[status], class: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Round <span className="text-indigo-400">History</span>
              </h1>
              <p className="text-slate-400">View past rounds and settlement results.</p>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
                  filter === "all" 
                    ? "bg-indigo-600 text-white border-indigo-500" 
                    : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800"
                }`}
              >
                All Rounds
              </button>
              <button 
                onClick={() => setFilter("my")}
                disabled={!isConnected}
                className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
                  filter === "my" 
                    ? "bg-indigo-600 text-white border-indigo-500" 
                    : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800 disabled:opacity-50"
                }`}
              >
                My Bets
              </button>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="inline-flex items-center gap-3 text-slate-400">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading history...
                </div>
              </div>
            ) : displayedRounds.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                {filter === "my" ? "You haven't participated in any finished rounds." : "No finished rounds yet."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Round</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Settled Price</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Prize Pool</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Winners</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">My Result</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {displayedRounds.map((round) => {
                      const badge = getStatusBadge(round.status, round.winnerCount, round.userActive || false);
                      return (
                        <tr 
                          key={round.roundId} 
                          onClick={() => router.push(`/predict/${round.roundId}`)}
                          className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">#{round.roundId + 1}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{round.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono">
                            {round.settlementPrice > 0 ? `$${round.settlementPrice}` : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-300 font-medium">{round.totalPool} ETH</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{round.winnerCount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {!round.userActive ? (
                              <span className="text-slate-500">-</span>
                            ) : round.userVerified ? (
                              round.userClaimed ? (
                                <span className="text-emerald-400 font-medium flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  Won & Claimed
                                </span>
                              ) : (
                                <span className="text-amber-400 font-medium flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  Won - Claim!
                                </span>
                              )
                            ) : round.settlementPrice > 0 ? (
                              <span className="text-slate-400">Lost</span>
                            ) : (
                              <span className="text-slate-500">Pending</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${badge.class}`}>
                              {badge.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
