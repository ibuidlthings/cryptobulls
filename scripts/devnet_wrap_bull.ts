// Devnet wrap_bull: lock 1M test tokens into a fresh CryptoBulls NFT.
// Usage: npx ts-node scripts/devnet_wrap_bull.ts
// Reads token mint from BullBank state, generates fresh NFT mint, calls wrap_bull.

import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Bullpeg } from "../target/types/bullpeg";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Bullpeg as anchor.Program<Bullpeg>;
  const payer = provider.wallet;

  const [bankPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bank")],
    program.programId
  );
  const bank = await (program.account as any).bullBank.fetch(bankPda);
  const tokenMint = bank.tokenMint as PublicKey;
  const tier = (bank.freeTiers.length > 0
    ? bank.freeTiers[bank.freeTiers.length - 1]
    : bank.nextTier) as number;

  console.log("program:    ", program.programId.toBase58());
  console.log("bank:       ", bankPda.toBase58());
  console.log("token mint: ", tokenMint.toBase58());
  console.log("next tier:  ", tier);

  const nftMint = Keypair.generate();
  console.log("new nft mint:", nftMint.publicKey.toBase58());

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), nftMint.publicKey.toBuffer()],
    program.programId
  );
  const tierBytes = Buffer.alloc(2);
  tierBytes.writeUInt16LE(tier, 0);
  const [bullAsset] = PublicKey.findProgramAddressSync(
    [Buffer.from("bull"), tierBytes],
    program.programId
  );

  const vault = getAssociatedTokenAddressSync(tokenMint, vaultAuthority, true);
  const payerTokenAccount = getAssociatedTokenAddressSync(tokenMint, payer.publicKey);
  const payerNftAccount = getAssociatedTokenAddressSync(nftMint.publicKey, payer.publicKey);

  const [metadata] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), nftMint.publicKey.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );
  const [masterEdition] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), nftMint.publicKey.toBuffer(), Buffer.from("edition")],
    TOKEN_METADATA_PROGRAM_ID
  );

  console.log("vault:        ", vault.toBase58());
  console.log("vault auth:   ", vaultAuthority.toBase58());
  console.log("metadata:     ", metadata.toBase58());
  console.log("master edition:", masterEdition.toBase58());
  console.log("bull asset:   ", bullAsset.toBase58());

  const cuBump = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });

  console.log("\nsubmitting wrap_bull tx...");
  const sig = await program.methods
    .wrapBull(tier)
    .accounts({
      bank: bankPda,
      payer: payer.publicKey,
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
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    } as any)
    .preInstructions([cuBump])
    .signers([nftMint])
    .rpc();

  console.log("\nwrap_bull tx:", sig);
  console.log("explorer:    https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
  console.log("nft mint:    https://explorer.solana.com/address/" + nftMint.publicKey.toBase58() + "?cluster=devnet");
  console.log("bull asset:  https://explorer.solana.com/address/" + bullAsset.toBase58() + "?cluster=devnet");
  console.log("\nCheck Phantom devnet for the new CryptoBulls #" + tier + " NFT.");
}

main().catch((e) => { console.error(e); process.exit(1); });
