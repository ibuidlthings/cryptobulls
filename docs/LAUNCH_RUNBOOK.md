# Launch Runbook — Zero Phantom Warnings

**Goal:** go from pre-launch to a live mainnet wrap/unwrap with **no Phantom
"malicious" / "transaction reverted" warnings**, confirmed privately before
any public announcement.

## Why warnings happened pre-launch (root cause, 2026-05-15)

The bullpeg program is deployed on **devnet only**. On **mainnet** the
program ID `A2tUttiL2v2fYxPyeUSZ75CqnjDp5sewCqcnXubgoxm` is a plain
non-executable system account. The deployed site was running in
`LAUNCH_STATE=live` pointed at that devnet-only program, so any visitor on
Phantom-mainnet who clicked Wrap built a transaction calling a non-program
address — a textbook scam pattern that Phantom **correctly** flags as
"could be malicious." Every such attempt also fed Blowfish a
malicious-interaction signal for cryptobulls.fun, degrading the domain's
reputation.

This was never a transaction-mechanics bug. The `signAndSendTransaction`,
pre-simulation, blockhash, and balance-gate work is all correct and stays —
but it was never the cause of the mainnet warning.

## Current state (pre-launch, safe)

- `NEXT_PUBLIC_LAUNCH_STATE=pre-launch` in both the build (`web/.env.production`)
  and the systemd unit on the box. `/wrap` and `/unwrap` show "goes live at
  launch" cards. No public transaction can be attempted → no warnings, no
  further domain-reputation poisoning.
- Devnet program exists and its **Anchor IDL is already published on devnet**
  (`anchor idl fetch ... --provider.cluster devnet` returns the bullpeg IDL).
  This proves the IDL-publish mechanism and confirms the upgrade authority
  keypair on the DO box (`GMrJpP7SaUkfyizsB3b8GeKWgDiqac3g5EaMGnMtkXCj`)
  is correct.
- Balance + SOL gates are deployed: a wrap/unwrap is never built if the
  wallet lacks the $BULLS / SOL the chain would require.

## Pre-launch confirmation (do anytime, no risk)

**Rehearsal 1 — local devnet, isolates domain-rep from program/tx.**
`localhost` is not a Blowfish-flagged domain, so a clean result here means
the program/tx is fine and any cryptobulls.fun warning was domain-rep only.

```
cd web
npm install
npm run dev          # uses web/.env.local → live mode, devnet
```

1. Open http://localhost:3000/wrap
2. Phantom → Devnet mode. Fund the test wallet with devnet SOL
   (`solana airdrop 2 <addr> -u devnet`) and devnet test $BULLS.
3. Click Wrap. Open dev console.
4. Expected: Phantom modal **clean**, Advanced view shows
   `bullpeg: wrapBull` (NOT "Unknown program", since the devnet IDL is
   published). `[bullpeg-tx:wrapBull]` logs `simulationErr: null`.
   - Clean here → program/tx is correct; any cryptobulls.fun warning was
     pure domain reputation, which the pre-launch gate now lets recover.
   - Warning here → program/tx issue independent of domain; capture the
     `[bullpeg-tx:wrapBull]` object + Phantom screenshot and stop; do not
     proceed to launch until resolved.

## Launch day sequence (produces zero warnings)

Do these IN ORDER. Steps 1–7 are private; do not announce until step 8
confirms clean.

1. **Launch $BULLS on pump.fun.** Record the real mainnet token mint.
2. **Fund the deployer/upgrade-authority wallet** (`GMrJpP7Sa...`) with
   ~5 SOL on mainnet (program rent ≈ 3–4 SOL + IDL rent + fees).
3. **Deploy the program to mainnet:**
   ```
   cd /root/bullpeg-sol
   anchor deploy --provider.cluster mainnet-beta
   ```
   Confirm: `solana program show <PROGRAM_ID> -u mainnet-beta` shows
   `Executable: true`, owner = BPF upgradeable loader.
4. **Publish the IDL on mainnet** (kills the "Unknown program" label):
   ```
   anchor idl init <PROGRAM_ID> \
     --filepath target/idl/bullpeg.json \
     --provider.cluster mainnet-beta
   ```
   Confirm: `anchor idl fetch <PROGRAM_ID> --provider.cluster mainnet-beta`
   returns the bullpeg IDL.
5. **Initialize on mainnet:**
   ```
   # initialize: locks the real $BULLS mint into BullBank
   # initialize_collection: sets up the MCC collection NFT
   ```
   (use the devnet init scripts adapted to mainnet + the real mint).
6. **Repoint the site env** (both `web/.env.production` AND the systemd
   unit on the box):
   ```
   NEXT_PUBLIC_LAUNCH_STATE=live
   NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta
   NEXT_PUBLIC_PROGRAM_ID=<mainnet program id>
   NEXT_PUBLIC_TOKEN_MINT=<real $BULLS mint>
   NEXT_PUBLIC_SOLANA_RPC_URL=<mainnet RPC>
   SOLANA_RPC_URL=<mainnet Helius RPC>     # systemd only, not committed
   ```
   Rebuild (`npm run build`), redeploy standalone+static, restart service.
