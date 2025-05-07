use anchor_lang::prelude::*;
use crate::errors::ChessError;
use crate::state::*; // Brings in Piece, PieceType, PlayerColor, MoveResult, Enums

// Helper function to initialize a chess board (remains unchanged)
pub fn initialize_chess_board() -> [[Option<Piece>; 8]; 8] {
    let mut board = [[None; 8]; 8];
    // Pawns
    for col in 0..8 {
        board[1][col] = Some(Piece { piece_type: PieceType::Pawn, color: PlayerColor::White });
        board[6][col] = Some(Piece { piece_type: PieceType::Pawn, color: PlayerColor::Black });
    }
    // Other pieces
    let back_row = [
        PieceType::Rook, PieceType::Knight, PieceType::Bishop, PieceType::Queen,
        PieceType::King, PieceType::Bishop, PieceType::Knight, PieceType::Rook,
    ];
    for (col, &piece_type) in back_row.iter().enumerate() {
        board[0][col] = Some(Piece { piece_type, color: PlayerColor::White });
        board[7][col] = Some(Piece { piece_type, color: PlayerColor::Black });
    }
    board
}

// Main function to validate and apply a chess move
pub fn validate_and_apply_move(
    board: &mut [[Option<Piece>; 8]; 8],
    from_row: u8,
    from_col: u8,
    to_row: u8,
    to_col: u8,
    player_color: PlayerColor,
    promotion: Option<PieceType>,
) -> Result<MoveResult> {
    // 1. Basic pre-move validations
    if from_row > 7 || from_col > 7 || to_row > 7 || to_col > 7 {
        return err!(ChessError::InvalidMoveOutOfBounds);
    }
    if from_row == to_row && from_col == to_col { // Cannot move to the same square
        return err!(ChessError::InvalidMoveIllegalPieceMovement);
    }

    let source_piece_data = board[from_row as usize][from_col as usize]
        .as_ref()
        .ok_or(error!(ChessError::InvalidMoveEmptySource))?;

    if source_piece_data.color != player_color {
        return err!(ChessError::InvalidMoveNotYourPiece);
    }

    if let Some(target_piece_data) = board[to_row as usize][to_col as usize].as_ref() {
        if target_piece_data.color == player_color {
            return err!(ChessError::InvalidMoveCannotCaptureOwnPiece);
        }
    }

    // 2. Validate piece-specific movement rules
    if !is_legal_move_for_piece(board, source_piece_data, from_row, from_col, to_row, to_col) {
        return err!(ChessError::InvalidMoveIllegalPieceMovement);
    }

    // 3. Simulate the move and check if it leaves own king in check
    let mut temp_board = *board; // Create a copy of the board to simulate the move
    let piece_to_move_temp = temp_board[from_row as usize][from_col as usize].take().unwrap();
    let _captured_piece_temp = temp_board[to_row as usize][to_col as usize].replace(piece_to_move_temp);

    if is_king_in_check(&temp_board, player_color) {
        return err!(ChessError::InvalidMoveLeavesKingInCheck);
    }

    // 4. Apply the move permanently to the actual board
    let _captured_piece_actual = board[to_row as usize][to_col as usize].take(); // Store captured piece if any
    let mut piece_to_move_actual = board[from_row as usize][from_col as usize].take().unwrap();
    
    // 5. Handle pawn promotion
    if piece_to_move_actual.piece_type == PieceType::Pawn {
        if (player_color == PlayerColor::White && to_row == 7) || 
           (player_color == PlayerColor::Black && to_row == 0) {
            match promotion {
                Some(PieceType::Queen) | Some(PieceType::Rook) | Some(PieceType::Bishop) | Some(PieceType::Knight) => {
                    piece_to_move_actual.piece_type = promotion.unwrap();
                }
                Some(_) => return err!(ChessError::InvalidPromotionPiece), // Invalid piece for promotion (e.g., King, Pawn)
                None => piece_to_move_actual.piece_type = PieceType::Queen, // Default to Queen
            }
        } else if promotion.is_some() {
            return err!(ChessError::InvalidPromotionNotOnLastRank);
        }
    } else if promotion.is_some() {
        return err!(ChessError::InvalidPromotionNotAPawn);
    }
    
    board[to_row as usize][to_col as usize] = Some(piece_to_move_actual);

    // 6. Determine game result (Checkmate, Stalemate, or Normal) - To be implemented fully later
    // For now, we only check if the opponent is in check.
    // Full checkmate/stalemate logic requires generating all opponent's legal moves.
    
    // let opponent_color = if player_color == PlayerColor::White { PlayerColor::Black } else { PlayerColor::White };
    // if is_king_in_check(board, opponent_color) {
    //     if are_no_legal_moves(board, opponent_color) { // This function needs to be complex
    //         return Ok(MoveResult::Checkmate);
    //     }
    //     // Could return a MoveResult::Check here if desired, but it's often implied
    // } else {
    //     if are_no_legal_moves(board, opponent_color) {
    //         return Ok(MoveResult::Stalemate);
    //     }
    // }

    Ok(MoveResult::Normal) // Placeholder until checkmate/stalemate logic is complete
}

