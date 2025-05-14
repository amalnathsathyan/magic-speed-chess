// src/chess_logic.rs
use anchor_lang::prelude::*;
use crate::errors::ChessError;
use crate::state::*; // This now brings in EnPassantSquare, CastlingRights, Piece, Enums etc.

// Helper function to initialize a chess board
pub fn initialize_chess_board() -> [[Option<Piece>; 8]; 8] {
    let mut board = [[None; 8]; 8];
    
    // Set up pawns
    for col in 0..8 {
        board[1][col] = Some(Piece { // White pawns on row 1 (0-indexed)
            piece_type: PieceType::Pawn,
            color: PlayerColor::White,
        });
        board[6][col] = Some(Piece { // Black pawns on row 6 (0-indexed)
            piece_type: PieceType::Pawn,
            color: PlayerColor::Black,
        });
    }
    
    // Set up other pieces
    let back_row_piece_types = [
        PieceType::Rook, PieceType::Knight, PieceType::Bishop, PieceType::Queen,
        PieceType::King, PieceType::Bishop, PieceType::Knight, PieceType::Rook,
    ];
    
    for (col, &piece_type) in back_row_piece_types.iter().enumerate() {
        board[0][col] = Some(Piece { // White back rank on row 0
            piece_type,
            color: PlayerColor::White,
        });
        board[7][col] = Some(Piece { // Black back rank on row 7
            piece_type,
            color: PlayerColor::Black,
        });
    }
    board
}

