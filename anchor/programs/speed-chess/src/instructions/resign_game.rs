use anchor_lang::prelude::*;

use crate::errors::ChessError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct ResignGame<'info> {
    #[account(mut,
        seeds = [b"chess_match", chess_match.match_id.as_bytes()],
        bump,
    )]
    pub chess_match: Account<'info, ChessMatch>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
}

pub fn handler(ctx: Context<ResignGame>) -> Result<()> {
    let chess_match = &mut ctx.accounts.chess_match;
    let player = &ctx.accounts.player;
    
    // Ensure game is active
    require!(
        chess_match.game_status == GameStatus::Active || 
        chess_match.game_status == GameStatus::WaitingForOpponent,
        ChessError::GameNotActive
    );
    
    // Determine player color
    let player_color = if chess_match.white_player == player.key() {
        PlayerColor::White
    } else if chess_match.black_player == Some(player.key()) {
        PlayerColor::Black
    } else {
        return err!(ChessError::NotAPlayer);
    };
    
    // Update game status - opponent wins
    chess_match.game_status = match player_color {
        PlayerColor::White => GameStatus::BlackWin,
        PlayerColor::Black => GameStatus::WhiteWin,
    };
    
    emit!(GameEndedEvent {
        match_id: chess_match.match_id.clone(),
        winner: Some(match player_color {
            PlayerColor::White => PlayerColor::Black,
            PlayerColor::Black => PlayerColor::White,
        }),
        reason: GameEndReason::Resignation,
    });
    
    // Process payout to winner
    // Note: In a real implementation, you'd call process_payout here
    // with the proper context
    
    Ok(())
}