// --- Piece-Specific Movement Validation Helpers ---

fn is_legal_move_for_piece(
    board: &[[Option<Piece>; 8]; 8],
    piece_data: &Piece,
    from_r: u8, from_c: u8,
    to_r: u8, to_c: u8,
) -> bool {
    match piece_data.piece_type {
        PieceType::Pawn => is_valid_pawn_move(board, piece_data.color, from_r, from_c, to_r, to_c),
        PieceType::Rook => is_valid_rook_move(board, from_r, from_c, to_r, to_c),
        PieceType::Knight => is_valid_knight_move(from_r, from_c, to_r, to_c),
        PieceType::Bishop => is_valid_bishop_move(board, from_r, from_c, to_r, to_c),
        PieceType::Queen => is_valid_queen_move(board, from_r, from_c, to_r, to_c),
        PieceType::King => is_valid_king_move(from_r, from_c, to_r, to_c), // No castling yet
    }
}

fn is_valid_pawn_move(
    board: &[[Option<Piece>; 8]; 8],
    color: PlayerColor,
    from_r: u8, from_c: u8,
    to_r: u8, to_c: u8,
) -> bool {
    let (fr, fc, tr, tc) = (from_r as i8, from_c as i8, to_r as i8, tc as i8);
    let direction: i8 = if color == PlayerColor::White { 1 } else { -1 };

    // Standard one-step forward
    if tc == fc && tr == fr + direction && board[to_r as usize][to_c as usize].is_none() {
        return true;
    }
    // Initial two-step forward
    if tc == fc && (
        (color == PlayerColor::White && fr == 1 && tr == fr + 2 * direction) ||
        (color == PlayerColor::Black && fr == 6 && tr == fr + 2 * direction)
    ) && board[to_r as usize][to_c as usize].is_none() && 
       board[(fr + direction) as usize][fc as usize].is_none() { // Path clear for two-step
        return true;
    }
    // Capture
    if (tc == fc + 1 || tc == fc - 1) && tr == fr + direction {
        if let Some(target_piece) = &board[to_r as usize][to_c as usize] {
            return target_piece.color != color;
        }
    }
    // En passant and promotion are handled in the main function or will be more detailed later.
    false
}

fn is_valid_rook_move(
    board: &[[Option<Piece>; 8]; 8],
    from_r: u8, from_c: u8,
    to_r: u8, to_c: u8,
) -> bool {
    if from_r == to_r || from_c == to_c { // Horizontal or vertical move
        return is_path_clear_linear(board, from_r, from_c, to_r, to_c);
    }
    false
}

fn is_valid_knight_move(from_r: u8, from_c: u8, to_r: u8, to_c: u8) -> bool {
    let dr = (to_r as i8 - from_r as i8).abs();
    let dc = (to_c as i8 - from_c as i8).abs();
    (dr == 2 && dc == 1) || (dr == 1 && dc == 2)
}

fn is_valid_bishop_move(
    board: &[[Option<Piece>; 8]; 8],
    from_r: u8, from_c: u8,
    to_r: u8, to_c: u8,
) -> bool {
    if (to_r as i8 - from_r as i8).abs() == (to_c as i8 - from_c as i8).abs() { // Diagonal move
        return is_path_clear_diagonal(board, from_r, from_c, to_r, to_c);
    }
    false
}

fn is_valid_queen_move(
    board: &[[Option<Piece>; 8]; 8],
    from_r: u8, from_c: u8,
    to_r: u8, to_c: u8,
) -> bool {
    (from_r == to_r || from_c == to_c || (to_r as i8 - from_r as i8).abs() == (to_c as i8 - from_c as i8).abs()) &&
    (is_path_clear_linear(board, from_r, from_c, to_r, to_c) || is_path_clear_diagonal(board, from_r, from_c, to_r, to_c))
}

fn is_valid_king_move(from_r: u8, from_c: u8, to_r: u8, to_c: u8) -> bool {
    let dr = (to_r as i8 - from_r as i8).abs();
    let dc = (to_c as i8 - from_c as i8).abs();
    dr <= 1 && dc <= 1 && (dr != 0 || dc != 0) // Must move
    // Castling will be added later
}

