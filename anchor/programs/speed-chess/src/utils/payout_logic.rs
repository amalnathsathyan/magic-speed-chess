use anchor_lang::prelude::*;
use crate::errors::ChessError;
use crate::events::*;
use crate::state::*;

// Helper function to process payout to winner
pub fn process_payout(
    chess_match: &Account<ChessMatch>,
) -> Result<()> {
    // Calculate fee amount (2% of pot)
    let total_pot = chess_match.total_pot;
    let fee_amount = (total_pot * chess_match.platform_fee_bps as u64) / 10000;
    let winner_amount = total_pot - fee_amount;
    
    // Determine winner
    let winner_pubkey = match chess_match.game_status {
        GameStatus::WhiteWin => chess_match.white_player,
        GameStatus::BlackWin => match chess_match.black_player {
            Some(black) => black,
            None => return err!(ChessError::NoOpponent),
        },
        _ => return err!(ChessError::NoWinner),
    };
    
    // Transfer winnings to winner
    // Note: In a real implementation, you would use a PDA with the correct
    // seeds to derive the authority for the match account
    
    // This is simplified - actual implementation would need proper CPI calls
    // to transfer the tokens from the match escrow to the winner
    
    emit!(PayoutEvent {
        match_id: chess_match.match_id.clone(),
        winner: winner_pubkey,
        amount: winner_amount,
        fee: fee_amount,
    });
    
    Ok(())
}

// Helper function to process refunds in case of a draw
pub fn process_draw_payout(
    chess_match: &Account<ChessMatch>,
) -> Result<()> {
    // In a draw, both players get their bets back minus half the platform fee each
    let total_pot = chess_match.total_pot;
    let fee_amount = (total_pot * chess_match.platform_fee_bps as u64) / 10000;
    let per_player_amount = (total_pot - fee_amount) / 2;
    
    // Simplified - actual implementation would need proper CPI calls
    
    emit!(DrawPayoutEvent {
        match_id: chess_match.match_id.clone(),
        white_player: chess_match.white_player,
        black_player: chess_match.black_player.unwrap(),
        amount_each: per_player_amount,
        fee: fee_amount,
    });
    
    Ok(())
}