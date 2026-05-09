use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{
    self, Mint, MintTo, Token, TokenAccount, Transfer,
};
use anchor_spl::metadata::{
    self,
    mpl_token_metadata::types::DataV2,
    CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata,
};

use crate::state::{BullAsset, BullBank};
use crate::errors::BullpegError;
use crate::{MAX_BULLS, TOKENS_PER_BULL};

/// Wrap 1,000,000 $TOKEN into a bull NFT.
///
/// Mechanic (ERC404-style hybrid):
/// 1. Caller's balance must be >= 1M $TOKEN.
/// 2. Pop a tier index from BullBank (free_tiers stack first, then next_tier).
/// 3. Initialize a fresh NFT mint (the caller-provided keypair signs).
/// 4. Initialize a vault token account at the NFT-derived PDA — the vault's
///    authority is `PDA(["vault", nft_mint])`. Whoever holds the NFT controls
///    this PDA (via this program), so the locked tokens follow the NFT
///    through every transfer (Magic Eden / Tensor / direct send).
/// 5. Transfer 1M $TOKEN: caller -> vault.
/// 6. Mint 1 of the new NFT to caller's ATA.
/// 7. Create Metaplex metadata + master edition (locks supply at 1, unique).
/// 8. Init BullAsset PDA recording (nft_mint, tier_index, wrapped_at).
///
/// The visual is generated deterministically from `nft_mint` by the off-chain
/// renderer — locked at wrap time, follows the NFT through transfers.
#[derive(Accounts)]
#[instruction(tier_index: u16)]
pub struct WrapBull<'info> {
    #[account(
        mut,
        seeds = [b"bank"],
        bump = bank.bump,
    )]
    pub bank: Account<'info, BullBank>,

    /// The wrapping wallet. Signs to authorize:
    ///   - 1M $TOKEN transfer out of their token account
    ///   - rent payment for new NFT mint, vault, ATAs, and BullAsset PDA
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Caller's $TOKEN account (source of the 1M tokens being locked).
    /// Boxed to keep the WrapBull stack frame under Solana's 4096-byte limit
    /// (this struct has 15 accounts; un-boxed they'd blow the stack).
    #[account(
        mut,
        constraint = payer_token_account.owner == payer.key(),
        constraint = payer_token_account.mint == bank.token_mint @ BullpegError::WrongMint,
    )]
    pub payer_token_account: Box<Account<'info, TokenAccount>>,

    /// $TOKEN mint (must match bank.token_mint — locked at initialize).
    #[account(constraint = token_mint.key() == bank.token_mint @ BullpegError::WrongMint)]
    pub token_mint: Box<Account<'info, Mint>>,

    /// Fresh keypair for the new NFT mint. Caller generates this client-side
    /// and passes the keypair as a signer. The mint is initialized here with
    /// decimals=0 and the vault PDA as both mint + freeze authority.
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = nft_mint_authority,
        mint::freeze_authority = nft_mint_authority,
    )]
    pub nft_mint: Box<Account<'info, Mint>>,

    /// PDA derived from the NFT mint. This single PDA serves as:
    ///   - the NFT mint's mint+freeze authority (until master edition takes over)
    ///   - the vault token account's authority (so vault tokens follow the NFT)
    /// CHECK: PDA, no data — validated by seeds + bump.
    #[account(
        seeds = [b"vault", nft_mint.key().as_ref()],
        bump,
    )]
    pub nft_mint_authority: UncheckedAccount<'info>,

    /// Vault: ATA owned by `nft_mint_authority` PDA, holding the 1M $TOKEN.
    /// Address is deterministic — anyone can compute it from (nft_mint, $TOKEN).
    /// When the NFT is sold on a marketplace, the new owner controls the
    /// `nft_mint_authority` PDA (via this program), so the vault tokens
    /// follow the NFT atomically.
    #[account(
        init,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = nft_mint_authority,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// Caller's ATA for the new NFT — receives 1 of the freshly minted NFT.
    #[account(
        init,
        payer = payer,
        associated_token::mint = nft_mint,
        associated_token::authority = payer,
    )]
    pub payer_nft_account: Box<Account<'info, TokenAccount>>,

    /// BullAsset record — created here, closed on unwrap.
    /// Seed: ["bull", tier_index_le_bytes]. Init failure protects against
    /// race conditions (two simultaneous wraps cannot claim the same tier).
    #[account(
        init,
        payer = payer,
        space = BullAsset::SIZE,
        seeds = [b"bull", tier_index.to_le_bytes().as_ref()],
        bump,
    )]
    pub bull_asset: Box<Account<'info, BullAsset>>,

    /// Metaplex metadata account for the NFT.
    /// CHECK: address is verified by the Metaplex program during CPI
    /// (it requires the standard PDA derivation).
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// Metaplex master edition account (limits supply to 1).
    /// CHECK: address verified by Metaplex program during CPI.
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<WrapBull>, tier_index: u16) -> Result<()> {
    // === 1. Validate balance ===
    let balance = ctx.accounts.payer_token_account.amount;
    require!(balance >= TOKENS_PER_BULL, BullpegError::InsufficientBalance);

    // === 2. Validate + pop tier ===
    require!(
        tier_index >= 1 && tier_index <= MAX_BULLS,
        BullpegError::TierOutOfBounds
    );
    let popped = ctx.accounts.bank.pop_tier()?;
    require!(popped == tier_index, BullpegError::TierMismatch);

    // === 3. Transfer 1M $TOKEN: payer -> vault ===
    {
        let cpi_accounts = Transfer {
            from: ctx.accounts.payer_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.key(),
            cpi_accounts,
        );
        token::transfer(cpi_ctx, TOKENS_PER_BULL)?;
    }

    // === Prepare PDA signer seeds (used for mint_to + Metaplex CPIs) ===
    let nft_mint_key = ctx.accounts.nft_mint.key();
    let auth_bump = ctx.bumps.nft_mint_authority;
    let signer_seeds: &[&[&[u8]]] = &[&[b"vault", nft_mint_key.as_ref(), &[auth_bump]]];

    // === 4. Mint 1 NFT to payer's ATA ===
    {
        let cpi_accounts = MintTo {
            mint: ctx.accounts.nft_mint.to_account_info(),
            to: ctx.accounts.payer_nft_account.to_account_info(),
            authority: ctx.accounts.nft_mint_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        token::mint_to(cpi_ctx, 1)?;
    }

    // === 5. Create Metaplex metadata account ===
    {
        let data = DataV2 {
            name: format!("CryptoBulls #{}", tier_index),
            symbol: "BULLS".to_string(),
            uri: format!("https://cryptobulls.fun/api/metadata/{}", tier_index),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };
        let cpi_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
            mint_authority: ctx.accounts.nft_mint_authority.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            update_authority: ctx.accounts.nft_mint_authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        metadata::create_metadata_accounts_v3(
            cpi_ctx,
            data,
            true,  // is_mutable
            true,  // update_authority_is_signer
            None,  // collection_details
        )?;
    }

    // === 6. Create master edition (max_supply=0 → 1-of-1, locks supply at 1) ===
    {
        let cpi_accounts = CreateMasterEditionV3 {
            edition: ctx.accounts.master_edition.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
            update_authority: ctx.accounts.nft_mint_authority.to_account_info(),
            mint_authority: ctx.accounts.nft_mint_authority.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            metadata: ctx.accounts.metadata.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        metadata::create_master_edition_v3(cpi_ctx, Some(0))?;
    }

    // === 7. Initialize BullAsset record ===
    let bull = &mut ctx.accounts.bull_asset;
    bull.nft_mint = ctx.accounts.nft_mint.key();
    bull.tier_index = tier_index;
    bull.wrapped_at = Clock::get()?.unix_timestamp;
    bull.bump = ctx.bumps.bull_asset;

    // === 8. Update bank totals ===
    let bank = &mut ctx.accounts.bank;
    bank.total_wrapped = bank.total_wrapped.saturating_add(1);
    bank.in_circulation = bank.in_circulation.saturating_add(1);

    msg!(
        "Wrapped bull tier={} nft_mint={} payer={}",
        tier_index,
        ctx.accounts.nft_mint.key(),
        ctx.accounts.payer.key()
    );

    Ok(())
}
