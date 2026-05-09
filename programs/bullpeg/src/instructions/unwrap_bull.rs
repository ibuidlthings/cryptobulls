use anchor_lang::prelude::*;
use anchor_spl::token::{
    self, CloseAccount, Mint, Token, TokenAccount, Transfer,
};
use anchor_spl::metadata::{self, BurnNft, Metadata};

use crate::state::{BullAsset, BullBank};
use crate::errors::BullpegError;
use crate::{MAX_BULLS, TOKENS_PER_BULL};

/// Unwrap a bull NFT back into 1,000,000 $TOKEN.
///
/// Caller must hold 1 of the bull's NFT in their ATA. The on-chain check
/// verifies ownership via `payer_nft_account.owner == payer && amount == 1`.
/// This means anyone who holds the NFT (whether they wrapped it themselves
/// or bought it on Magic Eden / Tensor) can unwrap.
///
/// Sequence:
/// 1. Verify caller's NFT ATA holds 1 of nft_mint.
/// 2. Verify vault holds exactly 1M $TOKEN (sanity).
/// 3. Transfer 1M $TOKEN: vault -> caller (signed by vault PDA).
/// 4. Close the vault token account; rent flows to caller.
/// 5. Burn the NFT via Metaplex burn_nft (closes mint, ATA, metadata, edition).
/// 6. Close BullAsset PDA; rent flows to caller.
/// 7. Push tier_index back onto BullBank.free_tiers stack.
#[derive(Accounts)]
#[instruction(tier_index: u16)]
pub struct UnwrapBull<'info> {
    #[account(
        mut,
        seeds = [b"bank"],
        bump = bank.bump,
    )]
    pub bank: Account<'info, BullBank>,

    /// The unwrapping wallet. Must hold the bull NFT in their ATA.
    /// Receives the 1M $TOKEN drained from the vault and the rent from
    /// the closed vault + bull_asset accounts.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Caller's $TOKEN account — receives the unwrapped 1M tokens.
    /// Boxed to keep stack frame under Solana's 4096-byte limit.
    #[account(
        mut,
        constraint = payer_token_account.owner == payer.key(),
        constraint = payer_token_account.mint == bank.token_mint @ BullpegError::WrongMint,
    )]
    pub payer_token_account: Box<Account<'info, TokenAccount>>,

    /// $TOKEN mint (must match bank.token_mint).
    #[account(constraint = token_mint.key() == bank.token_mint @ BullpegError::WrongMint)]
    pub token_mint: Box<Account<'info, Mint>>,

    /// The bull's NFT mint.
    /// Must match the BullAsset record. After burn_nft this account is closed.
    #[account(
        mut,
        constraint = nft_mint.key() == bull_asset.nft_mint @ BullpegError::NftMintMismatch,
    )]
    pub nft_mint: Box<Account<'info, Mint>>,

    /// Vault authority PDA (also the NFT mint authority before master edition
    /// took over). Used to sign the vault drain + close.
    /// CHECK: PDA, no data.
    #[account(
        seeds = [b"vault", nft_mint.key().as_ref()],
        bump,
    )]
    pub nft_mint_authority: UncheckedAccount<'info>,

    /// Vault holding the locked 1M $TOKEN. ATA owned by `nft_mint_authority`.
    /// Drained then closed in this instruction; rent goes to payer.
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = nft_mint_authority,
        constraint = vault.amount == TOKENS_PER_BULL @ BullpegError::VaultBalanceMismatch,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// Caller's NFT ATA — must hold 1 of nft_mint (proves ownership).
    /// Closed by burn_nft.
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = payer,
        constraint = payer_nft_account.amount == 1 @ BullpegError::NotNftHolder,
    )]
    pub payer_nft_account: Box<Account<'info, TokenAccount>>,

    /// BullAsset record. Closed at the end of this ix; rent → payer.
    #[account(
        mut,
        seeds = [b"bull", tier_index.to_le_bytes().as_ref()],
        bump = bull_asset.bump,
        constraint = bull_asset.tier_index == tier_index @ BullpegError::TierMismatch,
        close = payer,
    )]
    pub bull_asset: Box<Account<'info, BullAsset>>,

    /// Metaplex metadata account (closed by burn_nft).
    /// CHECK: address verified by Metaplex during CPI.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// Metaplex master edition (closed by burn_nft).
    /// CHECK: address verified by Metaplex during CPI.
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metadata>,
}

pub fn handler(ctx: Context<UnwrapBull>, tier_index: u16) -> Result<()> {
    require!(
        tier_index >= 1 && tier_index <= MAX_BULLS,
        BullpegError::TierOutOfBounds
    );

    // Prepare vault PDA signer seeds (used for drain + close).
    let nft_mint_key = ctx.accounts.nft_mint.key();
    let auth_bump = ctx.bumps.nft_mint_authority;
    let signer_seeds: &[&[&[u8]]] = &[&[b"vault", nft_mint_key.as_ref(), &[auth_bump]]];

    // === 1. Drain vault: 1M $TOKEN -> payer ===
    {
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.payer_token_account.to_account_info(),
            authority: ctx.accounts.nft_mint_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        token::transfer(cpi_ctx, TOKENS_PER_BULL)?;
    }

    // === 2. Close vault token account; rent -> payer ===
    {
        let cpi_accounts = CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.payer.to_account_info(),
            authority: ctx.accounts.nft_mint_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        token::close_account(cpi_ctx)?;
    }

    // === 3. Burn the NFT (closes mint, ATA, metadata, master edition) ===
    {
        let cpi_accounts = BurnNft {
            metadata: ctx.accounts.metadata.to_account_info(),
            owner: ctx.accounts.payer.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
            token: ctx.accounts.payer_nft_account.to_account_info(),
            edition: ctx.accounts.master_edition.to_account_info(),
            spl_token: ctx.accounts.token_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_metadata_program.key(),
            cpi_accounts,
        );
        // collection_metadata = None (NFT is not part of a collection in v1)
        metadata::burn_nft(cpi_ctx, None)?;
    }

    // === 4. Update bank: push tier back to free_tiers, update counters ===
    let bank = &mut ctx.accounts.bank;
    bank.push_tier(tier_index);
    bank.total_unwrapped = bank.total_unwrapped.saturating_add(1);
    bank.in_circulation = bank.in_circulation.saturating_sub(1);

    // bull_asset is closed automatically by Anchor (close = payer constraint)

    msg!(
        "Unwrapped bull tier={} nft_mint={} payer={}",
        tier_index,
        nft_mint_key,
        ctx.accounts.payer.key()
    );

    Ok(())
}
