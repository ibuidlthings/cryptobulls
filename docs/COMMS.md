# Launch communication

Three pieces, fired in sequence. Each draft is under Twitter's 280-char limit.

---

## Tweet 1 — Pinned launch tweet (fire immediately after `initialize` succeeds)

**Attach: `samples/banners/banner_1500x500.png`**

### Option A — leads with what we solved (recommended)
```
Introducing CryptoBulls 🐂

The first hybrid token-NFT layer for pump.fun-launched memecoins.

Wrap 1,000,000 $BULLS into a Bull NFT.
Sell the NFT, the tokens go with it.
The vault follows the NFT.

SPL-404 needed Token-2022. We built it on standard SPL.

cryptobulls.fun
```

### Option B — punchier
```
A pump.fun token that is also an NFT. 🐂

Wrap 1M $BULLS → a Bull NFT.
Trade the NFT on Magic Eden or Tensor — the tokens follow.
Unwrap to redeem.

1000 supply. 100% on-chain pixel art. Built where nobody else could.

cryptobulls.fun
```

### Option C — confidence flex
```
The mechanic everyone said couldn't work on pump.fun — working on pump.fun. 🐂

CryptoBulls: wrap 1,000,000 $BULLS into an NFT. The vault follows the NFT through every transfer. No Token-2022 required.

1000 supply.

cryptobulls.fun
```

**Recommendation: Option A.** Tells you exactly what it is and what was hard about it. The line "SPL-404 needed Token-2022. We built it on standard SPL." is the meme that should travel — it's the actual differentiator, accurate, and sets up "but how?" curiosity that pulls people into the thesis page.

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

The constraint: pump.fun ships standard SPL tokens, no transfer hooks. SPL-404 — the standard hybrid token-NFT mechanic on Solana — requires Token-2022, which is incompatible. Every existing hybrid project had to leave the launchpad.

We didn't. 🐂
```

### 2/5
```
The mechanism: an NFT-owned vault PDA.

When you wrap 1M $BULLS, the program creates a vault token account whose authority is derived from the NFT's mint pubkey itself.

  vault_authority = PDA(["vault", nft_mint])

Pure function. No keypair exists. Only this program can sign for it.
```

### 3/5
```
When the NFT trades on Magic Eden or Tensor, the vault doesn't physically move. Same address. Same authority.

What changes is who can drive the program to drain it.

Possession of the NFT is possession of the right to call unwrap_bull. Authority follows the asset, atomically, no transfer hook needed.
```

### 4/5
```
The underlying SPL token never had to be modified. The launchpad never had to be replaced.

That's why this works on pump.fun where SPL-404 doesn't.

Same bonding curve, same PumpSwap graduation, same wallet UX — with a native NFT primitive on top of the standard token.
```

### 5/5
```
1,000 supply. 1M $BULLS per bull. 100% on-chain pixel art seeded from each NFT's mint pubkey.

Read the thesis: cryptobulls.fun/thesis
Audit: github.com/ibuidlthings/cryptobulls

Wrap. Trade. Unwrap.

cryptobulls.fun
```

---

## Tweet 4 — Reply hooks (have these ready for replies in the first hour)

When people ask predictable questions, fire one of these:

**"how is this different from SPL-404?"**
```
SPL-404 requires Token-2022 transfer hooks. pump.fun ships standard SPL — no hooks. Different token programs entirely. SPL-404 forces you off the launchpad.

We derive the vault's authority from the NFT mint pubkey via a PDA. No transfer hook needed. Works on standard SPL, which is what pump.fun ships.
```

**"how does this compare to uPeg?"**
```
uPeg uses Uniswap v4 hooks to bind a token to a generative NFT on Ethereum. CryptoBulls uses Solana PDAs to bind a token to a separately-tradeable NFT on pump.fun.

Different problems, same instinct: use a chain primitive instead of a hybrid token standard.
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
