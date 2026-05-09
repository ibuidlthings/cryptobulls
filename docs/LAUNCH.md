# Launch-day runbook

Mainnet deploy of $BULLS + CryptoBulls program. Step-by-step, in order, with expected output. Practice the dry run on devnet at least once before doing this for real.

**Time budget:** 2-3 hours start to finish, assuming no surprises. Allocate a 4-hour window so you're not rushing.

**Prerequisites (must all be true before starting):**

- [ ] Mainnet deployer keypair generated **on your own machine** (not the bulls box). Pubkey: `FRZJpAtPcWJBRFziY6dZkBHMBSWVi12hXAtAJEHawTwQ`. The seed phrase is **cold-backed** on paper, ideally 2 copies in different physical locations.
- [ ] Deployer funded with **at least 5.5 SOL** on mainnet (only fund right before launch — don't pre-fund and leave SOL sitting around).
- [ ] All pre-launch tests passing: `cargo test --manifest-path programs/bullpeg/Cargo.toml --lib` (10 tests) + `anchor test` (7 tests)
- [ ] Browser E2E on devnet completed end-to-end (wrap + unwrap via wallet adapter UI) — done
- [ ] Cross-wallet unwrap test passed on devnet (vault followed NFT to second wallet) — done
- [ ] DNS already points cryptobulls.fun + www at 165.22.167.96 — done
- [ ] Bulls box is up: `ssh root@165.22.167.96 'systemctl is-active cryptobulls-web caddy'`
- [ ] Helius RPC key wired into the systemd unit — done
- [ ] UptimeRobot monitoring `/api/render/1` + `/api/health`
- [ ] X account warmed up, intro tweet drafted, banner image ready
- [ ] Pump.fun account funded with enough SOL to launch

---

## Step 0 — Final pre-flight

```bash
# 1. SCP your mainnet deployer keypair onto the bulls box, just for launch day:
#    (run on your local machine)
scp /path/to/your/mainnet-deployer.json root@165.22.167.96:/tmp/mainnet-deployer.json

# 2. SSH into the box for the rest:
ssh root@165.22.167.96

# 3. Run the existing test suites one more time to make sure nothing's broken:
cd /root/bullpeg-sol
cargo test --manifest-path programs/bullpeg/Cargo.toml --lib  # 10 tests pass
anchor test                                                   # 7 tests pass

# 4. Confirm deployer balance is enough on mainnet:
solana balance --keypair /tmp/mainnet-deployer.json --url mainnet-beta
# Expected: >= 5.5 SOL. If less, send more.

# 5. Confirm pubkey matches the expected one:
solana address --keypair /tmp/mainnet-deployer.json
# Expected: FRZJpAtPcWJBRFziY6dZkBHMBSWVi12hXAtAJEHawTwQ
```

---

## Step 1 — Launch $BULLS on pump.fun

This is the only manual UI step. Do it on pump.fun in the browser.

1. Go to pump.fun, connect your wallet, click "create coin".
2. Fields:
   - **Name:** `CryptoBulls`
   - **Ticker:** `BULLS`
   - **Description:** *"The first hybrid token-NFT layer for pump.fun-launched memecoins. Wrap 1,000,000 $BULLS into a tradeable Bull NFT. The vault follows the NFT through every marketplace transfer. cryptobulls.fun"*
   - **Image:** upload `samples/mascots/mascot_01_classic_brown.png` (768x768 brown bull mascot)
   - **Twitter:** `https://x.com/CTBullsfun`
   - **Website:** `https://cryptobulls.fun`
   - **Telegram:** if you have one
3. Confirm the launch.
4. **Record the mint address** — pump.fun shows it on the token page. Format: 44-character base58 string ending in `pump`.

```
$BULLS mint = ____________________________________________________
```

**DO NOT proceed until you have written this down.**

---

## Step 2 — Run the launch script (deploys + initializes + flips web to mainnet)

`launch.sh` is idempotent — it skips deploy if the program is already on-chain, and skips initialize if the BullBank already exists. You can re-run it safely if anything fails partway through.

```bash
DEPLOYER_KEYPAIR=/tmp/mainnet-deployer.json \
  /root/bullpeg-sol/scripts/launch.sh <BULLS_MINT_FROM_STEP_1>
```

**Expected (full run):**
```
=== Step 0: pre-flight checks ===
deployer pubkey: FRZJpAtPcWJBRFziY6dZkBHMBSWVi12hXAtAJEHawTwQ
expected:        FRZJpAtPcWJBRFziY6dZkBHMBSWVi12hXAtAJEHawTwQ
balance:         5.5 SOL
BULLS mint:      <YOUR_PUMPFUN_MINT>
program ID:      A2tUttiL2v2fYxPyeUSZ75CqnjDp5sewCqcnXubgoxm (matches Anchor.toml)

=== Step 1: deploy program ===
Deploying (this takes ~60s and burns ~5 SOL)...
Deploy success.

=== Step 2: initialize bank with $BULLS mint ===
bank PDA:        <BANK_PDA>
initialized. tx: <TX_SIG>

=== Step 3: switch web service to mainnet ===
active
  / -> 200
  /api/health -> 200

=== LAUNCH COMPLETE ===
```

If any step fails, check `/root/launch-mainnet.log` for the full output. Re-run the script — it will pick up where it left off.

**After successful launch — shred the keypair file:**
```bash
shred -u /tmp/mainnet-deployer.json
```
The keypair stays cold on your paper backup. There's no reason to leave a copy on the box.

**Verify on Solana Explorer:**
- Open `https://explorer.solana.com/address/<PROGRAM_ID>` — confirm program is deployed, executable
- Open `https://explorer.solana.com/address/<BANK_PDA>` — confirm BullBank exists with `token_mint` matching the $BULLS mint and `next_tier == 1`

**DO NOT proceed until verified.** Initialize is a one-shot — if launch.sh locked the wrong mint, the only fix is to deploy a fresh program with a different keypair.

---

## Step 3 — Smoke test from a fresh wallet

Open https://cryptobulls.fun in incognito Chrome.

- [ ] Landing page shows `MAINNET-BETA · Program live`
- [ ] Stats show `In circulation: 0`, `Next tier: #1`
- [ ] `/wrap` page shows the wallet button. Connect Phantom (mainnet). It loads.
- [ ] Wallet balance shows 0 $BULLS (you haven't bought any yet — that's expected for a fresh wallet)

**No actual wrap yet — we want at least a few minutes of "is this rugged?" panic-poking time before announcing.**

---

## Step 4 — First mainnet wrap (founder bull)

From your launch wallet (the one that holds the $BULLS pump.fun launch supply):

1. Go to cryptobulls.fun/wrap
2. Connect that wallet
3. Verify it shows "Eligible wraps: 1+" (your wallet has the post-launch supply)
4. Click "Wrap CryptoBulls #1"
5. Sign in Phantom
6. Wait for confirmation (~3-5 sec)

**Expected:** success card with the new NFT mint + Explorer link.

Verify:
- Open the Explorer link, confirm the wrap_bull tx succeeded
- Check vault holds 1,000,000 $BULLS (call this from CLI):
  ```bash
  spl-token account-info --address $(spl-token accounts --owner <YOUR_PUBKEY> | grep -i $BULLS_MINT | awk '{print $1}') --url mainnet-beta
  ```
- Check Phantom mainnet → Collectibles tab → CryptoBulls #1 should appear within ~30 sec

---

## Step 5 — Announce on X

Pin the intro tweet to the @CTBullsfun profile. Quote-RT from your personal account.

Tweet template (already drafted):
```
Introducing CryptoBulls 🐂

The first hybrid token-NFT layer for pump.fun.

Wrap 1,000,000 $BULLS → a Bull NFT.
Sell the NFT, the tokens go with it.
The vault follows the NFT.

1000 supply. 100% on-chain pixel art. SPL-404 needed Token-2022. We built it on standard SPL.

cryptobulls.fun
```

Attach: `samples/banners/banner_1500x500.png`.

---

## Step 6 — Monitor for the first hour

Keep these tabs open:
- pump.fun token page (watch for buys)
- Solana Explorer for the program ID (watch wraps live)
- https://cryptobulls.fun/gallery (refresh; should populate)
- Phantom on the launch wallet (watch creator-fee payouts roll in)

Things to watch for in the first hour:

| Symptom | Likely cause | Action |
|---|---|---|
| Wrap fails with "InsufficientBalance" | User has < 1M $BULLS | Expected, not a bug |
| Wrap fails with "MaxBullsReached" | 1000 already wrapped (unlikely day 1) | Confirm via bank state, tweet stats |
| Render endpoint 5xx | Cache miss + RPC outage | Check `/health`, restart cryptobulls-web if needed |
| NFTs not showing in Phantom | Helius DAS indexer lag | Tweet "may take a few min, marketplaces will pick up faster" |
| Tensor doesn't show NFT | Tensor's indexer hasn't seen Metaplex metadata yet | Wait, then list one manually to trigger |

---

## Rollback (only if a critical bug surfaces in the first 30 days)

If a bug is found that requires a code change AND the program is still upgradeable:

```bash
# 1. Patch + rebuild the program
anchor build

# 2. Upgrade the on-chain program
anchor upgrade target/deploy/bullpeg.so --program-id <PROGRAM_ID> --provider.cluster mainnet-beta

# 3. Verify the new bytecode is on-chain
solana program show <PROGRAM_ID> --url mainnet-beta
# Check "Last Deployed In Slot" advanced

# 4. Tweet the upgrade with explanation + tx signature
```

**The bank state and existing BullAssets are not touched by an upgrade — only the program logic is replaced.**

If the bug is critical AND the program is already frozen — see [AUTHORITY.md](./AUTHORITY.md) for the failsafe path (it's bad; don't end up here).

---

## Post-launch checklist (Day 1-7)

- [ ] First 24h: monitor wraps/unwraps for any failures, log them
- [ ] Day 2-3: list one founder bull on Tensor mainnet to validate the marketplace flow end-to-end
- [ ] Day 7: review wrap/unwrap counts, vault state consistency, indexer health
- [ ] Day 30: if no bugs, freeze the upgrade authority (`solana program set-upgrade-authority --new-upgrade-authority none`)

---

## Emergency contacts / rollback handles

- Bulls box console: DigitalOcean web UI → cryptobulls droplet → "Launch Console"
- DNS panel: Namecheap → Domain List → cryptobulls.fun → Advanced DNS
- If the box itself dies: restore from snapshot (DO Backups), reattach DNS
- If RPC is down: Helius status, Anza status (https://status.solana.com)
