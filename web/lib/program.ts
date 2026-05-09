// Browser-side helpers for building wrap_bull / unwrap_bull transactions.
// Uses @coral-xyz/anchor with the locally-bundled IDL.

import {
  AnchorProvider,
  Program,
  BN,
  Idl,
} from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  Transaction,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import idl from "./idl.json";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
    "A2tUttiL2v2fYxPyeUSZ75CqnjDp5sewCqcnXubgoxm"
);

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Pump.fun tokens are 6 decimals. 1M whole tokens = 1e12 base units.
export const TOKENS_PER_BULL_BASE = 1_000_000_000_000n;
export const TOKENS_PER_BULL_WHOLE = 1_000_000;

export function bankPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("bank")], PROGRAM_ID);
}

export function bullAssetPda(tier: number): [PublicKey, number] {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(tier, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bull"), buf],
    PROGRAM_ID
  );
}

export function vaultAuthorityPda(nftMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), nftMint.toBuffer()],
    PROGRAM_ID
  );
}

export function metadataPda(nftMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      nftMint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
}

export function masterEditionPda(nftMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      nftMint.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
}

export interface WalletLike {
  publicKey: PublicKey;
  signTransaction<T extends Transaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction>(txs: T[]): Promise<T[]>;
}

export function getProgram(connection: Connection, wallet: WalletLike): Program<Idl> {
  const provider = new AnchorProvider(
    connection,
    wallet as any,
    AnchorProvider.defaultOptions()
  );
  return new Program(idl as Idl, provider);
}

export async function fetchBank(program: Program<Idl>) {
  const [pda] = bankPda();
  return await (program.account as any).bullBank.fetch(pda);
}

export async function fetchUserTokenBalance(
  conn: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<bigint> {
  try {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    const acct = await getAccount(conn, ata);
    return acct.amount;
  } catch {
    return 0n;
  }
}

export async function fetchUserOwnedBulls(
  conn: Connection,
  owner: PublicKey,
  program: Program<Idl>
): Promise<{ tier: number; nftMint: PublicKey; bullAsset: PublicKey }[]> {
  // 1. Get all token accounts owned by user with amount > 0
  const accounts = await conn.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });
  const candidateMints = accounts.value
    .filter((a) => {
      const info = a.account.data.parsed.info;
      return Number(info.tokenAmount.amount) === 1 && info.tokenAmount.decimals === 0;
    })
    .map((a) => new PublicKey(a.account.data.parsed.info.mint));

  if (candidateMints.length === 0) return [];

  // 2. Fetch all BullAsset accounts and filter to those whose nft_mint is in our set
  const allBulls = await (program.account as any).bullAsset.all();
  const owned: { tier: number; nftMint: PublicKey; bullAsset: PublicKey }[] = [];
  const candidateSet = new Set(candidateMints.map((m) => m.toBase58()));
  for (const b of allBulls) {
    const nftMint: PublicKey = b.account.nftMint;
    if (candidateSet.has(nftMint.toBase58())) {
      owned.push({ tier: b.account.tierIndex, nftMint, bullAsset: b.publicKey });
    }
  }
  return owned;
}

export const CU_BUMP = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });

export interface WrapResult {
  signature: string;
  tier: number;
  nftMint: PublicKey;
}

export async function wrapBull(
  program: Program<Idl>,
  payer: PublicKey,
  tokenMint: PublicKey,
  tier: number
): Promise<WrapResult> {
  const nftMint = Keypair.generate();
  const [bank] = bankPda();
  const [vaultAuthority] = vaultAuthorityPda(nftMint.publicKey);
  const [bullAsset] = bullAssetPda(tier);
  const vault = getAssociatedTokenAddressSync(tokenMint, vaultAuthority, true);
  const payerTokenAccount = getAssociatedTokenAddressSync(tokenMint, payer);
  const payerNftAccount = getAssociatedTokenAddressSync(nftMint.publicKey, payer);
  const [metadata] = metadataPda(nftMint.publicKey);
  const [masterEdition] = masterEditionPda(nftMint.publicKey);

  const sig = await (program.methods as any)
    .wrapBull(tier)
    .accounts({
      bank,
      payer,
      payerTokenAccount,
      tokenMint,
      nftMint: nftMint.publicKey,
      nftMintAuthority: vaultAuthority,
      vault,
      payerNftAccount,
      bullAsset,
      metadata,
      masterEdition,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .preInstructions([CU_BUMP])
    .signers([nftMint])
    .rpc();

  return { signature: sig, tier, nftMint: nftMint.publicKey };
}

export interface UnwrapResult {
  signature: string;
  tier: number;
}

export async function unwrapBull(
  program: Program<Idl>,
  payer: PublicKey,
  tokenMint: PublicKey,
  tier: number,
  nftMint: PublicKey
): Promise<UnwrapResult> {
  const [bank] = bankPda();
  const [vaultAuthority] = vaultAuthorityPda(nftMint);
  const [bullAsset] = bullAssetPda(tier);
  const vault = getAssociatedTokenAddressSync(tokenMint, vaultAuthority, true);
  const payerTokenAccount = getAssociatedTokenAddressSync(tokenMint, payer);
  const payerNftAccount = getAssociatedTokenAddressSync(nftMint, payer);
  const [metadata] = metadataPda(nftMint);
  const [masterEdition] = masterEditionPda(nftMint);

  const sig = await (program.methods as any)
    .unwrapBull(tier)
    .accounts({
      bank,
      payer,
      payerTokenAccount,
      tokenMint,
      nftMint,
      nftMintAuthority: vaultAuthority,
      vault,
      payerNftAccount,
      bullAsset,
      metadata,
      masterEdition,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    })
    .preInstructions([CU_BUMP])
    .rpc();

  return { signature: sig, tier };
}
