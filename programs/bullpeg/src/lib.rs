// Bullpeg: ERC404-style hybrid token-NFT layer for pump.fun-launched tokens.
//
// Pump.fun launches standard SPL tokens (no transfer hooks). SPL-404 exists
// on Solana but requires Token-2022 — incompatible with pump.fun. Bullpeg
// bridges that gap with an NFT-owned vault PDA pattern: each bull NFT has
// a vault holding 1,000,000 of the underlying $TOKEN, and the vault's
// authority is derived from the NFT's mint address.
//
// Result: when an NFT trades on Magic Eden / Tensor, the locked tokens
// follow the NFT atomically. Buy the NFT → you control the vault. Sell
// the NFT → the buyer controls the vault. ERC404-style inseparability
// without modifying the underlying token.
//
// Two user-initiated instructions:
//   - wrap_bull: lock 1M $TOKEN into a fresh NFT (caller must hold ≥1M).
//   - unwrap_bull: burn the NFT and release the 1M $TOKEN (caller must
//     hold the NFT).
//
// The off-chain renderer seeds visuals from the NFT mint address, so the
// art is locked at wrap time and stays with the NFT through transfers.

use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod errors;

use instructions::*;

// Program ID (matches target/deploy/bullpeg-keypair.json on the dev box).
declare_id!("EaRLH7zU6BCJqJVzL8svMNbXxJbrVGwi4sAwd7NLHzRg");

// ---- Protocol constants ----

/// Tokens-per-bull threshold expressed in base units.
/// Pump.fun tokens have 6 decimals, so 1,000,000 whole tokens = 1e12 base units.
pub const TOKENS_PER_BULL: u64 = 1_000_000_000_000;

/// Maximum bulls that can be wrapped at any one time.
/// At 1B token supply / 1M per bull, the natural cap is 1000 bulls.
pub const MAX_BULLS: u16 = 1_000;

#[program]
pub mod bullpeg {
    use super::*;

    /// One-time setup: creates the BullBank singleton PDA and locks the
    /// $TOKEN mint address. The mint is immutable thereafter — switching
    /// mints requires a fresh deployment.
    pub fn initialize(ctx: Context<Initialize>, token_mint: Pubkey) -> Result<()> {
        instructions::initialize::handler(ctx, token_mint)
    }

    /// Wrap 1M $TOKEN into a fresh bull NFT.
    ///
    /// Caller must:
    ///   1. Generate a fresh keypair for the NFT mint client-side
    ///   2. Pre-compute the next tier_index from BullBank state
    ///   3. Sign as both `payer` and `nft_mint` keypair
    ///
    /// The 1M tokens are transferred from the caller's $TOKEN account into
    /// a vault PDA derived from the new NFT mint. The vault's authority is
    /// `PDA(["vault", nft_mint])`, so whoever holds the NFT controls the
    /// vault via this program. The Metaplex NFT is fully tradeable on
    /// Magic Eden / Tensor / any standard marketplace.
    pub fn wrap_bull(ctx: Context<WrapBull>, tier_index: u16) -> Result<()> {
        instructions::wrap_bull::handler(ctx, tier_index)
    }

    /// Unwrap a bull NFT, releasing the locked 1M $TOKEN to the caller.
    ///
    /// Caller must hold 1 of the bull's NFT in their ATA. Verified on-chain.
    /// After this instruction:
    ///   - 1M $TOKEN flows from vault → caller
    ///   - NFT mint, ATA, metadata, master edition, and BullAsset are closed
    ///   - tier_index goes back onto the free_tiers stack for reuse
    ///   - Reused tiers re-roll their visual (new NFT mint = new seed)
    pub fn unwrap_bull(ctx: Context<UnwrapBull>, tier_index: u16) -> Result<()> {
        instructions::unwrap_bull::handler(ctx, tier_index)
    }
}
