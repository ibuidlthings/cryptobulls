"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  fetchBank,
  fetchUserOwnedBulls,
  getProgram,
  unwrapBull,
} from "@/lib/program";
import { PublicKey } from "@solana/web3.js";

export default function UnwrapPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [loading, setLoading] = useState(true);
  const [tokenMint, setTokenMint] = useState<PublicKey | null>(null);
  const [bulls, setBulls] = useState<{ tier: number; nftMint: PublicKey; bullAsset: PublicKey }[]>([]);
  const [busyTier, setBusyTier] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");

  const refresh = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) return;
    setLoading(true);
    try {
      const program = getProgram(connection, wallet as any);
      const bank = await fetchBank(program);
      setTokenMint(bank.tokenMint);
      const owned = await fetchUserOwnedBulls(connection, wallet.publicKey, program);
      setBulls(owned.sort((a, b) => a.tier - b.tier));
    } catch (e: any) {
      console.error(e);
      setStatus(`error: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleUnwrap(tier: number, nftMint: PublicKey) {
    if (!wallet.publicKey || !tokenMint) return;
    setBusyTier(tier);
    setStatus(`Unwrapping CryptoBulls #${tier}... please approve in your wallet`);
    try {
      const program = getProgram(connection, wallet as any);
      const result = await unwrapBull(program, wallet.publicKey, tokenMint, tier, nftMint);
      setStatus(`✓ Unwrapped CryptoBulls #${tier} - 1,000,000 $BULLS returned. ${result.signature}`);
      await refresh();
    } catch (e: any) {
      console.error(e);
      setStatus(`✗ ${e.message ?? e}`);
    } finally {
      setBusyTier(null);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="h1 mb-3">Unwrap your <span style={{ color: "var(--bull-accent)" }}>Bulls</span></h1>
      <p className="text-[var(--bull-dim)] text-lg mb-10">
        Burn the NFT, redeem the 1,000,000 $BULLS. Anyone holding a Bull NFT can unwrap it - you don't need to be the original wrapper.
      </p>

      {!wallet.connected ? (
        <div className="card text-center py-12">
          <div className="text-xl font-bold mb-3">Connect your wallet</div>
          <p className="text-[var(--bull-dim)] mb-6">Phantom, Solflare, or any Solana wallet.</p>
          <p className="text-xs text-[var(--bull-dim)]">Use the <span className="text-[var(--bull-accent)]">Select Wallet</span> button in the top right.</p>
        </div>
      ) : loading ? (
        <div className="card">
          <div className="text-[var(--bull-dim)]">Loading your bulls...</div>
        </div>
      ) : bulls.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-xl font-bold mb-3">No bulls in this wallet</div>
          <p className="text-[var(--bull-dim)] mb-6">Wrap your first bull, or buy one on a marketplace.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/wrap" className="btn btn-primary">Wrap a bull →</Link>
            <Link href="/gallery" className="btn btn-secondary">Browse the herd</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="text-sm text-[var(--bull-dim)] mb-4">
            You hold <span className="text-[var(--bull-accent)] font-bold">{bulls.length}</span> bull{bulls.length === 1 ? "" : "s"}, worth <span className="text-[var(--bull-accent)] font-bold">{(bulls.length * 1_000_000).toLocaleString()} $BULLS</span> on unwrap.
          </div>

          {status && (
            <div className="card mb-6 text-sm text-[var(--bull-dim)] break-words">{status}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bulls.map((b) => (
              <div key={b.tier} className="card">
                <div className="aspect-square rounded-lg overflow-hidden bg-[#0a0a0c] mb-3">
                  <img
                    src={`/api/render/${b.tier}`}
                    alt={`CryptoBulls #${b.tier}`}
                    className="w-full h-full pixelated"
                    loading="lazy"
                  />
                </div>
                <div className="text-xs text-[var(--bull-dim)]">CryptoBulls</div>
                <div className="text-lg font-bold mb-3">#{b.tier}</div>
                <button
                  className="btn btn-primary w-full"
                  onClick={() => handleUnwrap(b.tier, b.nftMint)}
                  disabled={busyTier !== null}
                >
                  {busyTier === b.tier ? "Working..." : "Unwrap → 1M $BULLS"}
                </button>
                <Link href={`/bull/${b.tier}`} className="btn btn-ghost w-full mt-2 text-xs">
                  View details →
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
