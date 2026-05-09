import Link from "next/link";

export const metadata = {
  title: "About CryptoBulls",
  description: "What CryptoBulls is, why it exists, and how it bridges pump.fun + ERC-404.",
};

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="h1 mb-6">About <span style={{ color: "var(--bull-accent)" }}>CryptoBulls</span></h1>

      <section className="prose-block">
        <p className="text-lg text-[var(--bull-dim)] leading-relaxed mb-8">
          CryptoBulls is an upgrade layer for the pump.fun token standard. Pump.fun ships clean,
          bare SPL tokens - bonding curve, graduation, PumpSwap, creator fees. What it doesn't ship
          is any NFT primitive. CryptoBulls fills that gap with an ERC-404-style hybrid token-NFT
          layer.
        </p>

        <h2 className="h2 mb-4 mt-12">The problem</h2>
        <p className="text-[var(--bull-dim)] leading-relaxed mb-4">
          On Ethereum, ERC-404 (Pandora was first) made hybrid tokens famous: hold the fungible,
          earn the NFT; sell the NFT, lose the fungible. They trade together because they're
          inseparable at the protocol level.
        </p>
        <p className="text-[var(--bull-dim)] leading-relaxed mb-4">
          On Solana, SPL-404 (Mutantmon, Mall Street, Flyffys) did the same - but using
          Token-2022, the newer Solana token standard with transfer hooks. Pump.fun launches
          classic SPL tokens (the older, hookless standard). The two are not interoperable. To use
          SPL-404 you have to abandon pump.fun's launchpad culture entirely.
        </p>

        <h2 className="h2 mb-4 mt-12">Our answer</h2>
        <p className="text-[var(--bull-dim)] leading-relaxed mb-4">
          An NFT-owned vault PDA wrapper. Each Bull NFT has a dedicated vault holding 1,000,000 of
          the underlying token, with the vault's authority derived from the NFT's mint address.
        </p>
        <p className="text-[var(--bull-dim)] leading-relaxed mb-4">
          Result: when an NFT trades on Magic Eden or Tensor, the locked tokens follow it atomically.
          Buy the NFT → you control the vault. Sell the NFT → the buyer controls it. ERC-404 style
          inseparability without modifying the underlying token.
        </p>
        <p className="text-[var(--bull-dim)] leading-relaxed mb-4">
          The wrap is voluntary, on-chain, audited by code, and reversible. We extend pump.fun
          rather than replacing it.
        </p>

        <h2 className="h2 mb-4 mt-12">What we add on top</h2>
        <ul className="space-y-3 text-[var(--bull-dim)]">
          <li><span className="text-[var(--bull-accent)] font-bold">→ NFT-owned vault PDA pattern.</span> The mechanism that makes tokens follow the NFT through any marketplace transfer without modifying the underlying SPL token.</li>
          <li><span className="text-[var(--bull-accent)] font-bold">→ Wrap / unwrap layer.</span> A small, audited Anchor program with two user-initiated instructions and zero admin gates.</li>
          <li><span className="text-[var(--bull-accent)] font-bold">→ Deterministic visual.</span> A renderer that maps the NFT mint address to a 24×24 SVG. No off-chain images, no IPFS pinning, no centralized art server failure mode. The visual is reproducible from chain state alone.</li>
        </ul>

        <h2 className="h2 mb-4 mt-12">What pump.fun gives us free</h2>
        <ul className="space-y-3 text-[var(--bull-dim)]">
          <li><span className="text-[var(--bull-accent)] font-bold">→ Bonding curve.</span> Token launches at zero, tracks a curve to ~$69K market cap, graduates automatically.</li>
          <li><span className="text-[var(--bull-accent)] font-bold">→ PumpSwap LP.</span> At graduation, an AMM pool is created on PumpSwap and the LP tokens are burned. Liquidity is permanent.</li>
          <li><span className="text-[var(--bull-accent)] font-bold">→ Creator revenue.</span> 0.3% of bonding-curve volume + up to 0.05% of PumpSwap volume - funds ops indefinitely.</li>
          <li><span className="text-[var(--bull-accent)] font-bold">→ Wallet support.</span> Standard SPL means every Solana wallet handles the token without custom integration work.</li>
        </ul>

        <h2 className="h2 mb-4 mt-12">Status</h2>
        <ul className="space-y-2 text-[var(--bull-dim)]">
          <li><span className="text-[var(--bull-accent)]">●</span> Anchor program live on devnet (full test suite passing including vault-follows-NFT proof)</li>
          <li><span className="text-[var(--bull-accent)]">●</span> Metadata + render API live at cryptobulls.fun</li>
          <li><span className="text-[var(--bull-accent)]">●</span> Wrap / unwrap UI online</li>
          <li><span className="text-[var(--bull-dim)]">○</span> Mainnet program deploy</li>
          <li><span className="text-[var(--bull-dim)]">○</span> $BULLS launch on pump.fun</li>
        </ul>

        <div className="mt-12 flex gap-3 flex-wrap">
          <Link href="/tech" className="btn btn-primary">Read the tech →</Link>
          <Link href="/wrap" className="btn btn-secondary">Wrap a bull</Link>
        </div>
      </section>
    </main>
  );
}
