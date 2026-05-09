import Link from "next/link";

export const metadata = {
  title: "Thesis - CryptoBulls",
  description:
    "A new kind of pump.fun token. The first hybrid token-NFT layer for standard SPL launches.",
};

export default function ThesisPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-20 md:py-28">
      <header className="mb-20">
        <div className="text-xs uppercase tracking-[0.25em] text-[var(--bull-dim)] mb-4">
          The thesis
        </div>
        <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-0">
          A new kind of pump.fun token. Not a vanilla memecoin. Not a side NFT
          drop. The first hybrid token-NFT layer for standard SPL launches.
        </h1>
      </header>

      <Section n="01">
        When pump.fun took over Solana memecoin culture, one detail stood out:
        it ships standard SPL tokens. No transfer hooks. No Token-2022. The
        "obvious" hybrid token-NFT mechanic on Solana, SPL-404, requires
        Token-2022 and is therefore incompatible with pump.fun. Every existing
        hybrid project had to abandon the launchpad. CryptoBulls is what
        happens when you don't.
      </Section>

      <Section n="02">
        $BULLS uses an NFT-owned vault PDA to bind exactly 1,000,000 tokens
        to each Bull NFT. The vault's authority is derived from the NFT mint
        address itself: <code className="text-[var(--bull-accent)]">PDA(["vault", nft_mint])</code>.
        When the NFT trades on Magic Eden or Tensor, the vault doesn't
        physically move. What changes is who can drive the program to drain
        it. Possession of the NFT is possession of the right to redeem the
        tokens.
      </Section>

      <Section n="03">
        The visual is hashed from the NFT mint pubkey and rendered on-chain.
        No IPFS. No external storage. No metadata server failure mode. The
        24×24 pixel art is reproducible from chain state alone. Every wrap
        creates a new visual; every unwrap frees the tier; every re-wrap
        re-rolls.
      </Section>

      <Section n="04">
        The name: ERC-404 made hybrid tokens famous on Ethereum. SPL-404
        brought the mechanic to Solana, but only on Token-2022. CryptoBulls
        is the version that works on the standard token pump.fun actually
        ships.
      </Section>

      <div className="mt-24 text-center">
        <div className="text-5xl mb-6">🐂</div>
        <div className="text-2xl font-bold mb-3">
          Crypto + Bulls ={" "}
          <span style={{ color: "var(--bull-accent)" }}>CryptoBulls</span>
        </div>
        <p className="text-[var(--bull-dim)] italic">
          The mechanic that nobody knew could work on pump.fun, working on pump.fun.
        </p>
      </div>

      <div className="mt-20 flex justify-center gap-3">
        <Link href="/wrap" className="btn btn-primary">Wrap a Bull →</Link>
        <Link href="/tech" className="btn btn-secondary">Read the tech</Link>
      </div>
    </main>
  );
}

function Section({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <section className="mb-16 md:mb-20">
      <div className="text-[var(--bull-accent)] font-bold text-2xl mb-4 tracking-wider">
        {n}
      </div>
      <div className="text-lg leading-relaxed text-[var(--bull-ink)]">
        {children}
      </div>
    </section>
  );
}
