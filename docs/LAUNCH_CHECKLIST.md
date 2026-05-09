# Mainnet launch checklist

Single source of truth for everything that has to be true before we run
`scripts/launch.sh` on mainnet. Update as items complete.

## Phase 0 — Pending external approvals

- [x] Submit Phantom dApp review form (Google form, 2026-05-09)
- [ ] **Phantom whitelist confirmation received** (24–72h, by email or in-app)
  — until this resolves, mainnet wallet connect shows "Request blocked"

## Phase 1 — Trust signals on the live site (done 2026-05-09)

These improve the chance Phantom's reviewer marks us legitimate.

- [x] `<meta name="solana:network">`, `solana:program-id`, `dapp:source`,
      `dapp:twitter` published in [layout.tsx](../web/app/layout.tsx)
- [x] `/security` transparency page live at
      [cryptobulls.fun/security](https://cryptobulls.fun/security)
- [x] `/.well-known/security.txt` published with GitHub + X contact paths
- [x] Caddy emits `Strict-Transport-Security`, `X-Content-Type-Options`,
      `Referrer-Policy`, `Permissions-Policy` (HSTS preload-eligible, 1y)
- [x] SSL valid May 8 → Aug 6 2026 (Caddy auto-renews 30 days early)
- [x] Source code public on `github.com/ibuidlthings/cryptobulls`

## Phase 2 — Pre-launch automation (now done)

Tooling that was missing earlier:

- [x] [`scripts/launch_preflight.sh`](../scripts/launch_preflight.sh) —
      validates 12 pre-flight checks (tools, repo layout, keypair
      match, balance, MCC readiness, DNS, TLS) without changing state
- [x] [`scripts/web_apply_mcc.sh`](../scripts/web_apply_mcc.sh) —
      swaps the live web client to MCC-aware (IDL + program.ts +
      chain.ts + wrap/unwrap pages), rebuilds Next.js, syncs to
      `/opt/cryptobulls-web`, restarts service
- [x] [`web/lib/program.ts.mcc`](../web/lib/program.ts.mcc) +
      [`web/lib/chain.ts.mcc`](../web/lib/chain.ts.mcc) — full MCC-aware
      alternates, ready to swap
- [x] `launch.sh` Step 0.5 — auto-calls `web_apply_mcc.sh` if the
      live client is still pre-MCC (one-command launch)

**No more manual web edits needed at launch time.** `launch.sh` handles
the swap.

## Phase 3 — Mainnet deploy (launch day)

User actions:

- [ ] Fund `FRZJpAtPcWJBRFziY6dZkBHMBSWVi12hXAtAJEHawTwQ` with **5.5 SOL**
      mainnet
- [ ] `scp` the mainnet deployer keypair to `/tmp/mainnet-deployer.json`
      on the bulls box (`165.22.167.96`)
- [ ] Launch `$BULLS` on pump.fun, copy the mint address
- [ ] Run preflight on bulls box:
      ```
      DEPLOYER_KEYPAIR=/tmp/mainnet-deployer.json \
        /root/bullpeg-sol/scripts/launch_preflight.sh <BULLS_MINT_ADDRESS>
      ```
      Must report 0 fails before continuing.
- [ ] Run launch on bulls box:
      ```
      DEPLOYER_KEYPAIR=/tmp/mainnet-deployer.json \
        /root/bullpeg-sol/scripts/launch.sh <BULLS_MINT_ADDRESS>
      ```
- [ ] `shred -u /tmp/mainnet-deployer.json` (mainnet keypair off the box)

`launch.sh` handles automatically:

- [x] Step 0: pre-flight (deployer match, balance, build artifact,
      Anchor.toml alignment)
- [x] Step 0.5: web client MCC swap + rebuild + sync
- [x] Step 1: deploy program to mainnet (idempotent)
- [x] Step 2: `initialize` with `<BULLS_MINT>` (idempotent)
- [x] Step 2.5: `initialize_collection` (idempotent)
- [x] Step 3: switch systemd env from devnet → mainnet RPC + restart
- [x] Smoke-test `/` and `/api/health`

## Phase 4 — Post-launch verification

- [ ] Wallet connect on mainnet works (no Phantom red banner)
- [ ] Founder bull wrap (you wrap CryptoBulls #1 from dev-buy supply)
- [ ] `/api/health` returns `ok: true` with mainnet slot
- [ ] [audit_chain.sh](../scripts/audit_chain.sh) — all 7 invariants pass
- [ ] Tensor shows the collection (may take 24h to index)
- [ ] Magic Eden shows the collection (may take 24h to index)
- [ ] Tweet per [docs/COMMS.md](COMMS.md) cadence

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Phantom rejects whitelist | Reply with extra info; worst case launch with the warning, get it cleared post-launch via reviewer feedback |
| Mainnet deploy fails midway | `launch.sh` is idempotent; see [`docs/RECOVERY.md`](RECOVERY.md) Scenario 1 for per-step recovery steps |
| Web MCC swap breaks build | `launch.sh` Step 0.5 fails before any chain ops; revert via `git checkout web/lib && rebuild`. See [`RECOVERY.md`](RECOVERY.md) Scenario 1 |
| Magic Eden / Tensor don't index | Auto-indexed via MCC; full listing requires Creator Hub claim — see [`MARKETPLACE.md`](MARKETPLACE.md) |
| Bulls box dies | DO snapshots restore in 10–20 min if enabled; full rebuild documented in [`RECOVERY.md`](RECOVERY.md) Scenario 2 |
| Deployer keypair lost | **Pre-launch:** back up encrypted in 2+ locations + hardware/paper. See [`RECOVERY.md`](RECOVERY.md) "Deployer keypair" section |
| Helius RPC outage | Fall back to public mainnet-beta RPC by editing systemd `SOLANA_RPC_URL` |

## Related docs

- [`docs/RECOVERY.md`](RECOVERY.md) — incident playbook, asset backup posture
- [`docs/MARKETPLACE.md`](MARKETPLACE.md) — Magic Eden + Tensor claim flow
- [`docs/COMMS.md`](COMMS.md) — launch tweets + cadence
- [`docs/AUTHORITY.md`](AUTHORITY.md) — upgrade authority freeze plan
- [`scripts/launch_preflight.sh`](../scripts/launch_preflight.sh) — read-only validator
- [`scripts/launch.sh`](../scripts/launch.sh) — main mainnet deploy script
- [`scripts/web_apply_mcc.sh`](../scripts/web_apply_mcc.sh) — web client MCC swap
- [`scripts/audit_chain.sh`](../scripts/audit_chain.sh) — 7-invariant on-chain audit
