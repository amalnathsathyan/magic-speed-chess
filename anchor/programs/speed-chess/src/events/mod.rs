// events/mod.rs
use anchor_lang::prelude::*;
use crate::state::*;

#[event]
pub struct MatchCreatedEvent {
    pub match_id: String,
    pub creator: Pubkey,
    pub bet_amount: u64,
}

#[event]
pub struct PlayerJoinedEvent {
    pub match_id: String,
    pub player: Pubkey,
    pub color: PlayerColor,
}

#[event]
pub struct MoveMadeEvent {
    pub match_id: String,
    pub player: Pubkey,
    pub color: PlayerColor,
    pub algebraic_move: String,
    pub from_row: u8,
    pub from_col: u8,
    pub to_row: u8,
    pub to_col: u8,
    pub promotion: Option<PieceType>,
}

#[event]
pub struct GameEndedEvent {
    pub match_id: String,
    pub winner: Option<PlayerColor>,
    pub reason: GameEndReason,
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