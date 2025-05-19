// src/instructions/process_match_settlement.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount}; // TokenAccount for type, Token for Program

use crate::errors::ChessError;
use crate::state::{ChessMatch, GameStatus, PlayerColor}; // PlayerColor for winner check
use crate::utils::payout_logic; // Import your payout functions

#[derive(Accounts)]
pub struct ProcessMatchSettlement<'info> {
    #[account(
        mut, // Mutable because we set payout_processed = true
        seeds = [b"chess_match", chess_match.match_id.as_bytes()], // Assuming match_id is String
        bump = chess_match.bump,
        constraint = (
            chess_match.game_status == GameStatus::WhiteWins ||
            chess_match.game_status == GameStatus::BlackWins ||
            chess_match.game_status == GameStatus::Draw
        ) @ ChessError::GameNotConcluded,
        constraint = !chess_match.payout_processed @ ChessError::PayoutAlreadyProcessed,
    )]
    pub chess_match: Account<'info, ChessMatch>,

    // The PDA escrow token account holding the bets.
    // We need both its Account<TokenAccount> for data (like owner) and its AccountInfo for CPI.
    #[account(
        mut,
        seeds = [b"match_escrow", chess_match.match_id.as_bytes()], // Assuming match_id is String
        bump, // Anchor derives and verifies this bump
    )]
    pub match_escrow_token_account: Account<'info, TokenAccount>,

    // Player 1's token account (ATA)
    #[account(
        mut,
        constraint = player_one_ata.owner == chess_match.players[0] @ ChessError::PlayerTokenAccountMismatch,
        constraint = player_one_ata.mint == chess_match.betting_token_mint @ ChessError::PlayerTokenAccountMismatch,
    )]
    pub player_one_ata: Account<'info, TokenAccount>, // Player 1's Associated Token Account

    // Player 2's token account (ATA)
    #[account(
        mut,
        constraint = player_two_ata.owner == chess_match.players[1] @ ChessError::PlayerTokenAccountMismatch,
        constraint = player_two_ata.mint == chess_match.betting_token_mint @ ChessError::PlayerTokenAccountMismatch,
    )]
    pub player_two_ata: Account<'info, TokenAccount>, // Player 2's Associated Token Account
    
    // Platform's fee collection account
    #[account(
        mut,
        constraint = platform_fee_ata.mint == chess_match.betting_token_mint @ ChessError::PlatformTokenAccountError,
        // Owner of platform_fee_ata is not constrained here, assumed to be a known, correct address.
    )]
    pub platform_fee_ata: Account<'info, TokenAccount>, // Platform's Associated Token Account

    pub token_program: Program<'info, Token>,
    // system_program: Program<'info, System>, // Not directly needed for this instruction
}

pub fn handler(ctx: Context<ProcessMatchSettlement>) -> Result<()> {
    let chess_match = &mut ctx.accounts.chess_match; // Note: mutable reference
    
    // These are Account<TokenAccount> types from the context
    let match_escrow_data = &ctx.accounts.match_escrow_token_account;
    let player_one_ata_data = &ctx.accounts.player_one_ata;
    let player_two_ata_data = &ctx.accounts.player_two_ata;
    let platform_fee_ata_data = &ctx.accounts.platform_fee_ata;

    // These are AccountInfo types needed for the payout_logic functions
    let match_escrow_info = match_escrow_data.to_account_info();
    let player_one_ata_info = player_one_ata_data.to_account_info();
    let player_two_ata_info = player_two_ata_data.to_account_info();
    let platform_fee_ata_info = platform_fee_ata_data.to_account_info();
    
    let token_program_info = &ctx.accounts.token_program;
    let current_program_id = ctx.program_id; // program_id is implicitly available via ctx.program_id
    
    msg!("Processing settlement for match: {}", chess_match.match_id);
    msg!("Game status: {:?}", chess_match.game_status);
    msg!("Total pot: {}", chess_match.total_pot);

    match chess_match.game_status {
        GameStatus::WhiteWins => {
            msg!("White wins. Payout to player 1: {}", chess_match.players[0]);
            payout_logic::process_payout(
                chess_match,                     // &Account<'info, ChessMatch>
                &match_escrow_info,              // &AccountInfo<'info>
                &player_one_ata_info,            // &AccountInfo<'info> for winner
                &platform_fee_ata_info,          // &AccountInfo<'info>
                token_program_info,              // &Program<'info, Token>
                current_program_id,              // &Pubkey
                match_escrow_data,               // &Account<'info, TokenAccount> for validation
            )?;
        }
        GameStatus::BlackWins => {
            msg!("Black wins. Payout to player 2: {}", chess_match.players[1]);
            if chess_match.players[1] == Pubkey::default() {
                // This should ideally be prevented by game logic if BlackWins is the status
                return err!(ChessError::InvalidGameStateForPayout);
            }
            payout_logic::process_payout(
                chess_match,
                &match_escrow_info,
                &player_two_ata_info,            // &AccountInfo<'info> for winner
                &platform_fee_ata_info,
                token_program_info,
                current_program_id,
                match_escrow_data,
            )?;
        }
        GameStatus::Draw => {
            msg!("Game is a draw. Refunding players.");
            if chess_match.players[1] == Pubkey::default() && chess_match.players[0] != Pubkey::default() {
                // Scenario: P1 created match, P2 never joined, P1 wants to abort and get refund (minus fee?)
                // This requires different logic - e.g., a specific "abort_match_and_refund_creator"
                // For now, a Draw status implies both players were active.
                // If P1 created and wants refund before P2 joins, it's not a 'Draw' yet.
                // The game should not reach a Draw status with only one player.
                msg!("Draw detected but player 2 is not set. This state is unexpected for a draw payout.");
                return err!(ChessError::InvalidGameStateForPayout);
            }
            if chess_match.players[0] == Pubkey::default() || chess_match.players[1] == Pubkey::default() {
                 // If either player is default, we can't proceed with a standard draw payout.
                return err!(ChessError::InvalidGameStateForPayout);
            }

            payout_logic::process_draw_payout(
                chess_match,
                &match_escrow_info,
                &player_one_ata_info,
                &player_two_ata_info,
                &platform_fee_ata_info,
                token_program_info,
                current_program_id,
                match_escrow_data,
            )?;
        }
        _ => {
            // GameStatus::Active or GameStatus::WaitingForOpponent
            // This is already prevented by the account constraint.
            return err!(ChessError::GameNotConcluded);
        }
    }

    // Mark payout as processed to prevent double payouts
    chess_match.payout_processed = true;

    msg!("Settlement processed successfully for match: {}", chess_match.match_id);
    Ok(())
}
