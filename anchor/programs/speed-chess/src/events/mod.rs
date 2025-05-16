// events/mod.rs
use anchor_lang::prelude::*;
use crate::state::*;

#[event]
pub struct MoveMadeEvent {
    pub match_id: String, // Changed to String
    pub player: Pubkey,
    pub player_color: PlayerColor,
    pub algebraic_move: String,
    pub from_row: u8,
    pub from_col: u8,
    pub to_row: u8,
    pub to_col: u8,
    pub promotion_piece: Option<PieceType>,
    pub board_fen: String,
    pub is_check: bool,
    pub is_checkmate: bool,
    pub is_stalemate: bool,
}

#[event]
pub struct GameEndedEvent {
    pub match_id: String, // Changed to String
    pub status: GameStatus,
    pub winner: Option<PlayerColor>,
    pub reason: GameEndReason,
}

#[event]
pub struct PlayerJoinedEvent { // For join_match instruction
    pub match_id: String,    // Changed to String
    pub player_one: Pubkey,
    pub player_two: Pubkey,
    pub betting_token_mint: Pubkey,
    pub bet_amount_per_player: u64,
}


#[event]
pub struct PayoutEvent {
    pub match_id: String,
    pub winner: Pubkey,
    pub amount: u64,
    pub fee: u64,
}

#[event]
pub struct DrawPayoutEvent {
    pub match_id: String,
    pub white_player: Pubkey,
    pub black_player: Pubkey,
    pub amount_each: u64,
    pub fee: u64,
}


#[event]
pub struct MatchCreatedEvent {
    pub match_id: String, // Changed to String to match ChessMatch state
    pub creator: Pubkey,
    pub betting_token_mint: Pubkey, // Added this field
    pub bet_amount: u64,
    pub move_timeout_duration: i64, // Added this field
    pub platform_fee_basis_points: u16, // Added this field
}

