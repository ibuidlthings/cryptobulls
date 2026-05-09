use anchor_lang::prelude::*;
use crate::state::BullBank;
use crate::MAX_BULLS;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = BullBank::SIZE,
        seeds = [b"bank"],
        bump
    )]
    pub bank: Account<'info, BullBank>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, token_mint: Pubkey) -> Result<()> {
    let bank = &mut ctx.accounts.bank;

    bank.token_mint = token_mint;
    bank.total_wrapped = 0;
    bank.total_unwrapped = 0;
    bank.in_circulation = 0;
    bank.next_tier = 1;
    bank.free_tiers = Vec::new();
    bank.authority = ctx.accounts.authority.key();
    bank.bump = ctx.bumps.bank;
    // collection_mint stays Pubkey::default() until initialize_collection
    // is called. wrap_bull rejects any wrap before that with
    // CollectionNotInitialized.
    bank.collection_mint = Pubkey::default();
    bank.reserved = [0u8; 32];

    msg!(
        "Bullpeg initialized: mint={}, max_bulls={}",
        token_mint,
        MAX_BULLS
    );
    Ok(())
}
