// src/instructions/resign_game.rs
use anchor_lang::prelude::*;

use crate::errors::ChessError;
use crate::events::*; // Ensure GameEndedEvent is defined here
use crate::state::*;  // Ensure ChessMatch, GameStatus, PlayerColor, GameEndReason are here

#[derive(Accounts)]
pub struct ResignGame<'info> {
    #[account(
        mut,
        seeds = [b"chess_match", chess_match.match_id.as_bytes()], // Assumes chess_match.match_id is String
        bump = chess_match.bump, // Use the stored bump for the PDA
    )]
    pub chess_match: Account<'info, ChessMatch>,

    #[account(mut)] // Signer is mutable due to transaction fees
    pub player_signer: Signer<'info>, // Renamed from 'player' for clarity
}

pub fn handler(ctx: Context<ResignGame>) -> Result<()> {
    let chess_match = &mut ctx.accounts.chess_match;
    let player_key = ctx.accounts.player_signer.key();
    let clock = Clock::get()?;

    // 1. Ensure game is active to allow resignation.
    // Resigning from "WaitingForOpponent" could be an "abort_match" instruction with different logic (e.g., refund P1).
    require!(
        chess_match.game_status == GameStatus::Active,
        ChessError::GameNotActive // Or a more specific "CannotResignNonActiveGame"
    );

    // 2. Determine which player (White or Black) is resigning and identify the winner.
    let resigning_player_color: PlayerColor;
    let winner_color: PlayerColor;

    if player_key == chess_match.players[0] { // Player 1 (White by convention) resigns
        require!(chess_match.players[0] != Pubkey::default(), ChessError::NotAPlayer); // Ensure P1 is set
        resigning_player_color = PlayerColor::White;
        winner_color = PlayerColor::Black;
        // Ensure player 2 has joined, otherwise it's an abort, not a win for P2.
        require!(chess_match.players[1] != Pubkey::default(), ChessError::OpponentNotJoinedYet); // New Error
    } else if player_key == chess_match.players[1] { // Player 2 (Black by convention) resigns
        require!(chess_match.players[1] != Pubkey::default(), ChessError::NotAPlayer); // Ensure P2 is set
        resigning_player_color = PlayerColor::Black;
        winner_color = PlayerColor::White;
    } else {
        // Signer is not one of the registered players in this match.
        return err!(ChessError::NotAPlayer);
    }

    // 3. Update game status - opponent wins due to resignation.
    chess_match.game_status = match winner_color {
        PlayerColor::White => GameStatus::WhiteWins,
        PlayerColor::Black => GameStatus::BlackWins,
    };
    chess_match.game_end_reason = Some(GameEndReason::Resignation);
    chess_match.last_move_timestamp = clock.unix_timestamp; // Record time of game end

    msg!("Player {:?} ({:?}) resigned. Player {:?} wins.", 
        player_key, 
        resigning_player_color, 
        winner_color
    );

    // 4. Emit GameEndedEvent.
    emit!(GameEndedEvent {
        match_id: chess_match.match_id.clone(), // Assuming match_id in ChessMatch is String
        status: chess_match.game_status,
        winner: Some(winner_color),
        reason: GameEndReason::Resignation,
    });

    // Note: Payout logic is NOT handled here. It will be in a separate "process_match_settlement" instruction.

    Ok(())
}
