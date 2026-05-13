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
  Commitment,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
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

// MCC: Metaplex Certified Collection authority is a program PDA so the
// program signs verify_sized_collection_item on every wrap.
export function collectionAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collection_authority")],
    PROGRAM_ID
  );
}

export interface WalletLike {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

export function getProgram(connection: Connection, wallet: WalletLike): Program<Idl> {
  const provider = new AnchorProvider(
    connection,
    wallet as any,
    AnchorProvider.defaultOptions()
  );
  return new Program(idl as Idl, provider);
}

// Reads default to "processed" commitment. Anchor's rpc() returns when the
// write has reached "processed", so reading at the same level guarantees
// the just-confirmed write is visible. Reading at "confirmed" can race —
// the node returning the read may not have finalized to that level yet,
// causing post-wrap UI to display stale free_tiers / next_tier.
export async function fetchBank(
  program: Program<Idl>,
  commitment: Commitment = "processed"
) {
  const [pda] = bankPda();
  return await (program.account as any).bullBank.fetch(pda, commitment);
}

// Poll the bank account until `bank.totalWrapped >= target`, or timeout.
// Used after a successful wrap_bull to make sure the next read (used to
// compute the next tier-to-wrap) sees the post-wrap state. Without this,
// two-wraps-in-a-row can show the just-wrapped tier again, which then
// fails on click with custom error 0x0 (PDA already in use).
export async function waitForBankAdvance(
  program: Program<Idl>,
  targetTotalWrapped: bigint,
  maxWaitMs = 4000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const b: any = await fetchBank(program, "processed");
      if (BigInt(b.totalWrapped.toString()) >= targetTotalWrapped) return;
    } catch {
      /* swallow transient RPC errors and retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  // Don't throw — the UI's refresh() will eventually catch up.
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

// Thrown when our pre-sign simulation fails. The page catches this and
// surfaces `logs` so the user sees the actual on-chain failure reason
// instead of a Phantom "Request blocked" wall.
export class SimulationError extends Error {
  readonly logs: string[];
  readonly simErr: unknown;
  constructor(message: string, logs: string[], simErr: unknown) {
    super(message);
    this.name = "SimulationError";
    this.logs = logs;
    this.simErr = simErr;
  }
}

// Build → simulate → sign → send, in the exact order Phantom's docs prescribe.
//
// Why not Anchor's `.rpc()`?
//   Anchor builds → signs → sends. It does NOT call `simulateTransaction`
//   before asking the wallet to sign. When Phantom's pre-sign Lighthouse
//   check finds an on-chain failure it surfaces a generic "Request blocked /
//   transaction reverted during simulation" warning. By simulating ourselves
//   first we (a) prove the tx will succeed before Phantom sees it, so its
//   own Lighthouse check passes too; or (b) catch a real failure early and
//   surface the actual log lines.
//
// This implements all four mitigations from
// https://docs.phantom.com/developer-powertools/domain-and-transaction-warnings :
//   1. Single signer (the payer) — enforced by our IDL.
//   2. Phantom signs first via signTransaction (not signAndSendTransaction).
//   3. Tx size logged when NEXT_PUBLIC_DEBUG_TX=1, so size regressions show up.
//   4. Server-side simulate with sigVerify:false before signing.
async function buildSignSimulateSend(
  connection: Connection,
  wallet: WalletLike,
  builder: any,
  label: string,
): Promise<string> {
  // 1. Build instructions via Anchor, then wrap into a VersionedTransaction.
  //    The modern web3.js simulateTransaction overload — the only one that
  //    accepts { sigVerify: false } — requires VersionedTransaction. We
  //    tried casting the legacy overload to `any` and it threw "Invalid
  //    arguments" at runtime because the second positional is `signers`,
  //    not a config object.
  const legacyTx: Transaction = await builder.transaction();
  const instructions = legacyTx.instructions;

  // 2. "finalized" blockhash avoids the race where Phantom resimulates
  //    against a not-yet-surfaced slot and surfaces a generic warning.
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("finalized");

  // 3. Compile v0 message. Single signer (payer) — IDL confirms only
  //    payer is signer:true for wrap_bull/unwrap_bull.
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);

  // 4. Server-side simulate FIRST (Phantom mitigation #4). sigVerify:false
  //    because tx isn't signed yet. This is the step Anchor's .rpc() skips.
  const sim = await connection.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: false,
    commitment: "processed",
  });

  // 5. Always-on diagnostic. Copy/paste this object from the browser
  //    console into Phantom support tickets — it contains everything they
  //    need to reproduce.
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log(`[bullpeg-tx:${label}]`, {
      size: tx.serialize().length,
      numRequiredSignatures: message.header.numRequiredSignatures,
      numReadonlySignedAccounts: message.header.numReadonlySignedAccounts,
      numReadonlyUnsignedAccounts: message.header.numReadonlyUnsignedAccounts,
      staticAccountKeys: message.staticAccountKeys.length,
      simulationErr: sim.value.err,
      simulationLogs: sim.value.logs,
      txVersion: message.version,
      blockhash,
    });
  }

  if (sim.value.err) {
    const logs: string[] = sim.value.logs ?? [];
    // Anchor emits errors as "AnchorError ... Error Code: X. Error
    // Number: Y. Error Message: Z". Pull the human-readable line.
    const errLine =
      logs.find((l: string) => l.includes("Error Message:")) ??
      logs[logs.length - 1] ??
      "unknown";
    throw new SimulationError(
      `simulation failed: ${errLine}`,
      logs,
      sim.value.err,
    );
  }

  // 6. Phantom signs FIRST (Phantom mitigation #2). Single signer, so no
  //    partialSign step is required afterwards. signTransaction (NOT
  //    signAndSendTransaction) per Phantom's docs.
  const signedTx = await wallet.signTransaction(tx);

  // 7. Send raw. skipPreflight:false lets the RPC catch obvious failures
  //    locally; we already simulated above so this should be cheap.
  const sig = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "processed",
    maxRetries: 3,
  });

  // 8. Confirm using the same blockhash we built with, so we honor its
  //    lifetime rather than waiting on a fresh getBlockHeight loop.
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return sig;
}

export interface WrapResult {
  signature: string;
  tier: number;
  nftMint: PublicKey;
}

export async function wrapBull(
  program: Program<Idl>,
  connection: Connection,
  wallet: WalletLike,
  tokenMint: PublicKey,
  tier: number,
  collectionMint: PublicKey
): Promise<WrapResult> {
  // SINGLE-SIGNER pattern (Phantom's docs Bullet #1). nft_mint is a PDA
  // derived from bank.total_wrapped (pre-increment), so no random Keypair
  // signer is needed. Lighthouse can simulate cleanly.
  const payer = wallet.publicKey;
  const [bank] = bankPda();
  const bankAccount: any = await (program.account as any).bullBank.fetch(
    bank,
    "processed"
  );
  const totalWrappedBuf = Buffer.alloc(8);
  totalWrappedBuf.writeBigUInt64LE(BigInt(bankAccount.totalWrapped.toString()));
  const [nftMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("nft_mint"), totalWrappedBuf],
    PROGRAM_ID
  );

  const [vaultAuthority] = vaultAuthorityPda(nftMint);
  const [bullAsset] = bullAssetPda(tier);
  const vault = getAssociatedTokenAddressSync(tokenMint, vaultAuthority, true);
  const payerTokenAccount = getAssociatedTokenAddressSync(tokenMint, payer);
  const payerNftAccount = getAssociatedTokenAddressSync(nftMint, payer);
  const [metadata] = metadataPda(nftMint);
  const [masterEdition] = masterEditionPda(nftMint);
  // MCC accounts:
  const [collectionAuthority] = collectionAuthorityPda();
  const [collectionMetadata] = metadataPda(collectionMint);
  const [collectionMasterEdition] = masterEditionPda(collectionMint);

  const builder = (program.methods as any)
    .wrapBull(tier)
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
      collectionMint,
      collectionMetadata,
      collectionMasterEdition,
      collectionAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .preInstructions([CU_BUMP]);

  const signature = await buildSignSimulateSend(connection, wallet, builder, "wrapBull");
  return { signature, tier, nftMint };
}

export interface UnwrapResult {
  signature: string;
  tier: number;
}

export async function unwrapBull(
  program: Program<Idl>,
  connection: Connection,
  wallet: WalletLike,
  tokenMint: PublicKey,
  tier: number,
  nftMint: PublicKey,
  collectionMint: PublicKey
): Promise<UnwrapResult> {
  const payer = wallet.publicKey;
  const [bank] = bankPda();
  const [vaultAuthority] = vaultAuthorityPda(nftMint);
  const [bullAsset] = bullAssetPda(tier);
  const vault = getAssociatedTokenAddressSync(tokenMint, vaultAuthority, true);
  const payerTokenAccount = getAssociatedTokenAddressSync(tokenMint, payer);
  const payerNftAccount = getAssociatedTokenAddressSync(nftMint, payer);
  const [metadata] = metadataPda(nftMint);
  const [masterEdition] = masterEditionPda(nftMint);
  // burn_nft on a verified-collection NFT decrements the collection's
  // size counter, so we must pass the collection mint + metadata.
  const [collectionMetadata] = metadataPda(collectionMint);

  const builder = (program.methods as any)
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
      collectionMint,
      collectionMetadata,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    })
    .preInstructions([CU_BUMP]);

  const signature = await buildSignSimulateSend(connection, wallet, builder, "unwrapBull");
  return { signature, tier };
}
