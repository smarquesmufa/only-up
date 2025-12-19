"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { RoundCard } from "@/components/prediction/RoundCard";
import { CreateRoundModal } from "@/components/prediction/CreateRoundModal";
import { useAccount, useReadContract } from "wagmi";
import { pricePredictionContract } from "@/config/contracts"; 

export default function PredictPage() {
  const { address } = useAccount();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Read total round count
  const { data: roundCount, refetch } = useReadContract({
    ...pricePredictionContract,
    functionName: "roundCount",
  });

  // Derive rounds array directly from data
  const rounds = roundCount 
    ? Array.from({ length: Number(roundCount) }, (_, i) => Number(roundCount) - 1 - i)
    : [];

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Prediction <span className="text-indigo-400">Rounds</span>
              </h1>
              <p className="text-slate-400">
                FHE-encrypted predictions. Your price stays hidden until settlement.
              </p>
            </div>
            
            {address && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Round
              </button>
            )}
          </div>

          {/* Rounds Grid */}
          {(!roundCount || rounds.length === 0) ? (
             <div className="text-center py-20 bg-slate-900/30 border border-slate-800 rounded-2xl">
                <div className="w-16 h-16 mx-auto bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Rounds Yet</h3>
                <p className="text-slate-500 mb-6">Create the first prediction round to get started.</p>
                {address && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-all"
                  >
                    Create First Round
                  </button>
                )}
             </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rounds.map((id) => (
                <RoundCard key={id} roundId={id} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Round Modal */}
      <CreateRoundModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          refetch();
        }}
      />
    </>
  );
}
