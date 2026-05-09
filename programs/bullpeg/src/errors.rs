use anchor_lang::prelude::*;

#[error_code]
pub enum BullpegError {
    #[msg("Token account is not for the configured $TOKEN mint")]
    WrongMint,

    #[msg("Caller's balance is below the 1,000,000 token wrap threshold")]
    InsufficientBalance,

    #[msg("Caller does not hold the bull NFT being unwrapped")]
    NotNftHolder,

    #[msg("Vault account does not match the expected PDA for this NFT mint")]
    VaultMismatch,

    #[msg("Maximum bulls already wrapped (1,000 cap reached)")]
    MaxBullsReached,

    #[msg("Bull asset PDA does not match expected tier index")]
    TierMismatch,

    #[msg("Tier index out of bounds (must be 1..=1000)")]
    TierOutOfBounds,

    #[msg("Provided NFT mint does not match the BullAsset record")]
    NftMintMismatch,

    #[msg("Vault balance is not exactly 1,000,000 tokens")]
    VaultBalanceMismatch,
}
