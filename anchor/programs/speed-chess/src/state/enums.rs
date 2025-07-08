use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
#[derive(InitSpace)]
pub enum PieceType {
    Pawn,
    Knight,
    Bishop,
    Rook,
    Queen,
    King,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
#[derive(InitSpace)]
pub enum PlayerColor {
    White,
    Black,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
#[derive(InitSpace)]
pub enum GameStatus {
    WaitingForOpponent,
    Active,
    WhiteWin,
    BlackWin,
    Draw,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
#[derive(InitSpace)]
pub enum GameEndReason {
    Checkmate,
    Stalemate,
    Resignation,
    Timeout,
    Agreement,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
#[derive(InitSpace)]
pub enum MoveResult {
    Normal,
    Checkmate,
    Stalemate,
}

