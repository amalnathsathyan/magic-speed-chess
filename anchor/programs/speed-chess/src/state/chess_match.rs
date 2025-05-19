// src/state/chess_match.rs
use crate::state::*;
use anchor_lang::prelude::*;

pub const MAX_PLAYERS: usize = 2;
pub const MAX_MATCH_ID_LEN: usize = 32; // Define a max length for the string match_id.

#[account]
#[derive(InitSpace, Debug)]
pub struct ChessMatch {
    #[max_len(MAX_MATCH_ID_LEN)] // REQUIRED for String with InitSpace
    pub match_id: String, 
    pub players: [Pubkey; MAX_PLAYERS], // players[0] is White, players[1] is Black (by convention)
    pub current_player_idx: u8,
    pub current_turn: PlayerColor,

    pub last_move_timestamp: i64, // Timestamp of the last successful move or game start
    pub move_timeout_duration: i64, // Duration in seconds for a single move timeout

    pub game_status: GameStatus,
    pub game_end_reason: Option<GameEndReason>,

    pub board: [[Option<Piece>; 8]; 8], //
    pub castling_rights: CastlingRights,
    pub en_passant_target: Option<EnPassantSquare>, // **** CORRECTED TYPE ****
    pub halfmove_clock: u8,
    pub fullmove_number: u16,

    pub betting_token_mint: Pubkey,
    pub bet_amount_player_one: u64,
    pub bet_amount_player_two: u64, // Will be 0 initially
    pub total_pot: u64,
    pub platform_fee_basis_points: u16, // Renamed from platform_fee_bps for consistency
    pub payout_processed: bool,         // <-- NEW FLAG

    pub bump: u8,
    // Removed player_one_time_remaining, player_two_time_remaining to simplify, using per-move timeout
}
