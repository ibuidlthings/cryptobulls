import Link from "next/link";
import { fetchBullBank, fetchBullAsset, getConnection } from "@/lib/chain";

export const metadata = {
  title: "Gallery - All wrapped CryptoBulls",
};

export const dynamic = "force-dynamic";
export const revalidate = 30;

async function loadAllBulls() {
  const conn = getConnection();
  const bank = await fetchBullBank(conn);
  if (!bank) return { tiers: [] as number[], bank: null };
  // Tiers 1..nextTier-1 minus those currently in free_tiers (unwrapped, awaiting reuse)
  const allMinted = new Set<number>();
  for (let t = 1; t < bank.nextTier; t++) allMinted.add(t);
  for (const t of bank.freeTiers) allMinted.delete(t);
  const tiers = Array.from(allMinted).sort((a, b) => a - b);
  return { tiers, bank };
}

export default async function GalleryPage() {
  const { tiers, bank } = await loadAllBulls();

  return (
    <main className="max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="h1 mb-3">The herd</h1>
          <p className="text-[var(--bull-dim)] text-lg">
            Every bull currently in circulation. Each holds 1,000,000 $BULLS.
          </p>
        </div>
        {bank && (
          <div className="card flex gap-6">
            <Stat label="Live" value={bank.inCirculation} />
            <Stat label="Wrapped lifetime" value={bank.totalWrapped.toString()} />
            <Stat label="Slots remaining" value={Math.max(0, 1000 - bank.nextTier + 1)} />
          </div>
        )}
      </div>

      {tiers.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-2xl font-bold mb-3">No bulls wrapped yet</div>
          <p className="text-[var(--bull-dim)] mb-6">Be the first holder to mint a CryptoBull.</p>
          <Link href="/wrap" className="btn btn-primary">Wrap the first bull →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {tiers.map((tier) => (
            <Link key={tier} href={`/bull/${tier}`} className="card card-hover group p-3">
              <div className="aspect-square rounded-lg overflow-hidden bg-[#0a0a0c] mb-2">
                <img
                  src={`/api/render/${tier}`}
                  alt={`CryptoBulls #${tier}`}
                  className="w-full h-full pixelated"
                  loading="lazy"
                />
              </div>
              <div className="text-xs text-[var(--bull-dim)]">CryptoBulls</div>
              <div className="text-sm font-bold group-hover:text-[var(--bull-accent)]">#{tier}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs uppercase text-[var(--bull-dim)] tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-extrabold text-[var(--bull-accent)]">{value}</div>
    </div>
  );
}