// --- Main function to validate and apply a chess move ---
pub fn validate_and_apply_move(
    board: &mut [[Option<Piece>; 8]; 8],
    from_row: u8,
    from_col: u8,
    to_row: u8,
    to_col: u8,
    player_color: PlayerColor,
    promotion: Option<PieceType>,
    castling_rights: &mut CastlingRights,
    en_passant_target: &mut Option<EnPassantSquare>,
    halfmove_clock: &mut u8,
    fullmove_number: &mut u16, // Added fullmove_number
) -> Result<MoveResult> {
    // 1. Basic pre-move validations
    if from_row > 7 || from_col > 7 || to_row > 7 || to_col > 7 {
        return err!(ChessError::InvalidMoveOutOfBounds);
    }
    if from_row == to_row && from_col == to_col {
        return err!(ChessError::InvalidMoveIllegalPieceMovement);
    }

    let source_piece_data = board[from_row as usize][from_col as usize]
        .as_ref()
        .ok_or(error!(ChessError::InvalidMoveEmptySource))?;

    if source_piece_data.color != player_color {
        return err!(ChessError::InvalidMoveNotYourPiece);
    }

    let mut is_capture = false;
    if let Some(target_piece_data) = board[to_row as usize][to_col as usize].as_ref() {
        if target_piece_data.color == player_color {
            return err!(ChessError::InvalidMoveCannotCaptureOwnPiece);
        }
        is_capture = true;
    }

    // 2. Validate piece-specific movement rules
    if !is_legal_move_for_piece(board, source_piece_data, from_row, from_col, to_row, to_col, *en_passant_target, castling_rights, player_color) {
        return err!(ChessError::InvalidMoveIllegalPieceMovement);
    }

    let piece_type_moved = source_piece_data.piece_type;

    // --- Simulate the move and check if it leaves own king in check ---
    let mut temp_board = *board;
    let mut piece_to_move_temp = temp_board[from_row as usize][from_col as usize].take().unwrap();
    
    if piece_to_move_temp.piece_type == PieceType::Pawn {
        if let Some(ep_square) = *en_passant_target {
            if ep_square.row == to_row && ep_square.col == to_col &&
               (to_col as i8 - from_col as i8).abs() == 1 &&
               (to_row as i8 - from_row as i8).abs() == 1
            {
                let captured_pawn_row = if player_color == PlayerColor::White { to_row - 1 } else { to_row + 1 };
                temp_board[captured_pawn_row as usize][to_col as usize].take();
            }
        }
    }
    if piece_to_move_temp.piece_type == PieceType::King && (to_col as i8 - from_col as i8).abs() == 2 {
        let (rook_from_col, rook_to_col) = if (to_col as i8 - from_col as i8) > 0 { (7, 5) } else { (0, 3) };
        if let Some(rook) = temp_board[from_row as usize][rook_from_col as usize].take() {
            temp_board[from_row as usize][rook_to_col as usize] = Some(rook);
        }
    }
    let _captured_piece_temp = temp_board[to_row as usize][to_col as usize].replace(piece_to_move_temp);

    if is_king_in_check(&temp_board, player_color) {
        return err!(ChessError::InvalidMoveLeavesKingInCheck);
    }

    // --- Apply the move permanently to the actual board ---
    let previous_en_passant_target = en_passant_target.take(); 

    let mut actual_captured_piece = board[to_row as usize][to_col as usize].take();

    if piece_type_moved == PieceType::Pawn {
        if let Some(ep_square) = previous_en_passant_target {
            if ep_square.row == to_row && ep_square.col == to_col &&
               (to_col as i8 - from_col as i8).abs() == 1 &&
               (to_row as i8 - from_row as i8).abs() == 1
            {
                let captured_pawn_row = if player_color == PlayerColor::White { to_row - 1 } else { to_row + 1 };
                actual_captured_piece = board[captured_pawn_row as usize][to_col as usize].take();
                is_capture = true; 
            }
        }
    }

    let mut piece_to_move_actual = board[from_row as usize][from_col as usize].take().unwrap();

    update_castling_rights(castling_rights, &piece_to_move_actual, from_row, from_col);

    if piece_to_move_actual.piece_type == PieceType::King {
        let col_diff = to_col as i8 - from_col as i8;
        if col_diff.abs() == 2 { 
            let (rook_from_col, rook_to_col) = if col_diff > 0 { (7, 5) } else { (0, 3) };
            if let Some(rook_piece) = board[from_row as usize][rook_from_col as usize].take() {
                board[from_row as usize][rook_to_col as usize] = Some(rook_piece);
            } else {
                return err!(ChessError::InvalidMoveIllegalPieceMovement); 
            }
        }
    }
    
    if piece_to_move_actual.piece_type == PieceType::Pawn {
        if (player_color == PlayerColor::White && to_row == 7) || 
           (player_color == PlayerColor::Black && to_row == 0) {
            match promotion {
                Some(PieceType::Queen) | Some(PieceType::Rook) | Some(PieceType::Bishop) | Some(PieceType::Knight) => {
                    piece_to_move_actual.piece_type = promotion.unwrap();
                }
                Some(_) => return err!(ChessError::InvalidPromotionPiece),
                None => piece_to_move_actual.piece_type = PieceType::Queen,
            }
        } else if promotion.is_some() { return err!(ChessError::InvalidPromotionNotOnLastRank); }
    } else if promotion.is_some() { return err!(ChessError::InvalidPromotionNotAPawn); }

    board[to_row as usize][to_col as usize] = Some(piece_to_move_actual);

    if piece_type_moved == PieceType::Pawn && (to_row as i8 - from_row as i8).abs() == 2 {
        let ep_row = (from_row as i8 + to_row as i8) / 2;
        *en_passant_target = Some(EnPassantSquare { row: ep_row as u8, col: from_col });
    }

    if piece_type_moved == PieceType::Pawn || is_capture || actual_captured_piece.is_some() {
        *halfmove_clock = 0;
    } else {
        *halfmove_clock += 1;
    }

    // Update fullmove number if Black moved
    if player_color == PlayerColor::Black {
        *fullmove_number += 1;
    }

    // --- Determine game result ---
    let opponent_color = player_color.opponent();
    if are_no_legal_moves(board, opponent_color, castling_rights, *en_passant_target) {
        if is_king_in_check(board, opponent_color) {
            return Ok(MoveResult::Checkmate);
        } else {
            return Ok(MoveResult::Stalemate);
        }
    }

    if *halfmove_clock >= 100 {
        return Ok(MoveResult::Stalemate); 
    }

    Ok(MoveResult::Normal)
}

