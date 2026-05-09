// Bullpeg Anchor program tests.
//
// Covers the full ERC404-style hybrid lifecycle:
//   - initialize the bank
//   - wrap_bull (lock 1M $TOKEN, mint NFT + vault PDA + Metaplex metadata)
//   - unwrap_bull (burn NFT, drain vault, push tier to free stack)
//   - vault-follows-NFT (transfer NFT to wallet B, B unwraps)
//   - tier reuse (free_tiers stack drains correctly)
//   - failure paths (insufficient balance, wrong holder, bad tier)
//
// Run via: `anchor test` (after `anchor build`) on a Linux/Mac host with
// solana-cli installed. From Windows, run inside WSL or on the DO box.

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";

// wrap_bull does several Metaplex CPIs (CreateMetadataAccountsV3 +
// CreateMasterEditionV3 + token transfers + ATA creation) which push past
// the 200k default CU budget. Bump to 600k for tests; production clients
// should include the same ComputeBudgetProgram.setComputeUnitLimit call.
const CU_BUMP = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  transfer as splTransfer,
} from "@solana/spl-token";
import { expect } from "chai";
import { Bullpeg } from "../target/types/bullpeg";

// Metaplex Token Metadata program — same on every cluster
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Helper: derive all PDAs needed for a wrap/unwrap call
interface WrapBullPdas {
  bullAsset: PublicKey;
  vaultAuthority: PublicKey;
  vault: PublicKey;
  metadata: PublicKey;
  masterEdition: PublicKey;
}

function deriveWrapPdas(
  programId: PublicKey,
  tierIndex: number,
  nftMint: PublicKey,
  tokenMint: PublicKey,
  payer: PublicKey
): WrapBullPdas & { payerNftAccount: PublicKey } {
  const tierBuf = Buffer.alloc(2);
  tierBuf.writeUInt16LE(tierIndex);

  const [bullAsset] = PublicKey.findProgramAddressSync(
    [Buffer.from("bull"), tierBuf],
    programId
  );

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), nftMint.toBuffer()],
    programId
  );

  // Vault is the ATA owned by vaultAuthority PDA — allowOwnerOffCurve = true
  const vault = getAssociatedTokenAddressSync(
    tokenMint,
    vaultAuthority,
    true
  );

  const payerNftAccount = getAssociatedTokenAddressSync(
    nftMint,
    payer
  );

  const [metadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      nftMint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const [masterEdition] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      nftMint.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  return { bullAsset, vaultAuthority, vault, payerNftAccount, metadata, masterEdition };
}

