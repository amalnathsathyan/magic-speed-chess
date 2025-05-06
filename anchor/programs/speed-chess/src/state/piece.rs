use anchor_lang::prelude::*;
use crate::state::enums::{PieceType, PlayerColor}; // Adjust path as needed

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
#[derive(InitSpace)]
pub struct Piece {
    pub piece_type: PieceType,
    pub color: PlayerColor,
}