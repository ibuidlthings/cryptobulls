# Launch communication

Three pieces, fired in sequence. Each draft is under Twitter's 280-char limit.

---

## Tweet 1 — Pinned launch tweet (fire immediately after `initialize` succeeds)

**Attach: `samples/banners/banner_1500x500.png`**

```
Introducing CryptoBulls 🐂

The first hybrid token-NFT layer for pump.fun.

Wrap 1,000,000 $BULLS → a Bull NFT.
Sell the NFT, the tokens go with it.
The vault follows the NFT.

1000 supply. 100% on-chain pixel art. ERC-404 mechanics, no Token-2022.

cryptobulls.fun
```

Pin this on @CTBullsfun. Quote-RT from your personal account.

---

## Tweet 2 — "Dev wraps the first bull" (fire 5-15 min after T1, after the dev buy + wrap)

This is the credibility signal. Dev took their own pump.fun supply and wrapped the first bull. Quote-tweet the wrap_bull tx on Solana Explorer.

**Quote-tweet target:** the wrap_bull tx URL on explorer.solana.com.

**Body (one of these — pick the one you like):**

### Option A — clean
```
gm.

CryptoBulls #1 is wrapped.

Founder bull. 1,000,000 $BULLS locked in a vault tied to this NFT mint. Whoever holds the NFT controls the tokens.

If I sell, they go with it. If I unwrap, they come back. That's the whole mechanic.

cryptobulls.fun/bull/1
```

### Option B — punchier
```
🐂 CryptoBulls #1

Wrapped from the dev allocation. 1M $BULLS now live in a vault that follows this NFT through every transfer.

If you want to know whether the mechanic works — go look at the on-chain state right now.

cryptobulls.fun/bull/1
```

### Option C — confidence flex
```
First bull wrapped from the dev supply.

1,000,000 $BULLS locked in a vault that I can't unilaterally drain.
The only way to release them is to burn the NFT — which means I no longer own this bull.

That's the point.

cryptobulls.fun/bull/1
```

**Recommendation: Option A.** Explains the mechanic + signals confidence in one tight package. The line "If I sell, they go with it" is the meme that should travel.

---

## Tweet 3 — Mechanic thread (fire ~30 min after launch, when the timeline starts to ask "wait how does this actually work?")

Quote-RT from @CTBullsfun. 5 tweets.

### 1/5
```
A short thread on how CryptoBulls works.

ERC-404 brought hybrid token-NFT mechanics to Ethereum.
SPL-404 brought them to Solana — but only on Token-2022.

pump.fun launches standard SPL tokens, no transfer hooks. Every existing hybrid had to abandon the launchpad.

We didn't. 🐂
```

### 2/5
```
The trick: an NFT-owned vault PDA.

When you wrap 1M $BULLS, the program creates a vault account whose authority is derived from the NFT's mint address itself.

vault_authority = PDA(["vault", nft_mint])

Pure function. No keypair. Only this program can sign.
```

### 3/5
```
So when the NFT trades on Magic Eden or Tensor, the vault doesn't physically move. Same address, same authority.

What changes is who can drive the program to drain it.

Possession of the NFT is possession of the right to call unwrap_bull. Possession of the right is possession of the tokens.
```

### 4/5
```
1,000 max supply. 1B $BULLS. 1M tokens per bull. 100% on-chain pixel art seeded from the NFT's mint pubkey.

Same launchpad. Same PumpSwap graduation. Same wallet UX. Native NFT primitive on top.

We extend pump.fun. We don't replace it.
```

### 5/5
```
Read the full thesis: cryptobulls.fun/thesis
Audit the program: github.com/ibuidlthings/cryptobulls

Wrap a bull. Sell it. Or unwrap. Your bull. Your vault.

Open app: cryptobulls.fun
```

---

## Tweet 4 — Reply hooks (have these ready for replies in the first hour)

When people ask predictable questions, fire one of these:

**"how is this different from SPL-404?"**
```
SPL-404 requires Token-2022. pump.fun ships standard SPL. Token-2022 ≠ standard SPL — they're different token programs entirely. Existing hybrid projects had to launch outside pump.fun.

We built it on standard SPL using an NFT-owned vault PDA pattern. Works with any pump.fun token.
```

**"what stops you from rugging the vaults?"**
```
The program. The vault authority is PDA(["vault", nft_mint]) — derived from the NFT mint. No keypair exists for it. The only way to drain a vault is unwrap_bull, which checks payer_nft_account.amount == 1.

Whoever holds the NFT controls the tokens. Not me.
```

**"is the program upgradeable?"**
```
For the first 30 days, yes — for bug-patching only. After 30 days of soak with no critical issues, we freeze the upgrade authority. Tx will be public on-chain.

Source: github.com/ibuidlthings/cryptobulls/docs/AUTHORITY.md
```

**"why 1M tokens per bull?"**
```
1B supply ÷ 1000 max bulls = 1M per bull. Round number, gives bulls actual fractional ownership of the supply, and creates a clear "wrap threshold" — hold 1M+, you can wrap a bull.
```

**"I bought on pump.fun, when can I wrap?"**
```
cryptobulls.fun/wrap. Connect your wallet. If you hold ≥1M $BULLS the wrap button is live. ~3 second tx, your bull appears in /gallery and your Phantom Collectibles.
```

---

## Posting cadence

| T+ | Tweet |
|---|---|
| 0:00 | Pinned launch tweet (T1) on @CTBullsfun |
| 0:00 | Quote-RT from your personal handle |
| 0:05 | Run launch.sh, wait for confirmation |
| 0:10 | Dev buys on pump.fun |
| 0:15 | Dev wraps CryptoBulls #1 via website, captures tx |
| 0:20 | Founder bull tweet (T2) quote-tweeting the wrap tx |
| 0:30 | Mechanic thread (T3) |
| 1:00+ | Reply hooks (T4) as questions roll in |
| 24h | Wave 2: re-share the gallery once 10+ bulls are wrapped, with rarity stats |

---

## What NOT to tweet

- "Audited" — we have not been audited. We have tests + on-chain proof. Don't claim audit.
- "Rug-proof" — say "vault is mint-derived, not deployer-derived" instead. Mechanism, not marketing.
- Any specific holder's wallet address (privacy of others)
- "100x" / price targets / token-price predictions — pump.fun community can sniff that out instantly. Lean into mechanic, not number-go-up.