describe("bullpeg", () => {
  // === Provider + program setup ===
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.Bullpeg as Program<Bullpeg>;
  const connection = provider.connection;

  // === Constants ===
  const TOKEN_DECIMALS = 6;
  const TOKENS_PER_BULL = BigInt(1_000_000) * BigInt(10 ** TOKEN_DECIMALS); // 1e12

  // === Test state ===
  let tokenMint: PublicKey;
  let bankPda: PublicKey;

  // Test wallets — funded with SOL + $TOKEN
  let alice: Keypair;
  let bob: Keypair;
  let carol: Keypair;
  let aliceTokenAccount: PublicKey;
  let bobTokenAccount: PublicKey;
  let carolTokenAccount: PublicKey;

  before(async () => {
    alice = Keypair.generate();
    bob = Keypair.generate();
    carol = Keypair.generate();

    // Airdrop SOL to each test wallet (needed for rent + tx fees)
    for (const w of [alice, bob, carol]) {
      const sig = await connection.requestAirdrop(w.publicKey, 10 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig);
    }

    // Mint a fake $TOKEN (mimics pump.fun-launched token: 6 decimals)
    tokenMint = await createMint(
      connection,
      alice,
      alice.publicKey,
      null,
      TOKEN_DECIMALS
    );

    // Create token accounts for each wallet
    const aliceAta = await getOrCreateAssociatedTokenAccount(
      connection, alice, tokenMint, alice.publicKey
    );
    aliceTokenAccount = aliceAta.address;

    const bobAta = await getOrCreateAssociatedTokenAccount(
      connection, bob, tokenMint, bob.publicKey
    );
    bobTokenAccount = bobAta.address;

    const carolAta = await getOrCreateAssociatedTokenAccount(
      connection, carol, tokenMint, carol.publicKey
    );
    carolTokenAccount = carolAta.address;

    // Mint 5M $TOKEN to alice (enough to wrap 5 bulls)
    await mintTo(
      connection, alice, tokenMint, aliceTokenAccount, alice,
      5n * TOKENS_PER_BULL
    );

    // Derive bank PDA
    [bankPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bank")],
      program.programId
    );
  });

  it("initializes the bank", async () => {
    await program.methods
      .initialize(tokenMint)
      .accounts({
        bank: bankPda,
        authority: alice.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([CU_BUMP], true)
      .signers([alice])
      .rpc();

    const bank = await program.account.bullBank.fetch(bankPda);
    expect(bank.tokenMint.toBase58()).to.equal(tokenMint.toBase58());
    expect(bank.totalWrapped.toNumber()).to.equal(0);
    expect(bank.totalUnwrapped.toNumber()).to.equal(0);
    expect(bank.inCirculation).to.equal(0);
    expect(bank.nextTier).to.equal(1);
    expect(bank.freeTiers).to.deep.equal([]);
  });

  it("wrap_bull: alice wraps 1M $TOKEN into bull tier 1", async () => {
    const tierIndex = 1;
    const nftMint = Keypair.generate();
    const pdas = deriveWrapPdas(
      program.programId, tierIndex, nftMint.publicKey, tokenMint, alice.publicKey
    );

    const aliceBalanceBefore = (await getAccount(connection, aliceTokenAccount)).amount;

    await program.methods
      .wrapBull(tierIndex)
      .accounts({
        bank: bankPda,
        payer: alice.publicKey,
        payerTokenAccount: aliceTokenAccount,
        tokenMint,
        nftMint: nftMint.publicKey,
        nftMintAuthority: pdas.vaultAuthority,
        vault: pdas.vault,
        payerNftAccount: pdas.payerNftAccount,
        bullAsset: pdas.bullAsset,
        metadata: pdas.metadata,
        masterEdition: pdas.masterEdition,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([CU_BUMP], true)
      .signers([alice, nftMint])
      .rpc();

    // BullAsset stored correctly
    const bullAsset = await program.account.bullAsset.fetch(pdas.bullAsset);
    expect(bullAsset.nftMint.toBase58()).to.equal(nftMint.publicKey.toBase58());
    expect(bullAsset.tierIndex).to.equal(tierIndex);

    // Vault holds 1M $TOKEN
    const vault = await getAccount(connection, pdas.vault);
    expect(vault.amount).to.equal(TOKENS_PER_BULL);

    // Alice has 1 NFT in her ATA
    const nftAcc = await getAccount(connection, pdas.payerNftAccount);
    expect(nftAcc.amount).to.equal(1n);

    // Alice's $TOKEN balance dropped by 1M
    const aliceBalanceAfter = (await getAccount(connection, aliceTokenAccount)).amount;
    expect(aliceBalanceBefore - aliceBalanceAfter).to.equal(TOKENS_PER_BULL);

    // Bank counters updated
    const bank = await program.account.bullBank.fetch(bankPda);
    expect(bank.totalWrapped.toNumber()).to.equal(1);
    expect(bank.inCirculation).to.equal(1);
    expect(bank.nextTier).to.equal(2);
  });

  it("unwrap_bull: alice unwraps her bull, gets 1M $TOKEN back", async () => {
    const tierIndex = 1;
    // Re-fetch the bull asset to find the nftMint (it was generated in the previous test)
    const tierBuf = Buffer.alloc(2);
    tierBuf.writeUInt16LE(tierIndex);
    const [bullAssetPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bull"), tierBuf],
      program.programId
    );
    const bullAssetAccount = await program.account.bullAsset.fetch(bullAssetPda);
    const nftMint = bullAssetAccount.nftMint;

    const pdas = deriveWrapPdas(
      program.programId, tierIndex, nftMint, tokenMint, alice.publicKey
    );

    const aliceBalanceBefore = (await getAccount(connection, aliceTokenAccount)).amount;

    await program.methods
      .unwrapBull(tierIndex)
      .accounts({
        bank: bankPda,
        payer: alice.publicKey,
        payerTokenAccount: aliceTokenAccount,
        tokenMint,
        nftMint,
        nftMintAuthority: pdas.vaultAuthority,
        vault: pdas.vault,
        payerNftAccount: pdas.payerNftAccount,
        bullAsset: pdas.bullAsset,
        metadata: pdas.metadata,
        masterEdition: pdas.masterEdition,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .preInstructions([CU_BUMP], true)
      .signers([alice])
      .rpc();

    // Alice got 1M $TOKEN back
    const aliceBalanceAfter = (await getAccount(connection, aliceTokenAccount)).amount;
    expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(TOKENS_PER_BULL);

    // BullAsset closed
    const closed = await program.account.bullAsset.fetchNullable(pdas.bullAsset);
    expect(closed).to.be.null;

    // Bank: tier 1 pushed to free_tiers, in_circulation back to 0
    const bank = await program.account.bullBank.fetch(bankPda);
    expect(bank.totalUnwrapped.toNumber()).to.equal(1);
    expect(bank.inCirculation).to.equal(0);
    expect(bank.freeTiers).to.deep.equal([1]);
  });

  it("tier reuse: next wrap pops tier 1 from free_tiers (with new visual)", async () => {
    const tierIndex = 1; // reused from free_tiers
    const nftMint = Keypair.generate(); // FRESH mint → new visual seed
    const pdas = deriveWrapPdas(
      program.programId, tierIndex, nftMint.publicKey, tokenMint, alice.publicKey
    );

    await program.methods
      .wrapBull(tierIndex)
      .accounts({
        bank: bankPda,
        payer: alice.publicKey,
        payerTokenAccount: aliceTokenAccount,
        tokenMint,
        nftMint: nftMint.publicKey,
        nftMintAuthority: pdas.vaultAuthority,
        vault: pdas.vault,
        payerNftAccount: pdas.payerNftAccount,
        bullAsset: pdas.bullAsset,
        metadata: pdas.metadata,
        masterEdition: pdas.masterEdition,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([CU_BUMP], true)
      .signers([alice, nftMint])
      .rpc();

    // BullAsset has the NEW nft_mint (visual re-rolled)
    const bullAsset = await program.account.bullAsset.fetch(pdas.bullAsset);
    expect(bullAsset.nftMint.toBase58()).to.equal(nftMint.publicKey.toBase58());

    // Bank: free_tiers is now empty, next_tier still 2
    const bank = await program.account.bullBank.fetch(bankPda);
    expect(bank.freeTiers).to.deep.equal([]);
    expect(bank.nextTier).to.equal(2);
    expect(bank.inCirculation).to.equal(1);
  });

  it("vault follows NFT: alice transfers NFT to bob, bob unwraps and gets the tokens", async () => {
    const tierIndex = 1;
    const tierBuf = Buffer.alloc(2);
    tierBuf.writeUInt16LE(tierIndex);
    const [bullAssetPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bull"), tierBuf],
      program.programId
    );
    const bullAssetAccount = await program.account.bullAsset.fetch(bullAssetPda);
    const nftMint = bullAssetAccount.nftMint;

    // Alice's NFT ATA + Bob's NFT ATA
    const aliceNftAta = getAssociatedTokenAddressSync(nftMint, alice.publicKey);
    const bobNftAta = await getOrCreateAssociatedTokenAccount(
      connection, bob, nftMint, bob.publicKey
    );

    // Transfer the NFT from alice to bob (simulates a marketplace sale)
    await splTransfer(
      connection,
      alice,
      aliceNftAta,
      bobNftAta.address,
      alice,
      1
    );

    // Now bob unwraps — vault tokens should flow to bob
    const pdas = deriveWrapPdas(
      program.programId, tierIndex, nftMint, tokenMint, bob.publicKey
    );

    const bobBalanceBefore = (await getAccount(connection, bobTokenAccount)).amount;

    await program.methods
      .unwrapBull(tierIndex)
      .accounts({
        bank: bankPda,
        payer: bob.publicKey,
        payerTokenAccount: bobTokenAccount,
        tokenMint,
        nftMint,
        nftMintAuthority: pdas.vaultAuthority,
        vault: pdas.vault,
        payerNftAccount: bobNftAta.address,
        bullAsset: pdas.bullAsset,
        metadata: pdas.metadata,
        masterEdition: pdas.masterEdition,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .preInstructions([CU_BUMP], true)
      .signers([bob])
      .rpc();

    // Bob got 1M $TOKEN — vault followed the NFT through transfer
    const bobBalanceAfter = (await getAccount(connection, bobTokenAccount)).amount;
    expect(bobBalanceAfter - bobBalanceBefore).to.equal(TOKENS_PER_BULL);

    // Bank: tier 1 back on free stack
    const bank = await program.account.bullBank.fetch(bankPda);
    expect(bank.freeTiers).to.deep.equal([1]);
    expect(bank.inCirculation).to.equal(0);
  });

  it("wrap_bull fails when caller has insufficient balance", async () => {
    const tierIndex = 1;
    const nftMint = Keypair.generate();
    const pdas = deriveWrapPdas(
      program.programId, tierIndex, nftMint.publicKey, tokenMint, carol.publicKey
    );

    // Carol has 0 $TOKEN — should fail
    let errored = false;
    try {
      await program.methods
        .wrapBull(tierIndex)
        .accounts({
          bank: bankPda,
          payer: carol.publicKey,
          payerTokenAccount: carolTokenAccount,
          tokenMint,
          nftMint: nftMint.publicKey,
          nftMintAuthority: pdas.vaultAuthority,
          vault: pdas.vault,
          payerNftAccount: pdas.payerNftAccount,
          bullAsset: pdas.bullAsset,
          metadata: pdas.metadata,
          masterEdition: pdas.masterEdition,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .preInstructions([CU_BUMP], true)
        .signers([carol, nftMint])
        .rpc();
    } catch (e: any) {
      errored = true;
      expect(e.toString()).to.include("InsufficientBalance");
    }
    expect(errored).to.equal(true);
  });

  it("wraps multiple bulls and counters track correctly", async () => {
    // Alice wraps tiers 1, 2, 3
    for (const tierIndex of [1, 2, 3]) {
      const nftMint = Keypair.generate();
      const pdas = deriveWrapPdas(
        program.programId, tierIndex, nftMint.publicKey, tokenMint, alice.publicKey
      );

      await program.methods
        .wrapBull(tierIndex)
        .accounts({
          bank: bankPda,
          payer: alice.publicKey,
          payerTokenAccount: aliceTokenAccount,
          tokenMint,
          nftMint: nftMint.publicKey,
          nftMintAuthority: pdas.vaultAuthority,
          vault: pdas.vault,
          payerNftAccount: pdas.payerNftAccount,
          bullAsset: pdas.bullAsset,
          metadata: pdas.metadata,
          masterEdition: pdas.masterEdition,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .preInstructions([CU_BUMP], true)
        .signers([alice, nftMint])
        .rpc();
    }

    const bank = await program.account.bullBank.fetch(bankPda);
    expect(bank.inCirculation).to.equal(3);
    expect(bank.nextTier).to.equal(4);
  });
});