// --- Function to check if a player has ANY legal moves ---
fn are_no_legal_moves(
    board: &[[Option<Piece>; 8]; 8],
    player_color: PlayerColor,
    castling_rights: &CastlingRights,
    en_passant_target: Option<EnPassantSquare>,
) -> bool {
    for r_from_idx in 0..8 {
        for c_from_idx in 0..8 {
            if let Some(piece) = &board[r_from_idx][c_from_idx] {
                if piece.color == player_color {
                    for r_to_idx in 0..8 {
                        for c_to_idx in 0..8 {
                            let (from_r, from_c, to_r, to_c) = (r_from_idx as u8, c_from_idx as u8, r_to_idx as u8, c_to_idx as u8);
                            if from_r == to_r && from_c == to_c { continue; }

                            if is_legal_move_for_piece(board, piece, from_r, from_c, to_r, to_c, en_passant_target, castling_rights, player_color) {
                                let mut temp_board = *board;
                                let mut temp_piece_to_move = temp_board[r_from_idx][c_from_idx].take().unwrap();
                                
                                if temp_piece_to_move.piece_type == PieceType::Pawn {
                                    if let Some(ep_square) = en_passant_target {
                                        if ep_square.row == to_r && ep_square.col == to_c &&
                                           (c_to_idx as i8 - c_from_idx as i8).abs() == 1 &&
                                           (r_to_idx as i8 - r_from_idx as i8).abs() == 1
                                        {
                                            let captured_pawn_row = if player_color == PlayerColor::White { to_r - 1 } else { to_r + 1 };
                                            temp_board[captured_pawn_row as usize][c_to_idx].take();
                                        }
                                    }
                                }
                                if temp_piece_to_move.piece_type == PieceType::King && (c_to_idx as i8 - c_from_idx as i8).abs() == 2 {
                                    let (rook_from_col, rook_to_col) = if (c_to_idx as i8 - c_from_idx as i8) > 0 { (7, 5) } else { (0, 3) };
                                    if let Some(rook) = temp_board[r_from_idx][rook_from_col as usize].take() {
                                        temp_board[r_from_idx][rook_to_col as usize] = Some(rook);
                                    }
                                }
                                temp_board[r_to_idx][c_to_idx] = Some(temp_piece_to_move);

                                if !is_king_in_check(&temp_board, player_color) {
                                    return false; // Found a legal move
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    true // No legal moves found
}

// --- Piece-Specific Movement Validation ---
fn is_legal_move_for_piece(
    board: &[[Option<Piece>; 8]; 8],
    piece_data: &Piece,
    from_r: u8, from_c: u8,
    to_r: u8, to_c: u8,
    en_passant_target: Option<EnPassantSquare>,
    castling_rights: &CastlingRights,
    current_player_color: PlayerColor,
) -> bool {
    if let Some(target_piece) = board[to_r as usize][to_c as usize] {
        if target_piece.color == piece_data.color {
            return false; 
        }
    }

    match piece_data.piece_type {
        PieceType::Pawn => is_valid_pawn_move(board, piece_data.color, from_r, from_c, to_r, to_c, en_passant_target),
        PieceType::Rook => is_valid_rook_move(board, from_r, from_c, to_r, to_c),
        PieceType::Knight => is_valid_knight_move(from_r, from_c, to_r, to_c),
        PieceType::Bishop => is_valid_bishop_move(board, from_r, from_c, to_r, to_c),
        PieceType::Queen => is_valid_queen_move(board, from_r, from_c, to_r, to_c),
        PieceType::King => {
            is_valid_king_move_basic(from_r, from_c, to_r, to_c) || 
            is_valid_castling_move(board, from_r, from_c, to_r, to_c, castling_rights, current_player_color)
        },
    }
}

fn is_valid_pawn_move(
    board: &[[Option<Piece>; 8]; 8],
    color: PlayerColor,
    from_r: u8, from_c: u8,
    to_r: u8, to_c: u8,
    en_passant_target: Option<EnPassantSquare>,
) -> bool {
    let (fr, fc, tr, tc) = (from_r as i8, from_c as i8, to_r as i8, to_c as i8);
    let direction: i8 = if color == PlayerColor::White { 1 } else { -1 };

    if tc == fc && tr == fr + direction && board[to_r as usize][to_c as usize].is_none() { return true; }
    if tc == fc && ( (color == PlayerColor::White && fr == 1 && tr == fr + 2 * direction) ||
        (color == PlayerColor::Black && fr == 6 && tr == fr + 2 * direction) ) &&
        board[to_r as usize][to_c as usize].is_none() && board[(fr + direction) as usize][fc as usize].is_none() { return true; }
    if (tc == fc + 1 || tc == fc - 1) && tr == fr + direction {
        if let Some(target_piece) = &board[to_r as usize][to_c as usize] {
            if target_piece.color != color { return true; }
        }
    }
    
    if let Some(ep_square) = en_passant_target {
        if ep_square.row == to_r && ep_square.col == to_c && 
           (tc == fc + 1 || tc == fc - 1) && 
           tr == fr + direction 
        {
            return true;
        }
    }
    false
}

fn is_valid_king_move_basic(from_r: u8, from_c: u8, to_r: u8, to_c: u8) -> bool {
    let dr = (to_r as i8 - from_r as i8).abs();
    let dc = (to_c as i8 - from_c as i8).abs();
    (dr <= 1 && dc <= 1) && (dr != 0 || dc != 0)
}

fn is_valid_rook_move(board: &[[Option<Piece>; 8]; 8], from_r: u8, from_c: u8, to_r: u8, to_c: u8) -> bool {
    if from_r == to_r || from_c == to_c { return is_path_clear_linear(board, from_r, from_c, to_r, to_c); }
    false
}
fn is_valid_knight_move(from_r: u8, from_c: u8, to_r: u8, to_c: u8) -> bool {
    let dr = (to_r as i8 - from_r as i8).abs(); let dc = (to_c as i8 - from_c as i8).abs();
    (dr == 2 && dc == 1) || (dr == 1 && dc == 2)
}
fn is_valid_bishop_move(board: &[[Option<Piece>; 8]; 8], from_r: u8, from_c: u8, to_r: u8, to_c: u8) -> bool {
    if (to_r as i8 - from_r as i8).abs() == (to_c as i8 - from_c as i8).abs() {
        return is_path_clear_diagonal(board, from_r, from_c, to_r, to_c);
    }
    false
}
fn is_valid_queen_move(board: &[[Option<Piece>; 8]; 8], from_r: u8, from_c: u8, to_r: u8, to_c: u8) -> bool {
    if from_r == to_r || from_c == to_c { return is_path_clear_linear(board, from_r, from_c, to_r, to_c); }
    if (to_r as i8 - from_r as i8).abs() == (to_c as i8 - from_c as i8).abs() {
        return is_path_clear_diagonal(board, from_r, from_c, to_r, to_c);
    }
    false
}

// --- Castling Logic ---
fn update_castling_rights(rights: &mut CastlingRights, moved_piece: &Piece, from_r: u8, from_c: u8) {
    if moved_piece.piece_type == PieceType::King {
        if moved_piece.color == PlayerColor::White {
            rights.white_kingside = false; rights.white_queenside = false;
        } else {
            rights.black_kingside = false; rights.black_queenside = false;
        }
    } else if moved_piece.piece_type == PieceType::Rook {
        if moved_piece.color == PlayerColor::White {
            if from_r == 0 && from_c == 0 { rights.white_queenside = false; } // Rook from a1
            if from_r == 0 && from_c == 7 { rights.white_kingside = false; } // Rook from h1
        } else { // Black
            if from_r == 7 && from_c == 0 { rights.black_queenside = false; } // Rook from a8
            if from_r == 7 && from_c == 7 { rights.black_kingside = false; } // Rook from h8
        }
    }
}
fn is_valid_castling_move(
    board: &[[Option<Piece>; 8]; 8],
    from_r: u8, from_c: u8, to_r: u8, to_c: u8,
    rights: &CastlingRights, player_color: PlayerColor,
) -> bool {
    if from_r != to_r { return false; }
    let king_initial_row = if player_color == PlayerColor::White { 0 } else { 7 };
    if from_r != king_initial_row || from_c != 4 { return false; } 
    if is_king_in_check(board, player_color) { return false; }

    let attacker_color = player_color.opponent();

    if to_c == 6 { // Kingside (G file)
        let can_castle = if player_color == PlayerColor::White { rights.white_kingside } else { rights.black_kingside };
        if !can_castle { return false; }
        // Squares F and G must be empty
        if board[king_initial_row as usize][5].is_some() || board[king_initial_row as usize][6].is_some() { return false; }
        // Squares E (current), F, G must not be attacked
        if is_square_attacked(board, king_initial_row, 5, attacker_color) || 
           is_square_attacked(board, king_initial_row, 6, attacker_color) { return false; }
        return true;
    } else if to_c == 2 { // Queenside (C file)
        let can_castle = if player_color == PlayerColor::White { rights.white_queenside } else { rights.black_queenside };
        if !can_castle { return false; }
        // Squares D, C, B must be empty
        if board[king_initial_row as usize][3].is_some() || board[king_initial_row as usize][2].is_some() || board[king_initial_row as usize][1].is_some() { return false; }
        // Squares E (current), D, C must not be attacked
        if is_square_attacked(board, king_initial_row, 3, attacker_color) || 
           is_square_attacked(board, king_initial_row, 2, attacker_color) { return false; }
        return true;
    }
    false
}

// --- Path Clearing Helpers ---
fn is_path_clear_linear(board: &[[Option<Piece>; 8]; 8], from_r: u8, from_c: u8, to_r: u8, to_c: u8) -> bool {
    if from_r == to_r {
        let start_col = std::cmp::min(from_c, to_c) + 1; let end_col = std::cmp::max(from_c, to_c);
        for c in start_col..end_col { if board[from_r as usize][c as usize].is_some() { return false; } }
    } else if from_c == to_c {
        let start_row = std::cmp::min(from_r, to_r) + 1; let end_row = std::cmp::max(from_r, to_r);
        for r in start_row..end_row { if board[r as usize][from_c as usize].is_some() { return false; } }
    } else { return false; } 
    true
}
fn is_path_clear_diagonal(board: &[[Option<Piece>; 8]; 8], from_r: u8, from_c: u8, to_r: u8, to_c: u8) -> bool {
    let dr_total = to_r as i8 - from_r as i8; let dc_total = to_c as i8 - from_c as i8;
    if dr_total.abs() != dc_total.abs() || dr_total == 0 { return false; }
    let dr_step = dr_total.signum(); let dc_step = dc_total.signum();
    let mut r = from_r as i8 + dr_step; let mut c = from_c as i8 + dc_step;
    while r != to_r as i8 || c != to_c as i8 {
        if board[r as usize][c as usize].is_some() { return false; }
        r += dr_step; c += dc_step;
    }
    true
}

// --- Check Detection Helpers ---
fn find_king(board: &[[Option<Piece>; 8]; 8], king_color: PlayerColor) -> Result<(u8, u8)> {
    for r_idx in 0..8 { for c_idx in 0..8 {
        if let Some(p) = &board[r_idx][c_idx] {
            if p.piece_type == PieceType::King && p.color == king_color { return Ok((r_idx as u8, c_idx as u8)); }
        }
    }}
    err!(ChessError::KingNotFound)
}

fn can_pawn_attack(p_r: u8, p_c: u8, t_r: u8, t_c: u8, attacker_color: PlayerColor) -> bool {
    let dir: i8 = if attacker_color == PlayerColor::White { 1 } else { -1 };
    (t_c as i8 == p_c as i8 + 1 || t_c as i8 == p_c as i8 - 1) && t_r as i8 == p_r as i8 + dir
}

fn can_knight_attack(k_r: u8, k_c: u8, t_r: u8, t_c: u8) -> bool {
    let dr = (t_r as i8 - k_r as i8).abs(); let dc = (t_c as i8 - k_c as i8).abs();
    (dr == 2 && dc == 1) || (dr == 1 && dc == 2)
}

fn can_king_attack(k_r: u8, k_c: u8, t_r: u8, t_c: u8) -> bool {
    let dr = (t_r as i8 - k_r as i8).abs(); let dc = (t_c as i8 - k_c as i8).abs();
    dr <= 1 && dc <= 1 && (dr != 0 || dc != 0)
}

fn can_slider_attack(
    board: &[[Option<Piece>; 8]; 8],
    s_r: u8, s_c: u8, t_r: u8, t_c: u8,
    piece_type: PieceType
) -> bool {
    match piece_type {
        PieceType::Rook => {
            if s_r == t_r || s_c == t_c { 
                return is_path_clear_linear(board, s_r, s_c, t_r, t_c);
            }
        },
        PieceType::Bishop => {
            if (t_r as i8 - s_r as i8).abs() == (t_c as i8 - s_c as i8).abs() { 
                return is_path_clear_diagonal(board, s_r, s_c, t_r, t_c);
            }
        },
        PieceType::Queen => {
            if s_r == t_r || s_c == t_c {
                if is_path_clear_linear(board, s_r, s_c, t_r, t_c) { return true; }
            }
            if (t_r as i8 - s_r as i8).abs() == (t_c as i8 - s_c as i8).abs() {
                if is_path_clear_diagonal(board, s_r, s_c, t_r, t_c) { return true; }
            }
        },
        _ => return false, 
    }
    false
}

fn is_square_attacked(
    board: &[[Option<Piece>; 8]; 8],
    target_r: u8, target_c: u8,
    attacker_color: PlayerColor,
) -> bool {
    for r_from in 0..8 {
        for c_from in 0..8 {
            if let Some(attacker_piece) = &board[r_from as usize][c_from as usize] {
                if attacker_piece.color == attacker_color {
                    match attacker_piece.piece_type {
                        PieceType::Pawn => {
                            if can_pawn_attack(r_from as u8, c_from as u8, target_r, target_c, attacker_color) {
                                return true;
                            }
                        }
                        PieceType::Knight => {
                            if can_knight_attack(r_from as u8, c_from as u8, target_r, target_c) {
                                return true;
                            }
                        }
                        PieceType::King => {
                            if can_king_attack(r_from as u8, c_from as u8, target_r, target_c) {
                                return true;
                            }
                        }
                        PieceType::Rook | PieceType::Bishop | PieceType::Queen => {
                            if can_slider_attack(board, r_from as u8, c_from as u8, target_r, target_c, attacker_piece.piece_type) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }
    false
}

pub fn is_king_in_check(board: &[[Option<Piece>; 8]; 8], king_color: PlayerColor) -> bool {
    match find_king(board, king_color) {
        Ok((kr, kc)) => is_square_attacked(board, kr, kc, king_color.opponent()),
        Err(_) => true, 
    }
}
