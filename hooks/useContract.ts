"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { pricePredictionContract } from "@/config/contracts";
import { parseEther } from "viem";

// Read round info
export function useRoundInfo(roundId: bigint) {
  return useReadContract({
    ...pricePredictionContract,
    functionName: "getRoundInfo",
    args: [roundId],
  });
}

// Read round summary
export function useRoundSummary(roundId: bigint) {
  return useReadContract({
    ...pricePredictionContract,
    functionName: "getRoundSummary",
    args: [roundId],
  });
}

// Read round status
export function useRoundStatus(roundId: bigint) {
  return useReadContract({
    ...pricePredictionContract,
    functionName: "getRoundStatus",
    args: [roundId],
  });
}

// Read round count
export function useRoundCount() {
  return useReadContract({
    ...pricePredictionContract,
    functionName: "roundCount",
  });
}

// Read user prediction
export function usePrediction(roundId: bigint, userAddress: `0x${string}` | undefined) {
  return useReadContract({
    ...pricePredictionContract,
    functionName: "getPrediction",
    args: userAddress ? [roundId, userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });
}

// Read all stakes
export function useAllStakes(roundId: bigint) {
  return useReadContract({
    ...pricePredictionContract,
    functionName: "getAllStakes",
    args: [roundId],
  });
}

// Read time remaining
export function useTimeRemaining(roundId: bigint) {
  return useReadContract({
    ...pricePredictionContract,
    functionName: "getTimeRemaining",
    args: [roundId],
  });
}

// Read can claim
export function useCanClaim(roundId: bigint, userAddress: `0x${string}` | undefined) {
  return useReadContract({
    ...pricePredictionContract,
    functionName: "canClaim",
    args: userAddress ? [roundId, userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });
}

// Read calculate reward
export function useCalculateReward(roundId: bigint, userAddress: `0x${string}` | undefined) {
  return useReadContract({
    ...pricePredictionContract,
    functionName: "calculateReward",
    args: userAddress ? [roundId, userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });
}

// Write: Submit prediction
export function useSubmitPrediction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const submitPrediction = (
    roundId: bigint,
    encryptedPrice: `0x${string}`,
    inputProof: `0x${string}`,
    stakeAmount: string
  ) => {
    writeContract({
      ...pricePredictionContract,
      functionName: "submitPrediction",
      args: [roundId, encryptedPrice, inputProof],
      value: parseEther(stakeAmount),
    });
  };

  return { submitPrediction, hash, isPending, isConfirming, isSuccess, error };
}

// Write: Update prediction
export function useUpdatePrediction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const updatePrediction = (
    roundId: bigint,
    encryptedPrice: `0x${string}`,
    inputProof: `0x${string}`
  ) => {
    writeContract({
      ...pricePredictionContract,
      functionName: "updatePrediction",
      args: [roundId, encryptedPrice, inputProof],
    });
  };

  return { updatePrediction, hash, isPending, isConfirming, isSuccess, error };
}

// Write: Add stake
export function useAddStake() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const addStake = (roundId: bigint, amount: string) => {
    writeContract({
      ...pricePredictionContract,
      functionName: "addStake",
      args: [roundId],
      value: parseEther(amount),
    });
  };

  return { addStake, hash, isPending, isConfirming, isSuccess, error };
}

// Write: Withdraw prediction
export function useWithdrawPrediction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const withdrawPrediction = (roundId: bigint) => {
    writeContract({
      ...pricePredictionContract,
      functionName: "withdrawPrediction",
      args: [roundId],
    });
  };

  return { withdrawPrediction, hash, isPending, isConfirming, isSuccess, error };
}

// Write: Claim reward
export function useClaimReward() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimReward = (roundId: bigint) => {
    writeContract({
      ...pricePredictionContract,
      functionName: "claimReward",
      args: [roundId],
    });
  };

  return { claimReward, hash, isPending, isConfirming, isSuccess, error };
}
