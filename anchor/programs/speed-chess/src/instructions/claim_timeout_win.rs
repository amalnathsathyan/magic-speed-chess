use anchor_lang::prelude::*;

use crate::errors::ChessError;
use crate::events::*;
use crate::state::*;
use crate::utils::*;
use crate::instructions::make_move::MakeMove;

#[derive(Accounts)]
pub struct ClaimTimeoutWin<'info> {
    #[account(mut)]
    pub chess_match: Account<'info, ChessMatch>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    // Additional accounts for payout - would match the MakeMove accounts
}

pub fn handler(ctx: Context<ClaimTimeoutWin>) -> Result<()> {
    let chess_match = &mut ctx.accounts.chess_match;
    let player = &ctx.accounts.player;
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    
    // Ensure game is active
    require!(
        chess_match.game_status == GameStatus::Active,
        ChessError::GameNotActive
    );
    
    // Determine player color and opponent
    let (player_color, opponent_color, opponent_last_move_time) = 
        if chess_match.white_player == player.key() {
            (PlayerColor::White, PlayerColor::Black, chess_match.black_last_move_time)
        } else if chess_match.black_player == Some(player.key()) {
            (PlayerColor::Black, PlayerColor::White, chess_match.white_last_move_time)
        } else {
            return err!(ChessError::NotAPlayer);
        };
    
    // Ensure it's opponent's turn (player can only claim timeout when it's not their turn)
    require!(
        chess_match.current_turn == opponent_color,
        ChessError::NotOpponentsTurn
    );
    
    // Check if opponent has timed out
    require!(
        now - opponent_last_move_time > chess_match.move_timeout,
        ChessError::OpponentNotTimedOut
    );
    Ok(())
}