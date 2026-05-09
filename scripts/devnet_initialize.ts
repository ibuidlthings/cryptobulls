// Devnet initialize: creates the BullBank PDA and locks the test token mint.
// Usage: npx ts-node scripts/devnet_initialize.ts <TOKEN_MINT>
// Env: ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Bullpeg } from "../target/types/bullpeg";

async function main() {
  const tokenMintArg = process.argv[2];
  if (!tokenMintArg) {
    console.error("usage: ts-node devnet_initialize.ts <TOKEN_MINT>");
    process.exit(1);
  }

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Bullpeg as anchor.Program<Bullpeg>;

  const tokenMint = new PublicKey(tokenMintArg);
  const [bankPda, bankBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bank")],
    program.programId
  );

  console.log("program id:", program.programId.toBase58());
  console.log("token mint:", tokenMint.toBase58());
  console.log("bank pda:  ", bankPda.toBase58(), "(bump", bankBump + ")");
  console.log("authority: ", provider.wallet.publicKey.toBase58());

  const sig = await program.methods
    .initialize(tokenMint)
    .accounts({
      bank: bankPda,
      authority: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .rpc();

  console.log("\ninitialized. tx:", sig);
  console.log("explorer: https://explorer.solana.com/tx/" + sig + "?cluster=devnet");

  const bank = await (program.account as any).bullBank.fetch(bankPda);
  console.log("\nbank state:");
  console.log("  token_mint:    ", bank.tokenMint.toBase58());
  console.log("  next_tier:     ", bank.nextTier);
  console.log("  total_wrapped: ", bank.totalWrapped.toString());
  console.log("  in_circulation:", bank.inCirculation);
}

main().catch((e) => { console.error(e); process.exit(1); });
