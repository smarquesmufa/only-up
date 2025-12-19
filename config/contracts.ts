import { PricePredictionABI } from "./PricePrediction.abi";
import { PRICE_PREDICTION_ADDRESS } from "./wagmi";

export const pricePredictionContract = {
  address: PRICE_PREDICTION_ADDRESS,
  abi: PricePredictionABI,
} as const;
