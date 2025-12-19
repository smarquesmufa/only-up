# Only Up - Decentralized FHE Price Prediction Platform

**Only Up** is a decentralized price prediction platform powered by **FHEVM**. Users submit encrypted price predictions with ETH stakes on-chain, ensuring that no one—including the contract owner—can view predictions before settlement. This eliminates front-running, copy-trading, and market manipulation, delivering a truly fair prediction game. Winners whose predictions fall within the tolerance range split the entire ETH pool proportionally based on their stakes.

---

## Table of Contents

- [Core Value Proposition](#core-value-proposition)
- [How FHE Technology Works](#how-fhe-technology-works)
  - [Encrypted Prediction Submission](#1-encrypted-prediction-submission)
  - [Three-Step Decryption Settlement](#2-three-step-decryption-settlement-fhevm-v09)
  - [Private Viewing for Users](#3-private-viewing-for-users)
- [Round Lifecycle](#round-lifecycle)
- [Contract Architecture](#contract-architecture)
- [Core Functions](#core-functions)
- [Technical Specifications](#technical-specifications)
- [Deployment](#deployment)

---

## Core Value Proposition

| Feature | Traditional Prediction | Only Up (FHE) |
|---------|----------------------|---------------|
| **Prediction Privacy** | Visible on-chain | Fully encrypted (`euint64`) |
| **Front-running Risk** | High | Impossible |
| **Copy-trading** | Easy to detect & copy | Cannot see others' predictions |
| **Settlement Integrity** | Trust the operator | Cryptographic verification |
| **Fair Competition** | Questionable | Guaranteed by math |

### Key Benefits

- **Complete Privacy**: All predictions are stored as encrypted ciphertexts using `euint64` type. Only the user who submitted can decrypt their own prediction.
- **Anti-Manipulation**: During betting and locked phases, no one can see any prediction values—preventing whales from influencing the market.
- **Trustless Settlement**: Winners are determined through FHE cryptographic comparison, not by trusting a centralized operator.
- **Proportional Rewards**: Winners split the ETH pool proportionally based on their stake amounts.

---

## How FHE Technology Works

This project is built on **FHEVM v0.9** specification.

### 1. Encrypted Prediction Submission

```
Frontend Encryption
-------------------
1. User inputs prediction price (e.g., 3500 USDT)
2. fhevmjs generates encryption key pair
3. Price is encrypted into ciphertext
4. Ciphertext + Proof submitted to contract

On-Chain Storage
----------------
contract PricePrediction {
    struct Prediction {
        euint64 encryptedPrice;  // FHE encrypted value
        bytes32 priceHandle;     // Handle for decryption
        uint256 stake;           // ETH staked
        ...
    }
}
```

**Key Code Flow:**

```solidity
function submitPrediction(
    uint256 roundId,
    externalEuint64 encryptedPrice,
    bytes calldata inputProof
) external payable {
    // Convert external ciphertext to internal FHE type
    euint64 price = FHE.fromExternal(encryptedPrice, inputProof);
    
    // Grant contract permission to operate on this ciphertext
    FHE.allowThis(price);
    
    // Grant user permission to decrypt their own prediction
    FHE.allow(price, msg.sender);
    
    // Store the encrypted prediction
    predictions[roundId][msg.sender] = Prediction({
        encryptedPrice: price,
        priceHandle: euint64.unwrap(price),  // bytes32 handle
        ...
    });
}
```

### 2. Three-Step Decryption Settlement (FHEVM v0.9)

FHEVM v0.9 introduces a secure three-step decryption flow. This project strictly follows this specification:

```
STEP 1: settle()
(Owner submits settlement price)
---------------------------------
- Round ends (72h passed)
- Owner submits the actual market price (e.g., ETH/USDT)
- Settlement price stored as plaintext uint64
- No decryption happens yet

           |
           v

STEP 2: revealAll()
(Make predictions publicly decryptable)
---------------------------------------
for each participant:
    FHE.makePubliclyDecryptable(prediction.encryptedPrice);

- Predictions are now marked for public decryption
- Returns array of bytes32 handles for off-chain decryption
- Still encrypted at this point!

           |
           v

STEP 3: verifyAll()
(Verify decryption proofs & determine winners)
----------------------------------------------
OFF-CHAIN (Frontend/Relayer):
    const { cleartexts, proof } = await publicDecrypt(handles);

ON-CHAIN:
    FHE.checkSignatures(handles, cleartexts, proof);

    for each participant:
        if |clearPrice - settlementPrice| <= tolerance:
            mark as winner
```

**Why Three Steps?**

| Step | Purpose | Security Guarantee |
|------|---------|-------------------|
| `settle()` | Commit settlement price | Immutable reference point |
| `revealAll()` | Authorize batch decryption | Controlled release of encrypted data |
| `verifyAll()` | Cryptographic winner verification | `checkSignatures()` ensures proof validity |

**Winner Determination Logic:**

```solidity
// Within verifyAll()
uint64 clearPrice = clearPrices[i];
bool isHit;

if (clearPrice >= settlement) {
    isHit = (clearPrice - settlement) <= tolerance;
} else {
    isHit = (settlement - clearPrice) <= tolerance;
}

// Winner: |predicted - actual| <= tolerance
```

### 3. Private Viewing for Users

Users can decrypt and view their own predictions at any time:

```
User Private Decryption
-----------------------
1. Frontend calls instance.userDecrypt(handle)
2. User signs EIP-712 authorization with wallet
3. Gateway verifies signature + FHE.allow() permission
4. Decrypted value returned ONLY to the authorized user
```

This is possible because during submission:
```solidity
FHE.allow(price, msg.sender);  // Only msg.sender can decrypt
```

---

## Round Lifecycle

Each prediction round follows a strict 72-hour lifecycle:

```
Time: 0h                    48h                   72h              72h + 7d
      |<--- BETTING ------->|<--- LOCKED -------->|<-- SETTLING -->|
      |                      |                     |                |
      |  * Submit prediction |  X No operations   |  Owner:        |  FINISHED
      |  * Update prediction |  X Locked state    |  1. settle()   |
      |  * Add stake         |                     |  2. revealAll()|  Unclaimed
      |  * Withdraw          |                     |  3. verifyAll()|  refunded
      |                      |                     |                |
      |                      |   targetTime must   |  Winners:      |
      |                      |   be in this period |  claimReward() |
```

### Status Enum

```solidity
enum RoundStatus {
    Betting,      // 0-48h: Open for predictions
    Locked,       // 48-72h: No operations allowed
    Settling,     // 72h+: Waiting for settlement price
    Revealed,     // Settlement done, predictions revealed
    Distributing, // Winners verified, claims open
    Finished      // Claim deadline passed
}
```

### Time Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MIN_STAKE` | 0.001 ETH | Minimum participation stake |
| `BETTING_DURATION` | 48 hours | Open prediction window |
| `ROUND_DURATION` | 72 hours | Total round length |
| `CLAIM_PERIOD` | 7 days | Winner claim deadline |

---

## Contract Architecture

### Data Structures

**Round:**
```solidity
struct Round {
    string name;              // Round identifier
    address creator;          // Round creator
    uint256 targetTime;       // Target prediction time
    uint256 startTime;        // Round start
    uint256 lockTime;         // Betting closes (start + 48h)
    uint256 endTime;          // Round ends (start + 72h)
    uint256 claimDeadline;    // Claim expires (verified + 7d)
    uint64 tolerance;         // +/- tolerance for winning
    uint64 settlementPrice;   // Actual price at targetTime
    uint256 totalPool;        // Total ETH in pool
    uint256 winnerCount;      // Number of winners
    uint256 winnerPool;       // Total stake from winners
    bool settled;             // Settlement price submitted
    bool revealed;            // Predictions revealed
    bool verified;            // Winners determined
}
```

**Prediction:**
```solidity
struct Prediction {
    euint64 encryptedPrice;   // FHE encrypted prediction
    uint256 stake;            // ETH staked
    bool active;              // Participation status
    bool revealed;            // makePubliclyDecryptable called
    bool verified;            // Verified as winner
    bool claimed;             // Reward claimed
    bytes32 priceHandle;      // Handle for decryption
}
```

### Inheritance

```solidity
contract PricePrediction is ZamaEthereumConfig {
    // ZamaEthereumConfig provides:
    // - FHE library access
    // - Gateway configuration
    // - Network-specific settings
}
```

---

## Core Functions

### User Functions

| Function | Phase | Description |
|----------|-------|-------------|
| `submitPrediction()` | Betting | Submit encrypted prediction with ETH stake |
| `updatePrediction()` | Betting | Update prediction price (stake unchanged) |
| `addStake()` | Betting | Add more ETH to existing prediction |
| `withdrawPrediction()` | Betting | Cancel prediction and get full refund |
| `claimReward()` | Distributing | Winners claim proportional rewards |

### Owner Functions

| Function | Phase | Description |
|----------|-------|-------------|
| `createRound()` | Any | Create new prediction round |
| `settle()` | Settling | Submit settlement price |
| `revealAll()` | After settle | Make all predictions publicly decryptable |
| `verifyAll()` | After reveal | Verify decryption proofs & determine winners |
| `refundUnclaimed()` | Finished | Recover unclaimed rewards |

### View Functions

| Function | Returns |
|----------|---------|
| `getRoundStatus()` | Current phase of round |
| `getRoundInfo()` | Complete round details |
| `getRoundSummary()` | Frontend-optimized summary |
| `getPrediction()` | User's prediction details |
| `getParticipants()` | All round participants |
| `calculateReward()` | Potential reward for winner |
| `getTimeRemaining()` | Time left in current phase |
| `canClaim()` | Check if user can claim |
| `getMyPredictionHandle()` | User's handle for private decryption |

---

## Technical Specifications

### Reward Calculation

Winners receive proportional rewards based on their stake:

```solidity
reward = (totalPool * userStake) / winnerPool
```

**Example:**
- Total Pool: 10 ETH
- Winner A stake: 1 ETH
- Winner B stake: 4 ETH
- Winner Pool: 5 ETH

| Winner | Stake | Reward |
|--------|-------|--------|
| A | 1 ETH | 10 * 1 / 5 = 2 ETH |
| B | 4 ETH | 10 * 4 / 5 = 8 ETH |

### Events

```solidity
event RoundCreated(roundId, name, creator, targetTime, tolerance, startTime, endTime);
event PredictionSubmitted(roundId, user, stake);
event PredictionUpdated(roundId, user);
event StakeAdded(roundId, user, amount);
event PredictionWithdrawn(roundId, user, amount);
event RoundSettled(roundId, settlementPrice);
event BatchRevealed(roundId, count, handles);
event BatchVerified(roundId, winnerCount);
event WinnerVerified(roundId, user);
event RewardClaimed(roundId, user, reward);
event UnclaimedRefunded(roundId, amount);
```

### Error Handling

| Error | Cause |
|-------|-------|
| `NotOwner` | Caller is not contract owner |
| `InvalidAmount` | Stake below minimum or invalid parameter |
| `RoundNotBetting` | Action requires Betting phase |
| `AlreadyPredicted` | User already has active prediction |
| `NoPrediction` | User has no active prediction |
| `NotSettled` | Settlement price not yet submitted |
| `AlreadyRevealed` | Predictions already revealed |
| `NotWinner` | User not verified as winner |
| `ClaimExpired` | Claim deadline passed |

---

## Deployment

### Dependencies

```json
{
  "@fhevm/solidity": "^0.9.1",
  "@fhevm/hardhat-plugin": "^0.3.0-1",
  "@zama-fhe/relayer-sdk": "^0.3.0-5"
}
```

### Compile & Deploy

```bash
# Compile contracts
npx hardhat compile

# Deploy to Zama testnet
npx hardhat deploy --network zama

# Sync ABI to frontend
npm run sync-abi
```

### Configuration

The contract inherits `ZamaEthereumConfig` which automatically configures:
- FHE Gateway address
- Decryption oracle settings
- Network-specific parameters

---

## Security Considerations

1. **FHE Permission Model**: Only authorized addresses can decrypt ciphertexts
2. **Anti-Double-Spend**: Predictions are locked during Locked phase
3. **Cryptographic Verification**: `checkSignatures()` validates all decryption proofs
4. **Time-Locked Phases**: State transitions enforced by block.timestamp
5. **Reentrancy Protection**: External calls made last (CEI pattern)

---
