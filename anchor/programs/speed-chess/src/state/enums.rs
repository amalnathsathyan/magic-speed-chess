// src/state/enums.rs
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum PieceType {
    Pawn,
    Knight,
    Bishop,
    Rook,
    Queen,
    King,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum PlayerColor {
    White,
    Black,
}

impl PlayerColor {
    pub fn opponent(&self) -> Self {
        match self {
            PlayerColor::White => PlayerColor::Black,
            PlayerColor::Black => PlayerColor::White,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum GameStatus {
    WaitingForOpponent,
    Active,
    WhiteWins,
    BlackWins,
    Draw,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum GameEndReason {
    Checkmate,
    Stalemate,
    Resignation,
    Timeout,
    FiftyMoveRule,
    // ThreefoldRepetition, // Potentially later
    // InsufficientMaterial, // Potentially later
}

// Result of a single move, used internally by chess_logic
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MoveResult {
    Normal,
    Checkmate,      // Opponent is checkmated by this move
    Stalemate,      // Game is a stalemate after this move (includes 50-move rule for now)
    // Check,        // If you want to explicitly signal a check without ending the game
}
