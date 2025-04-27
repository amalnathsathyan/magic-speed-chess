use anchor_lang::prelude::*;
use crate::errors::ChessError;
use crate::state::*;

// Helper function to initialize a chess board
pub fn initialize_chess_board() -> [[Option<Piece>; 8]; 8] {
    let mut board = [[None; 8]; 8];
    
    // Set up pawns
    for col in 0..8 {
        board[1][col] = Some(Piece {
            piece_type: PieceType::Pawn,
            color: PlayerColor::White,
        });
        board[6][col] = Some(Piece {
            piece_type: PieceType::Pawn,
            color: PlayerColor::Black,
        });
    }
    
    // Set up other pieces
    let back_row = [
        PieceType::Rook,
        PieceType::Knight,
        PieceType::Bishop,
        PieceType::Queen,
        PieceType::King,
        PieceType::Bishop,
        PieceType::Knight,
        PieceType::Rook,
    ];
    
    for (col, &piece_type) in back_row.iter().enumerate() {
        board[0][col] = Some(Piece {
            piece_type,
            color: PlayerColor::White,
        });
        board[7][col] = Some(Piece {
            piece_type,
            color: PlayerColor::Black,
        });
    }
    
    board
}

// Validate and apply a chess move
pub fn validate_and_apply_move(
    board: &mut [[Option<Piece>; 8]; 8],
    from_row: u8,
    from_col: u8,
    to_row: u8,
    to_col: u8,
    player_color: PlayerColor,
    promotion: Option<PieceType>,
) -> Result<MoveResult> {
    // Check if source square has a piece of the player's color
    let source_piece = board[from_row as usize][from_col as usize]
        .as_ref()
        .ok_or(error!(ChessError::InvalidMove))?;
    
    if source_piece.color != player_color {
        return err!(ChessError::InvalidMove);
    }
    
    // Full chess rules implementation would go here
    // This is a simplified version for illustration
    
    // Move the piece
    let piece = board[from_row as usize][from_col as usize].take();
    board[to_row as usize][to_col as usize] = piece;
    
    // Handle pawn promotion
    if let Some(piece) = &mut board[to_row as usize][to_col as usize] {
        if piece.piece_type == PieceType::Pawn {
            if (player_color == PlayerColor::White && to_row == 7) || 
               (player_color == PlayerColor::Black && to_row == 0) {
                // Promote the pawn
                piece.piece_type = promotion.unwrap_or(PieceType::Queen);
            }
        }
    }
    
    // Check for checkmate/stalemate - simplified version
    // In a real implementation, you would check for these conditions
    
    Ok(MoveResult::Normal)
}