import { expect } from "chai";
import { ethers, fhevm, network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PricePrediction", function () {
  let contract: any;
  let contractAddress: string;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let charlie: HardhatEthersSigner;

  const MIN_STAKE = ethers.parseEther("0.001");
  const STAKE_AMOUNT = ethers.parseEther("0.01");
  const TOLERANCE = 100n; // ±100

  // Time constants (in seconds)
  const BETTING_DURATION = 48 * 60 * 60; // 48 hours
  const ROUND_DURATION = 72 * 60 * 60; // 72 hours
  const CLAIM_PERIOD = 7 * 24 * 60 * 60; // 7 days

  async function advanceTime(seconds: number) {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
  }

  beforeEach(async function () {
    [owner, alice, bob, charlie] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("PricePrediction");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
  });

  describe("Initialization", function () {
    it("should set owner correctly", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should have zero rounds initially", async function () {
      expect(await contract.roundCount()).to.equal(0);
    });

    it("should have correct constants", async function () {
      expect(await contract.MIN_STAKE()).to.equal(MIN_STAKE);
      expect(await contract.BETTING_DURATION()).to.equal(BETTING_DURATION);
      expect(await contract.ROUND_DURATION()).to.equal(ROUND_DURATION);
      expect(await contract.CLAIM_PERIOD()).to.equal(CLAIM_PERIOD);
    });
  });

  describe("Create Round", function () {
    it("should create round with correct parameters", async function () {
      await expect(contract.createRound(TOLERANCE)).to.emit(contract, "RoundCreated");

      expect(await contract.roundCount()).to.equal(1);

      const roundInfo = await contract.getRoundInfo(0);
      expect(roundInfo.tolerance).to.equal(TOLERANCE);
      expect(roundInfo.totalPool).to.equal(0);
      expect(roundInfo.settled).to.be.false;
    });

    it("should fail when non-owner creates round", async function () {
      await expect(contract.connect(alice).createRound(TOLERANCE)).to.be.revertedWithCustomError(contract, "NotOwner");
    });

    it("should fail with zero tolerance", async function () {
      await expect(contract.createRound(0)).to.be.revertedWithCustomError(contract, "InvalidTolerance");
    });
  });

  describe("Submit Prediction", function () {
    beforeEach(async function () {
      await contract.createRound(TOLERANCE);
    });

    it("should submit prediction with encrypted price", async function () {
      const predictedPrice = 1000n;

      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, alice.address)
        .add64(predictedPrice)
        .encrypt();

      await expect(
        contract
          .connect(alice)
          .submitPrediction(0, encryptedInput.handles[0], encryptedInput.inputProof, { value: STAKE_AMOUNT }),
      )
        .to.emit(contract, "PredictionSubmitted")
        .withArgs(0, alice.address, STAKE_AMOUNT);

      // Verify prediction info
      const pred = await contract.getPrediction(0, alice.address);
      expect(pred.stake).to.equal(STAKE_AMOUNT);
      expect(pred.active).to.be.true;
      expect(pred.revealed).to.be.false;
      expect(pred.verified).to.be.false;
      expect(pred.claimed).to.be.false;

      // Verify pool increased
      const roundInfo = await contract.getRoundInfo(0);
      expect(roundInfo.totalPool).to.equal(STAKE_AMOUNT);
    });

    it("should fail with insufficient stake", async function () {
      const encryptedInput = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(1000n).encrypt();

      await expect(
        contract
          .connect(alice)
          .submitPrediction(0, encryptedInput.handles[0], encryptedInput.inputProof, {
            value: ethers.parseEther("0.0001"),
          }),
      ).to.be.revertedWithCustomError(contract, "InvalidAmount");
    });

    it("should fail when already predicted", async function () {
      const encryptedInput = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(1000n).encrypt();

      await contract
        .connect(alice)
        .submitPrediction(0, encryptedInput.handles[0], encryptedInput.inputProof, { value: STAKE_AMOUNT });

      const encryptedInput2 = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(2000n).encrypt();

      await expect(
        contract
          .connect(alice)
          .submitPrediction(0, encryptedInput2.handles[0], encryptedInput2.inputProof, { value: STAKE_AMOUNT }),
      ).to.be.revertedWithCustomError(contract, "AlreadyPredicted");
    });
  });

  describe("Update Prediction", function () {
    beforeEach(async function () {
      await contract.createRound(TOLERANCE);

      const encryptedInput = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(1000n).encrypt();

      await contract
        .connect(alice)
        .submitPrediction(0, encryptedInput.handles[0], encryptedInput.inputProof, { value: STAKE_AMOUNT });
    });

    it("should update prediction price", async function () {
      const newPrice = 2000n;

      const encryptedInput = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(newPrice).encrypt();

      await expect(contract.connect(alice).updatePrediction(0, encryptedInput.handles[0], encryptedInput.inputProof))
        .to.emit(contract, "PredictionUpdated")
        .withArgs(0, alice.address);
    });

    it("should fail without active prediction", async function () {
      const encryptedInput = await fhevm.createEncryptedInput(contractAddress, bob.address).add64(2000n).encrypt();

      await expect(
        contract.connect(bob).updatePrediction(0, encryptedInput.handles[0], encryptedInput.inputProof),
      ).to.be.revertedWithCustomError(contract, "NoPrediction");
    });
  });

  describe("Add Stake", function () {
    beforeEach(async function () {
      await contract.createRound(TOLERANCE);

      const encryptedInput = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(1000n).encrypt();

      await contract
        .connect(alice)
        .submitPrediction(0, encryptedInput.handles[0], encryptedInput.inputProof, { value: STAKE_AMOUNT });
    });

    it("should add stake to existing prediction", async function () {
      const additionalStake = ethers.parseEther("0.005");

      await expect(contract.connect(alice).addStake(0, { value: additionalStake }))
        .to.emit(contract, "StakeAdded")
        .withArgs(0, alice.address, additionalStake);

      const pred = await contract.getPrediction(0, alice.address);
      expect(pred.stake).to.equal(STAKE_AMOUNT + additionalStake);

      const roundInfo = await contract.getRoundInfo(0);
      expect(roundInfo.totalPool).to.equal(STAKE_AMOUNT + additionalStake);
    });
  });

  describe("Withdraw Prediction", function () {
    beforeEach(async function () {
      await contract.createRound(TOLERANCE);

      const encryptedInput = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(1000n).encrypt();

      await contract
        .connect(alice)
        .submitPrediction(0, encryptedInput.handles[0], encryptedInput.inputProof, { value: STAKE_AMOUNT });
    });

    it("should withdraw prediction and refund", async function () {
      const balanceBefore = await ethers.provider.getBalance(alice.address);

      const tx = await contract.connect(alice).withdrawPrediction(0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(alice.address);

      // Check refund received (accounting for gas)
      expect(balanceAfter + gasUsed).to.equal(balanceBefore + STAKE_AMOUNT);

      // Check prediction deactivated
      const pred = await contract.getPrediction(0, alice.address);
      expect(pred.active).to.be.false;
      expect(pred.stake).to.equal(0);

      // Check pool decreased
      const roundInfo = await contract.getRoundInfo(0);
      expect(roundInfo.totalPool).to.equal(0);
    });
  });

  describe("Round Status Transitions", function () {
    beforeEach(async function () {
      await contract.createRound(TOLERANCE);
    });

    it("should be Betting initially", async function () {
      const status = await contract.getRoundStatus(0);
      expect(status).to.equal(0); // Betting
    });

    it("should be Locked after 48 hours", async function () {
      await advanceTime(BETTING_DURATION + 1);
      const status = await contract.getRoundStatus(0);
      expect(status).to.equal(1); // Locked
    });

    it("should be Settling after 72 hours", async function () {
      await advanceTime(ROUND_DURATION + 1);
      const status = await contract.getRoundStatus(0);
      expect(status).to.equal(2); // Settling
    });

    it("should not allow prediction during Locked period", async function () {
      await advanceTime(BETTING_DURATION + 1);

      const encryptedInput = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(1000n).encrypt();

      await expect(
        contract
          .connect(alice)
          .submitPrediction(0, encryptedInput.handles[0], encryptedInput.inputProof, { value: STAKE_AMOUNT }),
      ).to.be.revertedWithCustomError(contract, "RoundNotBetting");
    });
  });

  describe("Settlement", function () {
    beforeEach(async function () {
      await contract.createRound(TOLERANCE);

      // Alice predicts 1000
      const encryptedInput1 = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(1000n).encrypt();

      await contract
        .connect(alice)
        .submitPrediction(0, encryptedInput1.handles[0], encryptedInput1.inputProof, { value: STAKE_AMOUNT });

      // Bob predicts 1050
      const encryptedInput2 = await fhevm.createEncryptedInput(contractAddress, bob.address).add64(1050n).encrypt();

      await contract
        .connect(bob)
        .submitPrediction(0, encryptedInput2.handles[0], encryptedInput2.inputProof, { value: STAKE_AMOUNT });
    });

    it("should settle round after end time", async function () {
      await advanceTime(ROUND_DURATION + 1);

      const settlementPrice = 1000n;

      await expect(contract.settle(0, settlementPrice)).to.emit(contract, "RoundSettled").withArgs(0, settlementPrice);

      const roundInfo = await contract.getRoundInfo(0);
      expect(roundInfo.settlementPrice).to.equal(settlementPrice);
      expect(roundInfo.settled).to.be.true;
    });

    it("should fail to settle before round ends", async function () {
      await expect(contract.settle(0, 1000n)).to.be.revertedWithCustomError(contract, "RoundNotEnded");
    });

    it("should fail when non-owner settles", async function () {
      await advanceTime(ROUND_DURATION + 1);

      await expect(contract.connect(alice).settle(0, 1000n)).to.be.revertedWithCustomError(contract, "NotOwner");
    });
  });

  describe("Reveal All", function () {
    beforeEach(async function () {
      await contract.createRound(TOLERANCE);

      const encryptedInput = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(1000n).encrypt();

      await contract
        .connect(alice)
        .submitPrediction(0, encryptedInput.handles[0], encryptedInput.inputProof, { value: STAKE_AMOUNT });

      await advanceTime(ROUND_DURATION + 1);
      await contract.settle(0, 1000n);
    });

    it("should reveal all predictions", async function () {
      const tx = await contract.revealAll(0);
      const receipt = await tx.wait();

      // Check event
      const event = receipt.logs.find((log: any) => {
        try {
          return contract.interface.parseLog(log)?.name === "BatchRevealed";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;

      // Check round state
      const round = await contract.rounds(0);
      expect(round.revealed).to.be.true;
    });

    it("should fail if not settled", async function () {
      // Create new round without settling
      await contract.createRound(TOLERANCE);

      await expect(contract.revealAll(1)).to.be.revertedWithCustomError(contract, "NotSettled");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await contract.createRound(TOLERANCE);

      // Multiple participants
      const enc1 = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(1000n).encrypt();
      await contract
        .connect(alice)
        .submitPrediction(0, enc1.handles[0], enc1.inputProof, { value: ethers.parseEther("0.01") });

      const enc2 = await fhevm.createEncryptedInput(contractAddress, bob.address).add64(1050n).encrypt();
      await contract
        .connect(bob)
        .submitPrediction(0, enc2.handles[0], enc2.inputProof, { value: ethers.parseEther("0.02") });
    });

    it("should return all stakes", async function () {
      const result = await contract.getAllStakes(0);
      expect(result.participants.length).to.equal(2);
      expect(result.stakes.length).to.equal(2);
      expect(result.stakes[0]).to.equal(ethers.parseEther("0.01"));
      expect(result.stakes[1]).to.equal(ethers.parseEther("0.02"));
    });

    it("should return round summary", async function () {
      const summary = await contract.getRoundSummary(0);
      expect(summary.tolerance).to.equal(TOLERANCE);
      expect(summary.totalPool).to.equal(ethers.parseEther("0.03"));
      expect(summary.participantCount).to.equal(2);
    });

    it("should return participant count", async function () {
      expect(await contract.getParticipantCount(0)).to.equal(2);
    });

    it("should return user prediction handle", async function () {
      const handle = await contract.connect(alice).getMyPredictionHandle(0);
      expect(handle).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Full Flow Test", function () {
    it("should complete full prediction cycle", async function () {
      // 1. Create round
      await contract.createRound(TOLERANCE);

      // 2. Alice predicts 1000 (within tolerance)
      const enc1 = await fhevm.createEncryptedInput(contractAddress, alice.address).add64(1000n).encrypt();
      await contract
        .connect(alice)
        .submitPrediction(0, enc1.handles[0], enc1.inputProof, { value: ethers.parseEther("0.01") });

      // 3. Bob predicts 1500 (outside tolerance)
      const enc2 = await fhevm.createEncryptedInput(contractAddress, bob.address).add64(1500n).encrypt();
      await contract
        .connect(bob)
        .submitPrediction(0, enc2.handles[0], enc2.inputProof, { value: ethers.parseEther("0.02") });

      // 4. Advance to settling
      await advanceTime(ROUND_DURATION + 1);

      // 5. Settle with price 1050 (Alice within ±100, Bob outside)
      await contract.settle(0, 1050n);

      // 6. Reveal all
      await contract.revealAll(0);

      // 7. Check round state
      const round = await contract.rounds(0);
      expect(round.settled).to.be.true;
      expect(round.revealed).to.be.true;

      console.log("Full flow test passed!");
      console.log("Total Pool:", ethers.formatEther(round.totalPool), "ETH");
    });
  });
});