// --- Path Clearing Helpers ---

fn is_path_clear_linear(
    board: &[[Option<Piece>; 8]; 8],
    from_r: u8, from_c: u8,
    to_r: u8, to_c: u8,
) -> bool {
    if from_r == to_r { // Horizontal
        let start_col = std::cmp::min(from_c, to_c) + 1;
        let end_col = std::cmp::max(from_c, to_c);
        for c in start_col..end_col {
            if board[from_r as usize][c as usize].is_some() { return false; }
        }
    } else if from_c == to_c { // Vertical
        let start_row = std::cmp::min(from_r, to_r) + 1;
        let end_row = std::cmp::max(from_r, to_r);
        for r in start_row..end_row {
            if board[r as usize][from_c as usize].is_some() { return false; }
        }
    } else { // Not purely linear
        return false; // Should only be called for rook-like or queen-like linear parts of moves
    }
    true
}

fn is_path_clear_diagonal(
    board: &[[Option<Piece>; 8]; 8],
    from_r: u8, from_c: u8,
    to_r: u8, to_c: u8,
) -> bool {
    let dr = (to_r as i8 - from_r as i8).signum();
    let dc = (to_c as i8 - from_c as i8).signum();

    if dr.abs() != dc.abs() || dr == 0 { // Not diagonal or not moving
        return false;
    }

    let mut r = from_r as i8 + dr;
    let mut c = from_c as i8 + dc;

    while r != to_r as i8 || c != to_c as i8 { // Iterate up to (but not including) the target square
        if r < 0 || r > 7 || c < 0 || c > 7 { return false; } // Should not happen if to_r/to_c are valid
        if board[r as usize][c as usize].is_some() { return false; }
        r += dr;
        c += dc;
    }
    true
}


// --- Check Detection Helpers ---

fn find_king(board: &[[Option<Piece>; 8]; 8], king_color: PlayerColor) -> Result<(u8, u8)> {
    for r in 0..8 {
        for c in 0..8 {
            if let Some(piece) = &board[r][c] {
                if piece.piece_type == PieceType::King && piece.color == king_color {
                    return Ok((r as u8, c as u8));
                }
            }
        }
    }
    err!(ChessError::KingNotFound) // Should ideally not happen in a valid game
}

fn is_square_attacked(
    board: &[[Option<Piece>; 8]; 8],
    target_r: u8, target_c: u8,
    attacker_color: PlayerColor,
) -> bool {
    for r in 0..8 {
        for c in 0..8 {
            if let Some(piece_data) = &board[r][c] {
                if piece_data.color == attacker_color {
                    // Check if this piece can move to target_r, target_c
                    // Note: For captures, pawn movement is different.
                    // is_legal_move_for_piece checks path clearing, which is usually not needed for *attack* checks
                    // but for simplicity here, we reuse it. A more optimized version would have separate
                    // attack pattern checks (e.g., a pawn attacks diagonally even if it can't move there).
                    // For now, this simplified check is okay but can be refined.
                    if piece_data.piece_type == PieceType::Pawn {
                         let (fr, fc, tr, tc) = (r as i8, c as i8, target_r as i8, target_c as i8);
                         let direction: i8 = if attacker_color == PlayerColor::White { 1 } else { -1 };
                         if (tc == fc + 1 || tc == fc - 1) && tr == fr + direction {
                             return true; // Pawn attacks diagonally
                         }
                    } else if is_legal_move_for_piece(board, piece_data, r as u8, c as u8, target_r, target_c) {
                        return true;
                    }
                }
            }
        }
    }
    false
}

pub fn is_king_in_check(board: &[[Option<Piece>; 8]; 8], king_color: PlayerColor) -> bool {
    match find_king(board, king_color) {
        Ok((king_r, king_c)) => {
            let attacker_color = if king_color == PlayerColor::White { PlayerColor::Black } else { PlayerColor::White };
            is_square_attacked(board, king_r, king_c, attacker_color)
        }
        Err(_) => false, // If king not found, can't be in check (though this state is erroneous)
    }
}

// Placeholder for checking if a player has any legal moves
// This is complex and needed for checkmate/stalemate
// pub fn are_no_legal_moves(board: &[[Option<Piece>; 8]; 8], player_color: PlayerColor) -> bool {
// For every piece of player_color, try to generate all its possible moves.
// If any move is valid (doesn't leave own king in check), return false.
// If no piece has any valid move, return true.
//     true // Placeholder
// }
   