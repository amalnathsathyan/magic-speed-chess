use anchor_lang::prelude::*;
use super::enums::*;
use super::piece::*;

#[account]
#[derive(InitSpace)]
pub struct ChessMatch {
    #[max_len(12)]
    pub match_id: String,
    pub white_player: Pubkey,
    pub black_player: Option<Pubkey>,
    pub current_turn: PlayerColor,
    pub white_last_move_time: i64,
    pub black_last_move_time: i64,
    pub move_timeout: i64, // seconds
    pub game_status: GameStatus,
    pub board: [[Option<Piece>; 8]; 8],
    pub total_pot: u64,
    pub platform_fee_bps: u16, // Basis points (e.g., 200 = 2%)
    pub betting_token_mint: Pubkey,
}