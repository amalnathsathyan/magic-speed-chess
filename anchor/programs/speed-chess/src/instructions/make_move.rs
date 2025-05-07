use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::errors::ChessError;
use crate::events::*;
use crate::state::*;
use crate::utils::*;

#[derive(Accounts)]
pub struct MakeMove<'info> {
    #[account(
        mut,
        seeds = [b"chess_match", chess_match.match_id.as_bytes()],
        bump,
    )]   
    pub chess_match: Account<'info, ChessMatch>,

    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [b"match_escrow", chess_match.match_id.as_bytes()],
        bump,
    )]
    pub match_token_account: Account<'info, TokenAccount>,

    // For winner payout
    #[account(
        mut,
        constraint = player_token_account.owner == player.key(),
        constraint = player_token_account.mint == chess_match.betting_token_mint
    )]
    pub player_token_account: Account<'info, TokenAccount>,

    // For platform fee
    #[account(mut)]
    pub platform_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<MakeMove>,
    from_row: u8,
    from_col: u8,
    to_row: u8,
    to_col: u8,
    promotion: Option<PieceType>,
) -> Result<()> {
    let chess_match = &mut ctx.accounts.chess_match;
    let player = &ctx.accounts.player;
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // Ensure game is active
    require!(
        chess_match.game_status == GameStatus::Active,
        ChessError::GameNotActive
    );

    // Determine player color
    let player_color = if chess_match.white_player == player.key() {
        PlayerColor::White
    } else if chess_match.black_player == Some(player.key()) {
        PlayerColor::Black
    } else {
        return err!(ChessError::NotAPlayer);
    };

    // Ensure it's player's turn
    require!(
        chess_match.current_turn == player_color,
        ChessError::NotYourTurn
    );

    // Check move timeout (1 minute per move)
    let last_move_time = match player_color {
        PlayerColor::White => chess_match.white_last_move_time,
        PlayerColor::Black => chess_match.black_last_move_time,
    };

    if now - last_move_time > chess_match.move_timeout {
        // Player has timed out, opponent wins
        chess_match.game_status = match player_color {
            PlayerColor::White => GameStatus::BlackWin, // White timed out
            PlayerColor::Black => GameStatus::WhiteWin, // Black timed out
        };

        emit!(GameEndedEvent {
            match_id: chess_match.match_id.clone(),
            winner: Some(match player_color {
                PlayerColor::White => PlayerColor::Black,
                PlayerColor::Black => PlayerColor::White,
            }),
            reason: GameEndReason::Timeout,
        });
        process_payout(
            &ctx.accounts.chess_match,
        )?;

        // And in make_move.rs, line 159
        process_draw_payout(
            &ctx.accounts.chess_match
        )?;

        return Ok(());
    }

    // Validate move
    require!(
        from_row < 8 && from_col < 8 && to_row < 8 && to_col < 8,
        ChessError::InvalidMove
    );

    // Validate chess rules
    let move_result = validate_and_apply_move(
        &mut chess_match.board,
        from_row,
        from_col,
        to_row,
        to_col,
        player_color,
        promotion,
    )?;

    // Update state based on move result
    match move_result {
        MoveResult::Normal => {
            // Switch turns and update last move time
            chess_match.current_turn = match player_color {
                PlayerColor::White => {
                    chess_match.white_last_move_time = now;
                    chess_match.black_last_move_time = now;
                    PlayerColor::Black
                }
                PlayerColor::Black => {
                    chess_match.black_last_move_time = now;
                    chess_match.white_last_move_time = now;
                    PlayerColor::White
                }
            };
        }
        MoveResult::Checkmate => {
            // Game ends with current player winning
            chess_match.game_status = match player_color {
                PlayerColor::White => GameStatus::WhiteWin,
                PlayerColor::Black => GameStatus::BlackWin,
            };

            emit!(GameEndedEvent {
                match_id: chess_match.match_id.clone(),
                winner: Some(player_color),
                reason: GameEndReason::Checkmate,
            });

            // Process payout to winner
            process_payout(
                chess_match,
            )?;
        }
        MoveResult::Stalemate => {
            // Game ends in draw
            chess_match.game_status = GameStatus::Draw;

            emit!(GameEndedEvent {
                match_id: chess_match.match_id.clone(),
                winner: None,
                reason: GameEndReason::Stalemate,
            });

            // Process refund to both players
            process_payout(
                chess_match,
            )?;
        }
    }

    // Record the move
    let algebraic_move = format!(
        "{}{}-{}{}",
        (from_col + 97) as char, // Convert 0-7 to a-h
        from_row + 1,
        (to_col + 97) as char,
        to_row + 1
    );

    emit!(MoveMadeEvent {
        match_id: chess_match.match_id.clone(),
        player: player.key(),
        color: player_color,
        algebraic_move,
        from_row,
        from_col,
        to_row,
        to_col,
        promotion,
    });

    Ok(())
}
