use anchor_lang::prelude::*;

#[error_code]
pub enum ChessError {
    #[msg("The match is already full")]
    MatchAlreadyFull,
    #[msg("You have already joined this match")]
    AlreadyJoined,
    #[msg("It's not your turn")]
    NotYourTurn,
    #[msg("It's not your opponent's turn")]
    NotOpponentsTurn,
    #[msg("You are not a player in this game")]
    NotAPlayer,
    #[msg("Invalid move")]
    InvalidMove,
    #[msg("The game is not active")]
    GameNotActive,
    #[msg("Invalid bet amount")]
    InvalidBetAmount,
    #[msg("No opponent has joined yet")]
    NoOpponent,
    #[msg("No winner has been determined")]
    NoWinner,
    #[msg("Your opponent has not timed out yet")]
    OpponentNotTimedOut,
    #[msg("The token account's owner does not match the player")]
    InvalidOwner,
    #[msg("The token account's mint does not match the provided mint")]
    InvalidMint,
    #[msg("Invalid move: Coordinates out of bounds.")]
    InvalidMoveOutOfBounds,
    #[msg("Invalid move: Source square is empty.")]
    InvalidMoveEmptySource,
    #[msg("Invalid move: Not your piece to move.")]
    InvalidMoveNotYourPiece,
    #[msg("Invalid move: Cannot capture your own piece.")]
    InvalidMoveCannotCaptureOwnPiece,
    #[msg("Invalid move: Illegal movement for this piece type.")]
    InvalidMoveIllegalPieceMovement,
    #[msg("Invalid move: Path is blocked.")]
    InvalidMovePathBlocked,
    #[msg("Invalid move: Move leaves king in check.")]
    InvalidMoveLeavesKingInCheck,
    #[msg("Invalid promotion: Specified piece type is not allowed for promotion.")]
    InvalidPromotionPiece,
    #[msg("Invalid promotion: Pawn is not on the last rank for promotion.")]
    InvalidPromotionNotOnLastRank,
    #[msg("Invalid promotion: Only pawns can be promoted.")]
    InvalidPromotionNotAPawn,
    #[msg("Internal error: King not found on the board.")]
    KingNotFound,
}
