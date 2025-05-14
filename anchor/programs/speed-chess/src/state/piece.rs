// src/state/piece.rs
use anchor_lang::prelude::*;
use crate::state::enums::{PieceType, PlayerColor}; // Or use super::enums::*

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub struct Piece {
    pub piece_type: PieceType,
    pub color: PlayerColor,
}
