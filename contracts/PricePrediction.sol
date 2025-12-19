// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PricePrediction - FHE-based price prediction with encrypted guesses
/// @notice Users submit encrypted price predictions with ETH stakes, winners split the pool
contract PricePrediction is ZamaEthereumConfig {
    // Round status
    enum RoundStatus {
        Betting, // 0-48h: can predict, update, add stake, withdraw
        Locked, // 48-72h: locked, no operations allowed
        Settling, // 72h+: waiting for settlement price
        Revealed, // admin revealed all predictions
        Distributing, // admin verified winners, users can claim
        Finished // claim deadline passed
    }

    // Round info
    struct Round {
        string name; // round name
        address creator; // round creator
        uint256 targetTime; // prediction target time (must be in lock period)
        uint256 startTime;
        uint256 lockTime; // startTime + 48h
        uint256 endTime; // startTime + 72h
        uint256 claimDeadline; // verified + 7 days
        uint64 tolerance; // price tolerance for winning
        uint64 settlementPrice; // final settlement price
        uint256 totalPool; // total ETH staked
        uint256 winnerCount; // verified winners count
        uint256 winnerPool; // total stake from winners
        bool settled; // settlement price submitted
        bool revealed; // all predictions revealed
        bool verified; // all winners verified
    }

    // Prediction info
    struct Prediction {
        euint64 encryptedPrice; // encrypted prediction price
        uint256 stake; // ETH staked
        bool active; // is active
        bool revealed; // has revealed (makePubliclyDecryptable called)
        bool verified; // verified as winner
        bool claimed; // reward claimed
        bytes32 priceHandle; // handle for decryption verification
    }

    address public owner;
    uint256 public roundCount;

    uint256 public constant MIN_STAKE = 0.001 ether;
    uint256 public constant BETTING_DURATION = 48 hours;
    uint256 public constant ROUND_DURATION = 72 hours;
    uint256 public constant CLAIM_PERIOD = 7 days;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => Prediction)) private predictions;
    mapping(uint256 => address[]) private roundParticipants;

    // Events
    event RoundCreated(
        uint256 indexed roundId,
        string name,
        address indexed creator,
        uint256 targetTime,
        uint64 tolerance,
        uint256 startTime,
        uint256 endTime
    );
    event PredictionSubmitted(uint256 indexed roundId, address indexed user, uint256 stake);
    event PredictionUpdated(uint256 indexed roundId, address indexed user);
    event StakeAdded(uint256 indexed roundId, address indexed user, uint256 amount);
    event PredictionWithdrawn(uint256 indexed roundId, address indexed user, uint256 amount);
    event RoundSettled(uint256 indexed roundId, uint64 settlementPrice);
    event BatchRevealed(uint256 indexed roundId, uint256 count, bytes32[] handles);
    event BatchVerified(uint256 indexed roundId, uint256 winnerCount);
    event WinnerVerified(uint256 indexed roundId, address indexed user);
    event RewardClaimed(uint256 indexed roundId, address indexed user, uint256 reward);
    event RewardsDistributed(uint256 indexed roundId, uint256 winnerCount, uint256 rewardPerWinner);
    event UnclaimedRefunded(uint256 indexed roundId, uint256 amount);

    // Errors
    error NotOwner();
    error InvalidAmount();
    error InvalidTolerance();
    error RoundNotBetting();
    error RoundNotSettling();
    error RoundNotRevealed();
    error RoundNotDistributing();
    error RoundNotFinished();
    error NotSettled();
    error AlreadyRevealed();
    error AlreadyVerified();
    error AlreadyPredicted();
    error NoPrediction();
    error AlreadyClaimed();
    error NotWinner();
    error ClaimExpired();
    error TransferFailed();
    error RoundNotEnded();
    error AlreadySettled();
    error AlreadyDistributed();
    error NoWinners();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Get round current status
    function getRoundStatus(uint256 roundId) public view returns (RoundStatus) {
        Round storage round = rounds[roundId];
        if (round.startTime == 0) return RoundStatus.Betting;

        if (block.timestamp < round.lockTime) {
            return RoundStatus.Betting;
        } else if (block.timestamp < round.endTime) {
            return RoundStatus.Locked;
        } else if (!round.settled) {
            return RoundStatus.Settling;
        } else if (!round.revealed) {
            return RoundStatus.Revealed;
        } else if (!round.verified) {
            return RoundStatus.Distributing;
        } else if (block.timestamp < round.claimDeadline) {
            return RoundStatus.Distributing;
        } else {
            return RoundStatus.Finished;
        }
    }

    /// @notice Create a new prediction round (anyone can create)
    /// @param name Round name
    /// @param targetTime Prediction target time (must be in lock period: 48-72h from now)
    /// @param tolerance Price tolerance for winning (e.g., 100 means ±100)
    function createRound(
        string calldata name,
        uint256 targetTime,
        uint64 tolerance
    ) external returns (uint256 roundId) {
        if (tolerance == 0) revert InvalidTolerance();
        if (bytes(name).length == 0 || bytes(name).length > 64) revert InvalidAmount();

        uint256 startTime = block.timestamp;
        uint256 lockTime = startTime + BETTING_DURATION;
        uint256 endTime = startTime + ROUND_DURATION;

        // targetTime must be within lock period (48h - 72h from now)
        if (targetTime < lockTime || targetTime > endTime) revert InvalidAmount();

        roundId = roundCount++;

        rounds[roundId] = Round({
            name: name,
            creator: msg.sender,
            targetTime: targetTime,
            startTime: startTime,
            lockTime: lockTime,
            endTime: endTime,
            claimDeadline: 0, // set when verified
            tolerance: tolerance,
            settlementPrice: 0,
            totalPool: 0,
            winnerCount: 0,
            winnerPool: 0,
            settled: false,
            revealed: false,
            verified: false
        });

        emit RoundCreated(roundId, name, msg.sender, targetTime, tolerance, startTime, endTime);
    }

    /// @notice Submit encrypted price prediction with ETH stake
    function submitPrediction(
        uint256 roundId,
        externalEuint64 encryptedPrice,
        bytes calldata inputProof
    ) external payable {
        if (msg.value < MIN_STAKE) revert InvalidAmount();
        if (getRoundStatus(roundId) != RoundStatus.Betting) revert RoundNotBetting();
        if (predictions[roundId][msg.sender].active) revert AlreadyPredicted();

        euint64 price = FHE.fromExternal(encryptedPrice, inputProof);
        FHE.allowThis(price);
        FHE.allow(price, msg.sender); // allow user to decrypt their own prediction

        bytes32 handle = euint64.unwrap(price);

        predictions[roundId][msg.sender] = Prediction({
            encryptedPrice: price,
            stake: msg.value,
            active: true,
            revealed: false,
            verified: false,
            claimed: false,
            priceHandle: handle
        });

        rounds[roundId].totalPool += msg.value;
        roundParticipants[roundId].push(msg.sender);

        emit PredictionSubmitted(roundId, msg.sender, msg.value);
    }

    /// @notice Update prediction price (betting period only)
    function updatePrediction(uint256 roundId, externalEuint64 newEncryptedPrice, bytes calldata inputProof) external {
        if (getRoundStatus(roundId) != RoundStatus.Betting) revert RoundNotBetting();
        if (!predictions[roundId][msg.sender].active) revert NoPrediction();

        euint64 price = FHE.fromExternal(newEncryptedPrice, inputProof);
        FHE.allowThis(price);
        FHE.allow(price, msg.sender);

        predictions[roundId][msg.sender].encryptedPrice = price;
        predictions[roundId][msg.sender].priceHandle = euint64.unwrap(price);

        emit PredictionUpdated(roundId, msg.sender);
    }

    /// @notice Add more stake to existing prediction (betting period only)
    function addStake(uint256 roundId) external payable {
        if (msg.value == 0) revert InvalidAmount();
        if (getRoundStatus(roundId) != RoundStatus.Betting) revert RoundNotBetting();
        if (!predictions[roundId][msg.sender].active) revert NoPrediction();

        predictions[roundId][msg.sender].stake += msg.value;
        rounds[roundId].totalPool += msg.value;

        emit StakeAdded(roundId, msg.sender, msg.value);
    }

    /// @notice Withdraw prediction and get refund (betting period only)
    function withdrawPrediction(uint256 roundId) external {
        if (getRoundStatus(roundId) != RoundStatus.Betting) revert RoundNotBetting();
        Prediction storage pred = predictions[roundId][msg.sender];
        if (!pred.active) revert NoPrediction();

        uint256 refund = pred.stake;
        rounds[roundId].totalPool -= refund;

        pred.active = false;
        pred.stake = 0;

        (bool success, ) = payable(msg.sender).call{value: refund}("");
        if (!success) revert TransferFailed();

        emit PredictionWithdrawn(roundId, msg.sender, refund);
    }

    /// @notice Settle round with final price (owner only, after round ends)
    function settle(uint256 roundId, uint64 settlementPrice) external onlyOwner {
        Round storage round = rounds[roundId];
        if (block.timestamp < round.endTime) revert RoundNotEnded();
        if (round.settled) revert AlreadySettled();

        round.settlementPrice = settlementPrice;
        round.settled = true;

        emit RoundSettled(roundId, settlementPrice);
    }

    /// @notice Admin Step 1/2: Reveal all predictions (make publicly decryptable)
    function revealAll(uint256 roundId) external onlyOwner returns (bytes32[] memory handles) {
        Round storage round = rounds[roundId];
        if (!round.settled) revert NotSettled();
        if (round.revealed) revert AlreadyRevealed();

        address[] memory participants = roundParticipants[roundId];
        uint256 len = participants.length;
        handles = new bytes32[](len);

        for (uint256 i = 0; i < len; i++) {
            Prediction storage pred = predictions[roundId][participants[i]];
            if (pred.active) {
                FHE.makePubliclyDecryptable(pred.encryptedPrice);
                handles[i] = pred.priceHandle;
            }
        }

        round.revealed = true;
        emit BatchRevealed(roundId, len, handles);
    }

    /// @notice Admin Step 2/2: Verify all winners with decryption proofs
    function verifyAll(
        uint256 roundId,
        bytes32[] calldata handlesList,
        bytes calldata cleartexts,
        bytes calldata decryptionProof
    ) external onlyOwner {
        Round storage round = rounds[roundId];
        if (!round.revealed) revert RoundNotRevealed();
        if (round.verified) revert AlreadyVerified();

        // Verify all signatures at once
        FHE.checkSignatures(handlesList, cleartexts, decryptionProof);

        // Decode all clear prices
        uint64[] memory clearPrices = abi.decode(cleartexts, (uint64[]));
        address[] memory participants = roundParticipants[roundId];

        uint64 settlement = round.settlementPrice;
        uint64 tolerance = round.tolerance;

        for (uint256 i = 0; i < participants.length; i++) {
            Prediction storage pred = predictions[roundId][participants[i]];
            if (!pred.active) continue;

            uint64 clearPrice = clearPrices[i];

            // Check if within tolerance
            bool isHit;
            if (clearPrice >= settlement) {
                isHit = (clearPrice - settlement) <= tolerance;
            } else {
                isHit = (settlement - clearPrice) <= tolerance;
            }

            if (isHit) {
                pred.verified = true;
                round.winnerCount++;
                round.winnerPool += pred.stake;
                emit WinnerVerified(roundId, participants[i]);
            }
        }

        round.verified = true;
        round.claimDeadline = block.timestamp + CLAIM_PERIOD;

        emit BatchVerified(roundId, round.winnerCount);
    }

    /// @notice Step 3/3: Claim reward (after verify deadline, winners split pool equally)
    function claimReward(uint256 roundId) external {
        Round storage round = rounds[roundId];
        RoundStatus status = getRoundStatus(roundId);

        if (status != RoundStatus.Distributing) {
            revert RoundNotDistributing();
        }

        Prediction storage pred = predictions[roundId][msg.sender];
        if (!pred.verified) revert NotWinner();
        if (pred.claimed) revert AlreadyClaimed();

        pred.claimed = true;

        // Calculate reward: proportional to stake
        uint256 reward = (round.totalPool * pred.stake) / round.winnerPool;

        (bool success, ) = payable(msg.sender).call{value: reward}("");
        if (!success) revert TransferFailed();

        emit RewardClaimed(roundId, msg.sender, reward);
    }

    /// @notice Refund unclaimed rewards to owner (after claim deadline)
    function refundUnclaimed(uint256 roundId) external onlyOwner {
        if (getRoundStatus(roundId) != RoundStatus.Finished) revert RoundNotFinished();

        // Calculate remaining balance for this round
        uint256 remaining = address(this).balance;

        if (remaining > 0) {
            (bool success, ) = payable(owner).call{value: remaining}("");
            if (!success) revert TransferFailed();

            emit UnclaimedRefunded(roundId, remaining);
        }
    }

    // ============ View Functions ============

    /// @notice Get user's prediction info
    function getPrediction(
        uint256 roundId,
        address user
    )
        external
        view
        returns (uint256 stake, bool active, bool revealed, bool verified, bool claimed, bytes32 priceHandle)
    {
        Prediction storage pred = predictions[roundId][user];
        return (pred.stake, pred.active, pred.revealed, pred.verified, pred.claimed, pred.priceHandle);
    }

    /// @notice Get round participants
    function getParticipants(uint256 roundId) external view returns (address[] memory) {
        return roundParticipants[roundId];
    }

    /// @notice Get participant count
    function getParticipantCount(uint256 roundId) external view returns (uint256) {
        return roundParticipants[roundId].length;
    }

    /// @notice Get round info
    function getRoundInfo(
        uint256 roundId
    )
        external
        view
        returns (
            string memory name,
            address creator,
            uint256 targetTime,
            uint256 startTime,
            uint256 lockTime,
            uint256 endTime,
            uint256 claimDeadline,
            uint64 tolerance,
            uint64 settlementPrice,
            uint256 totalPool,
            uint256 winnerCount,
            bool settled,
            RoundStatus status
        )
    {
        Round storage round = rounds[roundId];
        return (
            round.name,
            round.creator,
            round.targetTime,
            round.startTime,
            round.lockTime,
            round.endTime,
            round.claimDeadline,
            round.tolerance,
            round.settlementPrice,
            round.totalPool,
            round.winnerCount,
            round.settled,
            getRoundStatus(roundId)
        );
    }

    /// @notice Calculate potential reward for a winner (proportional to stake)
    function calculateReward(uint256 roundId, address user) external view returns (uint256) {
        Round storage round = rounds[roundId];
        Prediction storage pred = predictions[roundId][user];

        if (!pred.verified || round.winnerPool == 0) return 0;

        return (round.totalPool * pred.stake) / round.winnerPool;
    }

    /// @notice Get time remaining for current phase
    function getTimeRemaining(uint256 roundId) external view returns (string memory phase, uint256 remaining) {
        Round storage round = rounds[roundId];
        RoundStatus status = getRoundStatus(roundId);

        if (status == RoundStatus.Betting) {
            return ("Betting", round.lockTime - block.timestamp);
        } else if (status == RoundStatus.Locked) {
            return ("Locked", round.endTime - block.timestamp);
        } else if (status == RoundStatus.Settling) {
            return ("Awaiting Settlement", 0);
        } else if (status == RoundStatus.Revealed) {
            return ("Awaiting Verification", 0);
        } else if (status == RoundStatus.Distributing) {
            return ("Distributing", round.claimDeadline - block.timestamp);
        } else {
            return ("Finished", 0);
        }
    }

    /// @notice Check if user can claim reward
    function canClaim(uint256 roundId, address user) external view returns (bool) {
        Prediction storage pred = predictions[roundId][user];
        return pred.verified && !pred.claimed;
    }

    /// @notice Get all participants with their stakes
    function getAllStakes(
        uint256 roundId
    ) external view returns (address[] memory participants, uint256[] memory stakes) {
        participants = roundParticipants[roundId];
        uint256 len = participants.length;
        stakes = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            stakes[i] = predictions[roundId][participants[i]].stake;
        }
    }

    /// @notice Get user's prediction handle for private decryption
    function getMyPredictionHandle(uint256 roundId) external view returns (bytes32) {
        return predictions[roundId][msg.sender].priceHandle;
    }

    /// @notice Get round summary for frontend
    function getRoundSummary(
        uint256 roundId
    )
        external
        view
        returns (
            string memory name,
            address creator,
            uint256 targetTime,
            RoundStatus status,
            uint64 tolerance,
            uint64 settlementPrice,
            uint256 totalPool,
            uint256 participantCount,
            uint256 winnerCount,
            uint256 winnerPool,
            uint256 bettingEndsIn,
            uint256 roundEndsIn
        )
    {
        Round storage round = rounds[roundId];
        name = round.name;
        creator = round.creator;
        targetTime = round.targetTime;
        status = getRoundStatus(roundId);
        tolerance = round.tolerance;
        settlementPrice = round.settlementPrice;
        totalPool = round.totalPool;
        participantCount = roundParticipants[roundId].length;
        winnerCount = round.winnerCount;
        winnerPool = round.winnerPool;

        if (block.timestamp < round.lockTime) {
            bettingEndsIn = round.lockTime - block.timestamp;
        }
        if (block.timestamp < round.endTime) {
            roundEndsIn = round.endTime - block.timestamp;
        }
    }

    // Receive ETH
    receive() external payable {}
}
