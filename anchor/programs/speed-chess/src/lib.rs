// lib.rs
use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;
pub mod events;
pub mod utils;

use instructions::*;

use crate::instructions::initialize_match::InitializeMatch;
use crate::instructions::resign_game::ResignGame;

declare_id!("9z5kWJ5KSPfZXmCzv6cJyFXc6Y7tmsH5hj7SUy8aZji9");

#[program]
pub mod speed_chess {
    use super::*;

    // Initialize a new chess match with betting enabled
    pub fn initialize_match(
        ctx: Context<InitializeMatch>,
        match_id: String,
        bet_amount: u64,
    ) -> Result<()> {
        instructions::initialize_match::handler(ctx, match_id, bet_amount)
    }

    // Allow a player to join an existing match
    pub fn join_match(ctx: Context<JoinMatch>, bet_amount: u64) -> Result<()> {
        instructions::join_match::handler(ctx, bet_amount)
    }

    // Make a chess move
    pub fn make_move(
        ctx: Context<MakeMove>,
        from_row: u8,
        from_col: u8,
        to_row: u8,
        to_col: u8,
        promotion: Option<state::PieceType>,
    ) -> Result<()> {
        instructions::make_move::handler(ctx, from_row, from_col, to_row, to_col, promotion)
    }

    // Resign from the game, opponent wins
    pub fn resign_game(ctx: Context<ResignGame>) -> Result<()> {
        instructions::resign_game::handler(ctx)
    }

    // Claim win due to opponent timeout
    pub fn claim_timeout_win(ctx: Context<ClaimTimeoutWin>) -> Result<()> {
        instructions::claim_timeout_win::handler(ctx)
    }
}