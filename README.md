# CryptoBulls

The first hybrid token-NFT layer for pump.fun-launched memecoins.

[cryptobulls.fun](https://cryptobulls.fun) · [@CTBullsfun](https://x.com/CTBullsfun)

> A new kind of pump.fun token. Not a vanilla memecoin. Not a side NFT drop.
> Wrap 1,000,000 $BULLS into a tradeable Bull NFT. The vault follows the NFT
> through every marketplace transfer.

## Why

ERC-404 made hybrid tokens famous on Ethereum. SPL-404 brought the mechanic to
Solana, but only on Token-2022. **pump.fun ships standard SPL tokens** with no
transfer hooks — every existing hybrid project had to abandon the launchpad to
work. CryptoBulls is the version that works on the standard token pump.fun
actually ships.

The mechanism: an **NFT-owned vault PDA**. Each Bull NFT has a vault account
holding 1,000,000 $BULLS, with the vault's authority derived from the NFT mint
itself (`PDA(["vault", nft_mint])`). When the NFT trades on Magic Eden or
Tensor, the vault's address doesn't move — what changes is who can drive the
program to drain it. Possession of the NFT is possession of the right to
redeem the tokens.

Full thesis: [cryptobulls.fun/thesis](https://cryptobulls.fun/thesis).
Tech walkthrough: [TECH_WALKTHROUGH.md](TECH_WALKTHROUGH.md).

## Mechanic

```
1. Holder runs wrap_bull          → 1,000,000 $BULLS locked in vault
                                  → 1 Bull NFT minted to wallet
                                  → Vault authority = PDA(["vault", nft_mint])

2. NFT lists on Magic Eden / Tensor → buyer becomes new holder
                                    → vault unchanged on-chain
                                    → only the NFT moved

3. New holder runs unwrap_bull      → program checks NFT ownership
                                    → vault drains to caller (1M $BULLS)
                                    → NFT burns, tier returns to free pool
```

## Repository layout

```
.
├── programs/bullpeg/      Anchor program (3 instructions: initialize, wrap_bull, unwrap_bull)
│   ├── src/
│   │   ├── lib.rs              Entrypoint, constants, dispatch
│   │   ├── state.rs            BullBank (singleton) + BullAsset (per bull) PDAs
│   │   ├── errors.rs           Program error codes
│   │   └── instructions/
│   │       ├── initialize.rs   One-time: lock the $BULLS mint into the bank
│   │       ├── wrap_bull.rs    Lock 1M tokens, mint NFT, create metadata
│   │       └── unwrap_bull.rs  Verify NFT ownership, drain vault, burn NFT
│   └── Cargo.toml
│
├── tests/                 Anchor mocha test suite (7 tests, all passing)
│   └── bullpeg.ts              Includes the critical vault-follows-NFT proof
│
├── cranker/               Off-chain renderer + indexer
│   └── src/
│       ├── renderer.mjs        Deterministic 24×24 SVG generator (sha256(nft_mint) → bull)
│       ├── svg_to_png.mjs      Pure-Node PNG encoder + SVG→pixels rasterizer
│       ├── index.mjs           Express server: /api/metadata, /api/render
│       ├── mascots.mjs         Generate curated PFP candidates
│       ├── banner.mjs          Generate 1500×500 X header
│       ├── showcase.mjs        Per-trait visual catalog
│       └── check_conflicts.mjs Trait overlay collision check
│
├── web/                   Next.js website (cryptobulls.fun)
│   ├── app/
│   │   ├── page.tsx              Landing
│   │   ├── thesis/page.tsx       The thesis statement
│   │   ├── tech/page.tsx         Long-form mechanic doc
│   │   ├── about/page.tsx        Project background
│   │   ├── gallery/page.tsx      Live grid of every wrapped bull
│   │   ├── bull/[tier]/page.tsx  NFT detail page
│   │   ├── wrap/page.tsx         Wallet-connected wrap UI
│   │   ├── unwrap/page.tsx       Wallet-connected unwrap UI
│   │   └── api/
│   │       ├── metadata/[tier]/route.ts  Metaplex JSON
│   │       └── render/[tier]/route.ts    PNG (default) or SVG
│   ├── lib/
│   │   ├── chain.ts            Lightweight on-chain account reader
│   │   ├── program.ts          Anchor client + wrap/unwrap helpers
│   │   ├── renderer.mjs        Mirror of cranker/src/renderer.mjs
│   │   └── idl.json            Anchor program IDL
│   └── public/mascot.png
│
├── scripts/               Devnet deploy + E2E test scripts
│   ├── deploy_devnet.sh
│   ├── devnet_initialize.ts
│   └── devnet_wrap_bull.ts
│
├── Anchor.toml            Anchor config (devnet program ID baked in)
├── Cargo.toml             Workspace
├── TECH_WALKTHROUGH.md    Mechanical explanation for technical readers
└── package.json           ts-mocha + chai for the anchor test suite
```

## Constants

| Name              | Value             | Purpose                                       |
|-------------------|-------------------|-----------------------------------------------|
| `TOKENS_PER_BULL` | 1,000,000,000,000 | Base units per bull (1M whole tokens × 10⁶)   |
| `MAX_BULLS`       | 1,000             | Hard cap on bulls in circulation              |

Pump.fun tokens use 6 decimals. 1B token supply ÷ 1M per bull = 1,000 bulls max.

## Running locally

### Anchor program tests

```bash
# Need: Rust 1.95+, Solana CLI 3.1.14+, Anchor CLI 1.0.2+, Node 20+, Surfpool
anchor test
```

### Render samples

```bash
cd cranker
node src/showcase.mjs       # one bull per trait variant → samples/showcase/
node src/mascots.mjs        # 11 curated PFP candidates → samples/mascots/
node src/banner.mjs         # 1500×500 X header → samples/banners/
```

### Website (devnet)

```bash
cd web
npm install
npm run dev                 # → http://localhost:3000
```

The chain reader is configured for devnet by default (env: `NEXT_PUBLIC_PROGRAM_ID`,
`NEXT_PUBLIC_SOLANA_RPC_URL`). Override in `.env.local` for mainnet.

## Status

- [x] Anchor program complete (initialize / wrap_bull / unwrap_bull)
- [x] Full anchor test suite passing (including the critical vault-follows-NFT proof)
- [x] Devnet deployed: `A2tUttiL2v2fYxPyeUSZ75CqnjDp5sewCqcnXubgoxm`
- [x] Live website at [cryptobulls.fun](https://cryptobulls.fun) with wrap/unwrap UI
- [x] On-chain metadata + render API serving CryptoBulls #1
- [ ] Mainnet program deploy
- [ ] $BULLS launch on pump.fun
- [ ] Helius webhook + indexer for live activity feed
- [ ] Auto-wrap via SPL delegate (v2)

## License

MIT.
