"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, usePublicClient, useWalletClient } from "wagmi";
import { formatEther, parseEther } from "viem";
import { formatUTC } from "@/lib/time";
import { pricePredictionContract } from "@/config/contracts";
import { useZama } from "@/components/fhe/ZamaContext";
import { Navbar } from "@/components/layout/Navbar";
import { useState, useCallback, useRef } from "react";
import { parseEventLogs } from "viem";

enum RoundStatus {
  Predicting,
  Locked,
  Settling,
  Revealed,
  Distributing,
  Finished,
}

export default function RoundDetailPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = use(params);
  const router = useRouter();
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const { instance, ready: fheReady } = useZama();
  const [predictionPrice, setPredictionPrice] = useState("");
  const [stakeAmount, setStakeAmount] = useState("0.001");
  const [addStakeAmount, setAddStakeAmount] = useState("0.001");
  const [newPrice, setNewPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [decryptedPrice, setDecryptedPrice] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [settlementPriceInput, setSettlementPriceInput] = useState("");
  const [settlementStep, setSettlementStep] = useState<0 | 1 | 2 | 3>(0);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [revealedHandles, setRevealedHandles] = useState<string[]>([]);
  const isSettlingRef = useRef(false);
  const { data: walletClient } = useWalletClient();

  const { writeContractAsync } = useWriteContract();

  const { data: roundSummary, refetch: refetchSummary } = useReadContract({
    ...pricePredictionContract,
    functionName: "getRoundSummary",
    args: [BigInt(roundId)],
  });

  const { data: userPrediction, refetch: refetchPrediction } = useReadContract({
    ...pricePredictionContract,
    functionName: "getPrediction",
    args: [BigInt(roundId), address || "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  const { data: rewardData } = useReadContract({
    ...pricePredictionContract,
    functionName: "calculateReward",
    args: [BigInt(roundId), address || "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  const { data: ownerData } = useReadContract({
    ...pricePredictionContract,
    functionName: "owner",
  });

  const { data: roundData, refetch: refetchRoundData } = useReadContract({
    ...pricePredictionContract,
    functionName: "rounds",
    args: [BigInt(roundId)],
  });

  const owner = ownerData as string | undefined;
  const isOwner = owner && address && owner.toLowerCase() === address.toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roundSettled = roundData ? (roundData as any)[12] as boolean : false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roundRevealed = roundData ? (roundData as any)[13] as boolean : false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roundVerified = roundData ? (roundData as any)[14] as boolean : false;

  const roundName = roundSummary ? (roundSummary[0] as string) : `Round #${roundId}`;
  const creator = roundSummary ? (roundSummary[1] as string) : "";
  const targetTime = roundSummary ? Number(roundSummary[2]) : 0;
  const status = roundSummary ? (roundSummary[3] as number) : RoundStatus.Finished;
  const tolerance = roundSummary ? Number(roundSummary[4]) : 0;
  const settlementPrice = roundSummary ? Number(roundSummary[5]) : 0;
  const totalPool = roundSummary ? formatEther(roundSummary[6] as bigint) : "0";
  const participants = roundSummary ? Number(roundSummary[7]) : 0;
  const winnerCount = roundSummary ? Number(roundSummary[8]) : 0;
  const predictionEndsIn = roundSummary ? Number(roundSummary[10]) : 0;
  const roundEndsIn = roundSummary ? Number(roundSummary[11]) : 0;

  // User prediction data: stake, active, revealed, verified, claimed, priceHandle
  const userStake = userPrediction ? formatEther(userPrediction[0] as bigint) : "0";
  const userActive = userPrediction ? (userPrediction[1] as boolean) : false;
  const userVerified = userPrediction ? (userPrediction[3] as boolean) : false;
  const userClaimed = userPrediction ? (userPrediction[4] as boolean) : false;
  const userPriceHandle = userPrediction ? (userPrediction[5] as `0x${string}`) : null;
  const potentialReward = rewardData ? formatEther(rewardData as bigint) : "0";

  // Decrypt user's own prediction
  const handleDecrypt = async () => {
    if (!instance || !address || !userPriceHandle || !walletClient) return;
    if (userPriceHandle === "0x0000000000000000000000000000000000000000000000000000000000000000") return;
    
    setIsDecrypting(true);
    setSubmitError(null);
    
    try {
      console.log("[Decrypt] Starting, handle:", userPriceHandle);
      
      let decryptedValue: bigint | number | string;
      
      // Try simple method first
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const simpleDecrypt = (instance as any).userDecrypt as (
          encryptedValue: string,
          contractAddress: string
        ) => Promise<number | bigint>;
        
        decryptedValue = await simpleDecrypt(userPriceHandle, pricePredictionContract.address);
        console.log("[Decrypt] Simple method succeeded:", decryptedValue);
      } catch {
        console.log("[Decrypt] Simple method failed, trying legacy...");
        
        // Fallback to legacy method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const keypair = (instance as any).generateKeypair();
        const startTimestamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = "1";
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eip712 = (instance as any).createEIP712(
          keypair.publicKey,
          [pricePredictionContract.address],
          startTimestamp,
          durationDays
        );
        
        const signature = await walletClient.signTypedData({
          account: walletClient.account!,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          domain: eip712.domain as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          types: eip712.types as any,
          primaryType: "UserDecryptRequestVerification",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          message: eip712.message as any,
        });
        
        const handleContractPairs = [{ handle: userPriceHandle, contractAddress: pricePredictionContract.address }];
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const legacyDecrypt = (instance as any).userDecrypt as (
          handleContractPairs: Array<{ handle: unknown; contractAddress: string }>,
          privateKey: string,
          publicKey: string,
          signature: string,
          contractAddresses: string[],
          userAddress: string,
          startTimestamp: string,
          durationDays: string
        ) => Promise<Record<string, bigint | string>>;
        
        const result = await legacyDecrypt(
          handleContractPairs,
          keypair.privateKey,
          keypair.publicKey,
          signature.replace("0x", ""),
          [pricePredictionContract.address],
          address,
          startTimestamp,
          durationDays
        );
        
        console.log("[Decrypt] Legacy result:", result);
        decryptedValue = result[userPriceHandle] as bigint;
      }
      
      setDecryptedPrice(decryptedValue.toString());
    } catch (err) {
      console.error("[Decrypt] Failed:", err);
      setSubmitError(err instanceof Error ? err.message.slice(0, 80) : "Decrypt failed");
    } finally {
      setIsDecrypting(false);
    }
  };

  // Convert Uint8Array to hex string
  const toHex = (data: Uint8Array | string): `0x${string}` => {
    if (typeof data === "string") return data as `0x${string}`;
    return `0x${[...data].map(b => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
  };

  const handleSubmit = async () => {
    if (!predictionPrice || !stakeAmount || !instance || !address) return;
    setIsSubmitting(true);
    setSubmitError(null);

    // Let UI update before heavy encryption
    await new Promise(r => setTimeout(r, 50));

    try {
      const input = instance.createEncryptedInput(pricePredictionContract.address, address);
      input.add64(BigInt(predictionPrice));
      const encrypted = await input.encrypt();

      const handle = toHex(encrypted.handles[0] as Uint8Array | string);
      const proof = toHex(encrypted.inputProof as Uint8Array | string);

      const hash = await writeContractAsync({
        ...pricePredictionContract,
        functionName: "submitPrediction",
        args: [BigInt(roundId), handle, proof],
        value: parseEther(stakeAmount),
      });

      // Wait for transaction confirmation
      await publicClient?.waitForTransactionReceipt({ hash });

      refetchSummary();
      refetchPrediction();
      setPredictionPrice("");
    } catch (err) {
      console.error("Submit failed:", err);
      setSubmitError(err instanceof Error ? err.message.slice(0, 80) : "Transaction failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!newPrice || !instance || !address) return;
    setIsSubmitting(true);
    setSubmitError(null);

    // Let UI update before heavy encryption
    await new Promise(r => setTimeout(r, 50));

    try {
      const input = instance.createEncryptedInput(pricePredictionContract.address, address);
      input.add64(BigInt(newPrice));
      const encrypted = await input.encrypt();

      const handle = toHex(encrypted.handles[0] as Uint8Array | string);
      const proof = toHex(encrypted.inputProof as Uint8Array | string);

      const hash = await writeContractAsync({
        ...pricePredictionContract,
        functionName: "updatePrediction",
        args: [BigInt(roundId), handle, proof],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      refetchPrediction();
      setNewPrice("");
    } catch (err) {
      console.error("Update failed:", err);
      setSubmitError(err instanceof Error ? err.message.slice(0, 80) : "Update failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddStake = async () => {
    if (!addStakeAmount || !address) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const hash = await writeContractAsync({
        ...pricePredictionContract,
        functionName: "addStake",
        args: [BigInt(roundId)],
        value: parseEther(addStakeAmount),
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      refetchSummary();
      refetchPrediction();
      setAddStakeAmount("0.001");
    } catch (err) {
      console.error("Add stake failed:", err);
      setSubmitError(err instanceof Error ? err.message.slice(0, 80) : "Add stake failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!address) return;
    setIsSubmitting(true);
    try {
      const hash = await writeContractAsync({
        ...pricePredictionContract,
        functionName: "withdrawPrediction",
        args: [BigInt(roundId)],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      refetchSummary();
      refetchPrediction();
    } catch (err) {
      console.error("Withdraw failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimReward = async () => {
    if (!address) return;
    setIsSubmitting(true);
    try {
      const hash = await writeContractAsync({
        ...pricePredictionContract,
        functionName: "claimReward",
        args: [BigInt(roundId)],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      refetchSummary();
      refetchPrediction();
    } catch (err) {
      console.error("Claim failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Force skip to settling phase (demo only)
  const handleForceSettling = async () => {
    if (!isOwner || isSettlingRef.current) return;
    isSettlingRef.current = true;
    setSettlementError(null);
    try {
      const hash = await writeContractAsync({
        ...pricePredictionContract,
        functionName: "forceSettlingPhase",
        args: [BigInt(roundId)],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      refetchSummary();
    } catch (err) {
      console.error("ForceSettling failed:", err);
      setSettlementError(err instanceof Error ? err.message : "Skip failed");
    } finally {
      isSettlingRef.current = false;
    }
  };

  // Settlement Step 1: Submit settlement price
  const handleSettle = async () => {
    if (!isOwner || !settlementPriceInput || isSettlingRef.current) return;
    isSettlingRef.current = true;
    setSettlementStep(1);
    setSettlementError(null);
    try {
      const price = BigInt(settlementPriceInput);
      const hash = await writeContractAsync({
        ...pricePredictionContract,
        functionName: "settle",
        args: [BigInt(roundId), price],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      refetchSummary();
      refetchRoundData();
      setSettlementStep(0);
    } catch (err) {
      console.error("Settle failed:", err);
      setSettlementError(err instanceof Error ? err.message : "Settle failed");
      setSettlementStep(0);
    } finally {
      isSettlingRef.current = false;
    }
  };

  // Settlement Step 2: Reveal all predictions (makePubliclyDecryptable)
  const handleRevealAll = useCallback(async () => {
    if (!isOwner || isSettlingRef.current || !publicClient) return;
    isSettlingRef.current = true;
    setSettlementStep(2);
    setSettlementError(null);
    try {
      const hash = await writeContractAsync({
        ...pricePredictionContract,
        functionName: "revealAll",
        args: [BigInt(roundId)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Parse BatchRevealed event to get handles
      const events = parseEventLogs({
        abi: pricePredictionContract.abi,
        logs: receipt.logs,
        eventName: "BatchRevealed",
      });
      
      if (events.length > 0) {
        const handles = events[0].args.handles as string[];
        setRevealedHandles(handles.filter(h => h !== "0x0000000000000000000000000000000000000000000000000000000000000000"));
        console.log("[RevealAll] Got handles:", handles.length);
      }
      
      refetchSummary();
      refetchRoundData();
      setSettlementStep(0);
    } catch (err) {
      console.error("RevealAll failed:", err);
      setSettlementError(err instanceof Error ? err.message : "RevealAll failed");
      setSettlementStep(0);
    } finally {
      isSettlingRef.current = false;
    }
  }, [isOwner, publicClient, writeContractAsync, roundId, refetchSummary, refetchRoundData]);

  // Settlement Step 3: Verify all winners (publicDecrypt + checkSignatures)
  const handleVerifyAll = useCallback(async () => {
    if (!isOwner || !instance || isSettlingRef.current || !publicClient) {
      console.log("[VerifyAll] Precondition failed:", { isOwner, hasInstance: !!instance, isSettling: isSettlingRef.current, hasPublicClient: !!publicClient });
      return;
    }
    isSettlingRef.current = true;
    setSettlementStep(3);
    setSettlementError(null);
    try {
      console.log("[VerifyAll] Step 1: Getting participants...");
      const participantsData = await publicClient.readContract({
        ...pricePredictionContract,
        functionName: "getParticipants",
        args: [BigInt(roundId)],
      }) as string[];
      console.log("[VerifyAll] Participants:", participantsData.length);
      
      console.log("[VerifyAll] Step 2: Getting handles...");
      const handles: string[] = [];
      for (const participant of participantsData) {
        const pred = await publicClient.readContract({
          ...pricePredictionContract,
          functionName: "getPrediction",
          args: [BigInt(roundId), participant as `0x${string}`],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;
        const handle = pred[5] as string;
        if (handle && handle !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          handles.push(handle);
        }
      }
      
      console.log("[VerifyAll] Handles to decrypt:", handles.length, handles);
      
      if (handles.length === 0) {
        throw new Error("No handles to decrypt");
      }
      
      console.log("[VerifyAll] Step 3: Calling publicDecrypt...");
      setSettlementError("Calling Relayer for decryption... (may take 30-60s)");
      
      // Add timeout for publicDecrypt
      const decryptPromise = (async () => {
        try {
          const result = await (instance as unknown as { publicDecrypt: (h: string[]) => Promise<{
            clearValues: Record<string, bigint | string | number>;
            abiEncodedClearValues: string;
            decryptionProof: string;
          }> }).publicDecrypt(handles);
          return result;
        } catch (err) {
          console.error("[VerifyAll] publicDecrypt inner error:", err);
          throw err;
        }
      })();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("publicDecrypt timeout (90s) - Relayer may be slow")), 90000)
      );
      
      const decryptResult = await Promise.race([decryptPromise, timeoutPromise]) as {
        clearValues: Record<string, bigint | string | number>;
        abiEncodedClearValues: string;
        decryptionProof: string;
      };
      
      setSettlementError(null);
      
      console.log("[VerifyAll] Decrypt result:", decryptResult);
      
      if (!decryptResult.abiEncodedClearValues || !decryptResult.decryptionProof) {
        throw new Error("Invalid decrypt result: missing fields");
      }
      
      // Log clear values for debugging
      console.log("[VerifyAll] Clear values:", decryptResult.clearValues);
      console.log("[VerifyAll] ABI encoded:", decryptResult.abiEncodedClearValues);
      
      console.log("[VerifyAll] Step 4: Submitting to contract...");
      const hash = await writeContractAsync({
        ...pricePredictionContract,
        functionName: "verifyAll",
        args: [
          BigInt(roundId),
          handles as `0x${string}`[],
          decryptResult.abiEncodedClearValues as `0x${string}`,
          decryptResult.decryptionProof as `0x${string}`,
        ],
      });
      console.log("[VerifyAll] TX hash:", hash);
      await publicClient.waitForTransactionReceipt({ hash });
      
      console.log("[VerifyAll] Done!");
      refetchSummary();
      refetchRoundData();
      setSettlementStep(0);
    } catch (err) {
      console.error("[VerifyAll] Failed:", err);
      const msg = err instanceof Error ? err.message : "VerifyAll failed";
      setSettlementError(msg.length > 100 ? msg.slice(0, 100) + "..." : msg);
      setSettlementStep(0);
    } finally {
      isSettlingRef.current = false;
    }
  }, [isOwner, instance, publicClient, writeContractAsync, roundId, refetchSummary, refetchRoundData]);

  const getStatusColor = (s: RoundStatus) => {
    switch (s) {
      case RoundStatus.Predicting: return "text-emerald-400 bg-emerald-500/10";
      case RoundStatus.Locked: return "text-amber-400 bg-amber-500/10";
      case RoundStatus.Settling: return "text-indigo-400 bg-indigo-500/10";
      case RoundStatus.Distributing: return "text-pink-400 bg-pink-500/10";
      default: return "text-slate-400 bg-slate-500/10";
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-12 px-4 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.push("/predict")}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Rounds
          </button>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Left: Round Info (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Round Header */}
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700 shadow-xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-indigo-400 text-xs font-bold tracking-wider mb-1 uppercase">Round #{Number(roundId) + 1}</div>
                    <h1 className="text-2xl font-bold text-white">{roundName}</h1>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <span>by</span>
                      <span className="font-mono text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded">{creator ? `${creator.slice(0, 6)}...${creator.slice(-4)}` : "..."}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(status).replace("text-", "border-").replace("bg-", "text-")}`}>
                    {RoundStatus[status]}
                  </div>
                </div>

                {targetTime > 0 && (
                  <div className="p-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl mb-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <svg className="w-16 h-16 text-indigo-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                    </div>
                    <div className="text-white text-sm">
                      Predict <span className="font-bold text-indigo-300">{roundName}</span> closing price at <span className="font-mono font-bold text-white">{formatUTC(targetTime)}</span>, win within <span className="font-mono font-bold text-emerald-400">±${tolerance}</span>
                    </div>
                    <div className="text-xs text-amber-400 font-medium mt-1">Based on Binance Spot Price</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Pool</div>
                    <div className="text-white font-bold text-lg">{totalPool} <span className="text-sm font-normal text-slate-500">ETH</span></div>
                  </div>
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Players</div>
                    <div className="text-white font-bold text-lg">{participants}</div>
                  </div>
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Tolerance</div>
                    <div className="text-indigo-400 font-mono font-medium">±{tolerance}</div>
                  </div>
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Time Left</div>
                    <div className={`font-mono font-medium ${status === RoundStatus.Predicting ? "text-emerald-400" : "text-slate-400"}`}>
                      {status === RoundStatus.Predicting ? formatTime(predictionEndsIn) : status === RoundStatus.Locked ? formatTime(roundEndsIn) : "Ended"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Your Prediction Status (Compact) */}
              {isConnected && (
                <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700 shadow-lg">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${userActive ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`}></span>
                    Your Position
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Staked */}
                    <div className={`p-3 rounded-xl border text-center ${userActive ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-800/30 border-slate-700/50"}`}>
                      <div className={`text-[10px] uppercase tracking-wide mb-1 ${userActive ? "text-emerald-300/80" : "text-slate-500"}`}>Staked</div>
                      <div className={`font-bold text-lg ${userActive ? "text-white" : "text-slate-400"}`}>{userStake} ETH</div>
                    </div>
                    
                    {/* My Prediction */}
                    <div className={`p-3 rounded-xl border text-center ${userActive ? "bg-indigo-500/10 border-indigo-500/20" : "bg-slate-800/30 border-slate-700/50"}`}>
                      <div className={`text-[10px] uppercase tracking-wide mb-1 ${userActive ? "text-indigo-300/80" : "text-slate-500"}`}>My Prediction</div>
                      {userActive ? (
                        decryptedPrice ? (
                          <div className="font-bold text-lg text-white font-mono">${decryptedPrice}</div>
                        ) : (
                          <button
                            onClick={handleDecrypt}
                            disabled={isDecrypting || !fheReady}
                            className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                          >
                            {isDecrypting ? (
                              <>
                                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Decrypting...
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                Decrypt
                              </>
                            )}
                          </button>
                        )
                      ) : (
                        <div className="text-sm font-medium text-slate-400">-</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Settlement Info - Always visible */}
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700 shadow-lg">
                <h3 className="text-sm font-semibold text-white mb-3">Settlement Result</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Final Price */}
                  <div className={`p-3 rounded-xl border text-center ${settlementPrice > 0 ? "bg-indigo-500/10 border-indigo-500/20" : "bg-slate-800/30 border-slate-700/50"}`}>
                    <div className={`text-[10px] uppercase tracking-wide mb-1 ${settlementPrice > 0 ? "text-indigo-300" : "text-slate-500"}`}>Final Price</div>
                    {settlementPrice > 0 ? (
                      <div className="text-lg font-bold text-white">${settlementPrice}</div>
                    ) : (
                      <div className="text-sm text-slate-400">
                        {status === RoundStatus.Predicting && "Predicting..."}
                        {status === RoundStatus.Locked && "Locked"}
                        {status === RoundStatus.Settling && "Awaiting"}
                        {status >= RoundStatus.Revealed && "Pending"}
                      </div>
                    )}
                  </div>
                  {/* Winners */}
                  <div className={`p-3 rounded-xl border text-center ${roundVerified ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-800/30 border-slate-700/50"}`}>
                    <div className={`text-[10px] uppercase tracking-wide mb-1 ${roundVerified ? "text-emerald-300" : "text-slate-500"}`}>Winners</div>
                    {roundVerified ? (
                      <div className="text-lg font-bold text-white">{winnerCount}</div>
                    ) : roundSettled && !roundRevealed ? (
                      <div className="text-xs text-amber-400">Awaiting Reveal</div>
                    ) : roundRevealed && !roundVerified ? (
                      <div className="text-xs text-amber-400">Awaiting Verify</div>
                    ) : (
                      <div className="text-sm text-slate-400">-</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin: Skip to Settling (Demo) */}
              {isOwner && (status === RoundStatus.Predicting || status === RoundStatus.Locked) && (
                <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/20 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/30 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                        Demo Mode
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Skip time waiting for demo</p>
                    </div>
                    <button
                      onClick={handleForceSettling}
                      disabled={isSettlingRef.current}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all"
                    >
                      Skip to Settling
                    </button>
                  </div>
                  {settlementError && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                      {settlementError}
                    </div>
                  )}
                </div>
              )}

              {/* Admin Panel - Only for owner */}
              {isOwner && status >= RoundStatus.Settling && (
                <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/20 backdrop-blur-sm rounded-2xl p-5 border border-amber-500/30 shadow-lg">
                  <h3 className="text-sm font-semibold text-amber-300 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin Settlement
                  </h3>

                  {settlementError && (
                    <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                      {settlementError}
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Step 1: Settle */}
                    <div className={`p-3 rounded-xl border ${roundSettled ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-900/50 border-slate-700"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-white">Step 1: Submit Settlement Price</span>
                        {roundSettled && <span className="text-[10px] text-emerald-400 font-bold">DONE</span>}
                      </div>
                      {!roundSettled ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={settlementPriceInput}
                            onChange={(e) => setSettlementPriceInput(e.target.value)}
                            placeholder="Final price (USD)"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-amber-500 outline-none"
                          />
                          <button
                            onClick={handleSettle}
                            disabled={settlementStep !== 0 || !settlementPriceInput}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all"
                          >
                            {settlementStep === 1 ? (<><svg className="animate-spin h-3 w-3 mr-1 inline" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Settling...</>) : "Settle"}
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">Settlement price: <span className="text-white font-mono">${settlementPrice}</span></div>
                      )}
                    </div>

                    {/* Step 2: Reveal */}
                    <div className={`p-3 rounded-xl border ${roundRevealed ? "bg-emerald-500/10 border-emerald-500/20" : roundSettled ? "bg-slate-900/50 border-slate-700" : "bg-slate-900/30 border-slate-800 opacity-50"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-white">Step 2: Reveal Predictions</span>
                        {roundRevealed && <span className="text-[10px] text-emerald-400 font-bold">DONE</span>}
                      </div>
                      {!roundRevealed ? (
                        <button
                          onClick={handleRevealAll}
                          disabled={!roundSettled || settlementStep !== 0}
                          className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all"
                        >
                          {settlementStep === 2 ? (<><svg className="animate-spin h-3 w-3 mr-1 inline" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Revealing...</>) : "Reveal All"}
                        </button>
                      ) : (
                        <div className="text-xs text-slate-400">All predictions revealed ({revealedHandles.length || participants} handles)</div>
                      )}
                    </div>

                    {/* Step 3: Verify */}
                    <div className={`p-3 rounded-xl border ${roundVerified ? "bg-emerald-500/10 border-emerald-500/20" : roundRevealed ? "bg-slate-900/50 border-slate-700" : "bg-slate-900/30 border-slate-800 opacity-50"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-white">Step 3: Verify Winners</span>
                        {roundVerified && <span className="text-[10px] text-emerald-400 font-bold">DONE</span>}
                      </div>
                      {!roundVerified ? (
                        <button
                          onClick={handleVerifyAll}
                          disabled={!roundRevealed || settlementStep !== 0 || !fheReady}
                          className="w-full px-4 py-2 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all"
                        >
                          {settlementStep === 3 ? (<><svg className="animate-spin h-3 w-3 mr-1 inline" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Verifying...</>) : "Verify All"}
                        </button>
                      ) : (
                        <div className="text-xs text-slate-400">Winners verified: <span className="text-emerald-400 font-bold">{winnerCount}</span></div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Actions Console (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              {/* Card 1: Submit Prediction */}
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="p-3 border-b border-slate-800 bg-slate-950/30">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Submit Prediction
                  </h2>
                </div>
                <div className="p-3">
                  <div className="space-y-2">
                    <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-800">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Prediction Price (USD)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={predictionPrice}
                          onChange={(e) => setPredictionPrice(e.target.value)}
                          disabled={!isConnected || !fheReady || userActive || status !== RoundStatus.Predicting}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none pl-7 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter price"
                        />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</div>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-slate-500">
                        <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Encrypted before submission
                      </div>
                    </div>
                    <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-800">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Stake Amount (ETH)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(e.target.value)}
                          disabled={!isConnected || !fheReady || userActive || status !== RoundStatus.Predicting}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none pr-10 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="0.001"
                          step="0.001"
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-medium">ETH</div>
                      </div>
                    </div>
                    {submitError && (
                      <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center gap-1.5">
                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {submitError}
                      </div>
                    )}
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !predictionPrice || !stakeAmount || !isConnected || !fheReady || userActive || status !== RoundStatus.Predicting}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <><svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Processing...</>
                      ) : "Submit Prediction"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Manage Prediction */}
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="p-3 border-b border-slate-800 bg-slate-950/30">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Manage Prediction
                  </h2>
                </div>
                <div className="p-3">
                  <div className="space-y-2">
                    <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-800">
                      <h4 className="text-[10px] font-medium text-white mb-1.5 flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-amber-500"></div>
                        Update Price
                      </h4>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          disabled={!isConnected || !userActive || status !== RoundStatus.Predicting}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-amber-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="New price"
                        />
                        <button
                          onClick={handleUpdatePrice}
                          disabled={isSubmitting || !newPrice || !isConnected || !userActive || status !== RoundStatus.Predicting}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-lg transition-all"
                        >
                          {isSubmitting ? "..." : "Update"}
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-950/50 rounded-lg p-2.5 border border-slate-800">
                      <h4 className="text-[10px] font-medium text-white mb-1.5 flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                        Add Stake
                      </h4>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={addStakeAmount}
                          onChange={(e) => setAddStakeAmount(e.target.value)}
                          disabled={!isConnected || !userActive || status !== RoundStatus.Predicting}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Amount"
                          step="0.001"
                        />
                        <button
                          onClick={handleAddStake}
                          disabled={isSubmitting || !addStakeAmount || !isConnected || !userActive || status !== RoundStatus.Predicting}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-lg transition-all"
                        >
                          {isSubmitting ? "..." : "Add"}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleWithdraw}
                      disabled={isSubmitting || !isConnected || !userActive || status !== RoundStatus.Predicting}
                      className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all text-[10px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Withdraw & Cancel
                    </button>
                    <p className="text-center text-[9px] text-slate-500">Only available during prediction period</p>
                  </div>
                </div>
              </div>

              {/* Card 3: Winner Card (stays visible after claiming) */}
              {userVerified && (
                <div className={`bg-slate-900/80 backdrop-blur-sm rounded-2xl border shadow-xl overflow-hidden ${userClaimed ? "border-emerald-500/30" : "border-pink-500/30"}`}>
                  <div className="p-4 text-center">
                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${userClaimed ? "bg-emerald-500/20" : "bg-pink-500/20 animate-bounce"}`}>
                      {userClaimed ? (
                        <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ) : (
                        <svg className="w-6 h-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">
                      {userClaimed ? "Reward Claimed!" : "You Won!"}
                    </h3>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 mb-3 inline-block">
                      <div className="text-[9px] text-slate-500 uppercase">Reward</div>
                      <div className={`text-lg font-bold ${userClaimed ? "text-emerald-400" : "text-pink-400"}`}>{potentialReward} ETH</div>
                    </div>
                    {userClaimed ? (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Successfully claimed
                      </div>
                    ) : (
                      <button
                        onClick={handleClaimReward}
                        disabled={isSubmitting}
                        className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg transition-all text-xs"
                      >
                        {isSubmitting ? "Claiming..." : "Claim Reward"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Card 3c: Lost (user participated but didn't win) */}
              {roundVerified && userActive && !userVerified && (
                <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-600/30 shadow-xl overflow-hidden">
                  <div className="p-4 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-700/50 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">Not This Time</h3>
                    <p className="text-xs text-slate-400 mb-2">Your prediction was outside the tolerance range.</p>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 inline-block">
                      <div className="text-[9px] text-slate-500 uppercase">Your Stake</div>
                      <div className="text-sm font-bold text-slate-300">{userStake} ETH</div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">Better luck next round!</p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Fixed Timeline on Left */}
        <div className="hidden xl:block fixed left-[calc(50%-720px)] top-1/2 -translate-y-1/2">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-4 font-semibold">Timeline</div>
          <div className="relative">
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-700"></div>
            <div className="space-y-6">
              {[
                { step: "1", title: "Prediction", duration: "0-48h", active: status === RoundStatus.Predicting },
                { step: "2", title: "Locked", duration: "48-72h", active: status === RoundStatus.Locked },
                { step: "3", title: "Settlement", duration: "72h+", active: status === RoundStatus.Settling || status === RoundStatus.Revealed },
                { step: "4", title: "Claiming", duration: "7 days", active: status === RoundStatus.Distributing },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 ${item.active ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "bg-slate-800 text-slate-500"}`}>
                    {item.step}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${item.active ? "text-white" : "text-slate-400"}`}>{item.title}</div>
                    <div className={`text-xs font-mono ${item.active ? "text-indigo-400" : "text-slate-500"}`}>{item.duration}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
