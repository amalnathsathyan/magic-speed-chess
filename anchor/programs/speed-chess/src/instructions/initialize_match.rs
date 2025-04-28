use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use std::mem::size_of;

use crate::errors::ChessError;
use crate::events::*;
use crate::state::*;
use crate::utils::initialize_chess_board;

#[derive(Accounts)]
#[instruction(match_id: String, bet_amount: u64)]
pub struct InitializeMatch<'info> {
    #[account(
        init,
        payer = player,
        space = 8 + ChessMatch::INIT_SPACE,
        seeds = [b"chess_match", match_id.as_bytes()],
        bump
    )]
    pub chess_match: Account<'info, ChessMatch>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub betting_token_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = player_token_account.owner == player.key() @ ChessError::InvalidOwner,
        constraint = player_token_account.mint == betting_token_mint.key() @ ChessError::InvalidMint
    )]
    pub player_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = player,
        seeds = [b"match_escrow", match_id.as_bytes()],
        bump,
        token::mint = betting_token_mint,
        token::authority = chess_match
    )]
    pub match_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializeMatch>, match_id: String, bet_amount: u64) -> Result<()> {
    let chess_match = &mut ctx.accounts.chess_match;
    let player = &ctx.accounts.player;
    let clock = Clock::get()?;

    // Ensure bet amount is valid for the token's decimals
    require!(bet_amount == 10_000_000, ChessError::InvalidBetAmount);

    // Set up the match with the creator as white player
    chess_match.match_id = match_id;
    chess_match.white_player = player.key();
    chess_match.black_player = None;
    chess_match.current_turn = PlayerColor::White;
    chess_match.white_last_move_time = clock.unix_timestamp;
    chess_match.black_last_move_time = 0;
    chess_match.move_timeout = 60; // 1 minute per move
    chess_match.game_status = GameStatus::WaitingForOpponent;
    chess_match.board = initialize_chess_board();
    chess_match.total_pot = bet_amount;
    chess_match.platform_fee_bps = 200; // 2% fee
    chess_match.betting_token_mint = ctx.accounts.betting_token_mint.key();

    // Transfer the bet from the player to the match escrow
    let cpi_accounts = Transfer {
        from: ctx.accounts.player_token_account.to_account_info(),
        to: ctx.accounts.match_token_account.to_account_info(),
        authority: player.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, bet_amount)?;

    emit!(MatchCreatedEvent {
        match_id: chess_match.match_id.clone(),
        creator: player.key(),
        bet_amount,
    });

    Ok(())
}