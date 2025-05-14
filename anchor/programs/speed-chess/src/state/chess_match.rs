// src/state/chess_match.rs
use anchor_lang::prelude::*;
use crate::state::enums::{GameStatus, PlayerColor, GameEndReason};
use crate::state::piece::Piece;
use crate::state::castling_rights::CastlingRights;
use crate::state::en_passant_square::EnPassantSquare; // Import the new struct

pub const MAX_PLAYERS: usize = 2;

#[account]
#[derive(InitSpace, Debug)] // Keep Debug for now
pub struct ChessMatch {
    pub match_id: u64,
    pub players: [Pubkey; MAX_PLAYERS], // 32 * 2 = 64 bytes
    pub current_player_idx: u8, // 1 byte
    pub current_turn: PlayerColor, // Derives InitSpace (enum with few variants, likely 1 byte + padding)
    
    pub player_one_time_remaining: u64, // 8 bytes
    pub player_two_time_remaining: u64, // 8 bytes
    pub last_move_timestamp: i64, // 8 bytes

    pub game_status: GameStatus, // Derives InitSpace (enum, likely 1 byte + padding)
    pub game_end_reason: Option<GameEndReason>, // GameEndReason derives InitSpace. Option adds 1 byte.

    pub board: [[Option<Piece>; 8]; 8], // Piece derives InitSpace. Option<Piece> = 1 (disc) + size_of_Piece. Total = 64 * (1 + size_of_Piece)
    pub castling_rights: CastlingRights,   // CastlingRights derives InitSpace (4 bools = 4 bytes + padding)
    pub en_passant_target: Option<EnPassantSquare>, // EnPassantSquare derives InitSpace (u8+u8 = 2 bytes). Option adds 1 byte. So 1 + 2 = 3 bytes.
    pub halfmove_clock: u8, // 1 byte
    pub fullmove_number: u16, // 2 bytes

    pub betting_token_mint: Pubkey, // 32 bytes
    pub bet_amount_player_one: u64, // 8 bytes
    pub bet_amount_player_two: u64, // 8 bytes
    pub total_pot: u64, // 8 bytes
    pub platform_fee_basis_points: u16, // 2 bytes

    pub bump: u8, // 1 byte
}