7. **Rehearsal 2 — private mainnet wrap (the real confirmation gate):**
   With your own wallet holding ≥1,000,000 $BULLS + ≥0.03 SOL, do ONE
   wrap on cryptobulls.fun on Phantom-mainnet, **before any public
   announcement**.
   - Clean (no warning, Advanced shows `bullpeg: wrapBull`, tx confirms)
     → proceed to step 8.
   - Warning → you found out privately. Do not announce. Capture the
     `[bullpeg-tx:wrapBull]` log + screenshot; the remaining factor is
     domain reputation — pursue verified build + Blowfish submission
     (below) and re-test before announcing.
8. **Announce.** Only after step 7 is clean.

## Domain-reputation hardening (do before/around launch)

The hard triggers (no program, Unknown program, doomed tx) are
deterministically removed by the steps above. Domain reputation is the
residual third-party (Blowfish) variable. Reduce it:

- **Stop the bleeding** — done (pre-launch gate; no more malicious-flagged
  interactions from cryptobulls.fun).
- **Verified build** — register the mainnet program build hash so Blowfish
  / explorers can prove the bytecode matches this open-source repo.
- **Blowfish submission** — once the mainnet program is live + IDL
  published, submit the domain + program via Blowfish's intake
  (https://form.typeform.com/to/BHue5Hg0) with the repo, SECURITY.md, and
  the verified-build attestation.
- Phantom support has confirmed they no longer whitelist domains by
  default, so there is no review queue to wait on — reputation is earned
  through clean, decodable, verified on-chain activity, which steps 3–7
  produce.

## RPC scaling (launch-critical — discovered 2026-05-15)

At launch, Magic Eden / Tensor / Phantom crawl `/api/metadata/[tier]` and
`/api/render/[tier]` for all 1000 tiers, repeatedly. A single free RPC key
**will** hit "max usage reached" (`-32429`) under that load and the entire
collection renders broken everywhere. This already happened on the devnet
Helius free key.

Mitigations already shipped (web/lib/cache.ts + the two routes):

- **Single-flight**: N concurrent misses for a tier collapse to ONE RPC
  call. Kills the per-60s thundering herd.
- **Long positive TTL (10 min) + stale-while-revalidate**: a wrapped
  bull only changes on unwrap; serve cached/stale instantly and refresh
  in the background. ~1 RPC per tier per 10 min instead of per request.
- **Short negative TTL (60s in-proc / 20s HTTP)**: 1000-tier probes of
  mostly-unwrapped tiers don't storm RPC, but a freshly-wrapped bull
  still surfaces within ~1 min.
- **Controlled 503 + `no-store` on RPC failure**: a blip degrades
  gracefully and is never cached as an error, instead of a 500 storm.
- **No more `immutable` by tier**: tiers are reused (unwrap → re-wrap =
  new nft_mint = new art/traits); immutable-by-tier served stale art for
  24h and broke the core mechanic.

Status:

- [x] **Dedicated Helius key acquired (2026-05-15).** Verified working on
  BOTH devnet and mainnet (`getHealth` ok, `getAccountInfo` returns data).
  Stored ONLY in the systemd `Environment=SOLANA_RPC_URL=` on the box —
  never committed to the repo, never in the client bundle. Pre-launch it
  is set to the Helius **devnet** endpoint
  (`https://devnet.helius-rpc.com/?api-key=<CRYPTOBULLS_KEY>`).
  **Launch-day action:** change `devnet` → `mainnet` in that one systemd
  line (same key) and `systemctl daemon-reload && systemctl restart
  cryptobulls-web`. That is the entirety of step 6's RPC change.
- [ ] **Optional but strong: Cloudflare in front of cryptobulls.fun.**
  There is currently NO CDN (Caddy proxies straight to Node), so the
  `s-maxage` / `stale-while-revalidate` HTTP headers have nothing to
  honor. A CDN would absorb essentially all marketplace read load at the
  edge and make the origin RPC cost negligible. Not required (the
  dedicated Helius key + single-flight + SWR handle launch load) but it
  is the cheapest large headroom multiplier if volume is huge.

Client-side `NEXT_PUBLIC_SOLANA_RPC_URL` deliberately stays on the public
RPC: it is inlined into the public JS bundle, so the paid key must NOT go
there. Client reads (/gallery, /bull/[tier]) are low-volume; the
launch-critical marketplace crawl hits the server routes, which use the
Helius `SOLANA_RPC_URL`.

## Rollback

- Re-gate instantly: set `NEXT_PUBLIC_LAUNCH_STATE=pre-launch` in
  `web/.env.production` + systemd, rebuild, redeploy, restart. Wrap/unwrap
  revert to "goes live at launch" cards; no tx possible.
- IDL is reversible via `anchor idl close <PROGRAM_ID>` (rent refunded to
  authority) if ever needed.
- Program is upgradeable (upgrade authority retained) — fixes can be
  shipped via `anchor upgrade` without changing the program ID.
