// src/errors.rs
use anchor_lang::prelude::*;

#[error_code]
pub enum ChessError {
    // Errors from your initialize_match.rs constraints
    #[msg("The provided token account is not owned by the player.")]
    InvalidOwner,
    #[msg("The provided token account's mint does not match the betting token mint.")]
    InvalidMint,
    #[msg("The bet amount is invalid.")]
    InvalidBetAmount,
    #[msg("The match is already full.")]
    MatchAlreadyFull,
    #[msg("Match ID length is invalid or exceeds maximum allowed.")]
    InvalidMatchIdLength,
    #[msg("Invalid public key string format during parsing.")]
    InvalidPublicKeyString,
    #[msg("Platform fee basis points exceed maximum (10000).")]
    InvalidPlatformFee,
    #[msg("Unsupported betting token mint. Only SEND or wSOL allowed.")]
    UnsupportedBettingToken,
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
    #[msg("Invalid Match ID provided.")] // A more generic match ID error if needed
    InvalidMatchId,
    #[msg("You are already joined this match.")]
    AlreadyJoined,
    #[msg("Invalid escrow account authority.")]
    InvalidEscrowAccount,
    #[msg("Arithmetic operation overflow/underflow.")]
    MathError,
    // Game state errors for other instructions (ensure these are present for future use)
    #[msg("The game is not currently active.")]
    GameNotActive, // Or MatchNotActive
    // NotAPlayer is used in make_move.rs
    #[msg("The signer is not a registered player in this match.")]
    NotAPlayer,
    #[msg("It is not the signer's turn to move.")]
    NotYourTurn,
    #[msg("Player has timed out.")]
    PlayerTimedOut,
    #[msg("Match is already full or active, cannot join.")]
    MatchAlreadyFullOrActive, // More descriptive than just MatchAlreadyFull
    #[msg("The mint of your token account does not match the established betting token for this match.")]
    InvalidMintForJoin,
    #[msg("Player cannot join their own match as the second player.")]
    CannotJoinOwnMatch,
    #[msg("Joining bet amount does not match the creator's bet amount.")]
    BetAmountMismatch,
    #[msg("Opponent has not joined the match yet, cannot determine winner by resignation.")]
    OpponentNotJoinedYet,
    #[msg("It is not the opponent's turn, so you cannot claim a timeout win yet.")]
    NotOpponentsTurnToClaimTimeout, // More specific than NotOpponentsTurn
    #[msg("Move timeout is not configured for this match.")]
    TimeoutNotConfigured,
    #[msg("Opponent has not actually timed out yet.")]
    OpponentNotTimedOut,
    #[msg("The game has not yet concluded.")]
    GameNotConcluded,
    #[msg("Payout for this match has already been processed.")]
    PayoutAlreadyProcessed,
    #[msg("Player token account mismatch for payout.")]
    PlayerTokenAccountMismatch,
    #[msg("Platform fee token account mismatch or invalid mint for payout.")]
    PlatformTokenAccountError,
    #[msg("Game state is invalid for processing a payout (e.g., winner does not exist).")]
    InvalidGameStateForPayout,
}
