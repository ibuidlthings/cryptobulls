"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  fetchBank,
  fetchUserTokenBalance,
  getProgram,
  wrapBull,
  TOKENS_PER_BULL_BASE,
  TOKENS_PER_BULL_WHOLE,
} from "@/lib/program";

export default function WrapPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [loading, setLoading] = useState(true);
  const [bullsBalance, setBullsBalance] = useState<bigint>(0n);
  const [tokenMint, setTokenMint] = useState<string>("");
  const [nextTier, setNextTier] = useState<number>(0);
  const [bullsRemaining, setBullsRemaining] = useState<number>(1000);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [lastResult, setLastResult] = useState<{ tier: number; nftMint: string; sig: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) return;
    setLoading(true);
    try {
      const program = getProgram(connection, wallet as any);
      const bank = await fetchBank(program);
      setTokenMint(bank.tokenMint.toBase58());
      setNextTier(bank.nextTier);
      setBullsRemaining(Math.max(0, 1000 - bank.nextTier + 1 + bank.freeTiers.length));
      const bal = await fetchUserTokenBalance(connection, wallet.publicKey, bank.tokenMint);
      setBullsBalance(bal);
    } catch (e: any) {
      console.error(e);
      setStatus(`error: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => { refresh(); }, [refresh]);

  const eligibleWraps = Number(bullsBalance / TOKENS_PER_BULL_BASE);
  const balanceWhole = Number(bullsBalance) / 1_000_000;

  async function handleWrap() {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) return;
    if (!tokenMint) return;
    setBusy(true); setStatus("Building transaction...");
    try {
      const program = getProgram(connection, wallet as any);
      const tier = nextTier;
      const { PublicKey } = await import("@solana/web3.js");
      setStatus(`Wrapping CryptoBulls #${tier}... please approve in your wallet`);
      const result = await wrapBull(program, wallet.publicKey, new PublicKey(tokenMint), tier);
      setStatus(`✓ Wrapped CryptoBulls #${result.tier}`);
      setLastResult({ tier: result.tier, nftMint: result.nftMint.toBase58(), sig: result.signature });
      await refresh();
    } catch (e: any) {
      console.error(e);
      setStatus(`✗ ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="h1 mb-3">Wrap a <span style={{ color: "var(--bull-accent)" }}>Bull</span></h1>
      <p className="text-[var(--bull-dim)] text-lg mb-10">
        Lock 1,000,000 $BULLS into a fresh CryptoBull NFT. The vault follows the NFT through every transfer.
      </p>

      {!wallet.connected ? (
        <div className="card text-center py-12">
          <div className="text-xl font-bold mb-3">Connect your wallet</div>
          <p className="text-[var(--bull-dim)] mb-6">Phantom, Solflare, or any Solana wallet.</p>
          <p className="text-xs text-[var(--bull-dim)]">Use the <span className="text-[var(--bull-accent)]">Select Wallet</span> button in the top right.</p>
        </div>
      ) : loading ? (
        <div className="card">
          <div className="text-[var(--bull-dim)]">Loading on-chain state...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card">
              <div className="text-xs uppercase text-[var(--bull-dim)] tracking-wider mb-2">Your $BULLS</div>
              <div className="text-3xl font-extrabold text-[var(--bull-accent)]">
                {balanceWhole.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-[var(--bull-dim)] mt-1">tokens</div>
            </div>
            <div className="card">
              <div className="text-xs uppercase text-[var(--bull-dim)] tracking-wider mb-2">Eligible wraps</div>
              <div className="text-3xl font-extrabold text-[var(--bull-accent)]">{eligibleWraps}</div>
              <div className="text-xs text-[var(--bull-dim)] mt-1">at 1M each</div>
            </div>
          </div>

          <div className="card mb-6">
            <div className="text-xs uppercase text-[var(--bull-dim)] tracking-wider mb-3">Next bull</div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-[var(--bull-dim)]">You will mint</div>
                <div className="text-2xl font-bold">CryptoBulls #{nextTier}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--bull-dim)]">Slots remaining</div>
                <div className="text-2xl font-bold">{bullsRemaining}</div>
              </div>
            </div>
            <div className="text-xs text-[var(--bull-dim)] leading-relaxed mb-4">
              On wrap: 1,000,000 $BULLS → vault PDA. 1 NFT → your wallet. The visual is generated from the new NFT mint address - locked at wrap time, follows the NFT through marketplace transfers.
            </div>
            <button
              onClick={handleWrap}
              disabled={busy || eligibleWraps < 1 || bullsRemaining < 1}
              className="btn btn-primary w-full"
            >
              {busy ? "Working..." : eligibleWraps < 1 ? "Need 1,000,000 $BULLS to wrap" : bullsRemaining < 1 ? "All bulls are wrapped" : `Wrap CryptoBulls #${nextTier} →`}
            </button>
            {status && (
              <div className="text-sm text-[var(--bull-dim)] mt-3 break-words">{status}</div>
            )}
          </div>

          {lastResult && (
            <div className="card mb-6 border-[var(--bull-accent)]">
              <div className="text-xs uppercase text-[var(--bull-accent)] tracking-wider mb-3">✓ Wrapped</div>
              <Link href={`/bull/${lastResult.tier}`} className="block group">
                <div className="text-2xl font-bold mb-1 group-hover:text-[var(--bull-accent)]">CryptoBulls #{lastResult.tier} →</div>
              </Link>
              <div className="text-xs text-[var(--bull-dim)] break-all mb-2">NFT mint: {lastResult.nftMint}</div>
              <a
                href={`https://explorer.solana.com/tx/${lastResult.sig}?cluster=${process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet"}`}
                target="_blank" rel="noopener"
                className="text-xs text-[var(--bull-accent)] hover:underline"
              >
                View transaction on Solana Explorer →
              </a>
            </div>
          )}

          <div className="text-xs text-[var(--bull-dim)] text-center">
            Token mint: <span className="font-mono">{tokenMint}</span>
          </div>
        </>
      )}
    </main>
  );
}
