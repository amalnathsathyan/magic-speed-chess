// instructions/join_match.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::ChessError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(bet_amount: u64)]
pub struct JoinMatch<'info> {
    #[account(mut)]
    pub chess_match: Account<'info, ChessMatch>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    #[account(
        mut,
        constraint = player_token_account.owner == player.key(),
        constraint = player_token_account.mint == chess_match.betting_token_mint
    )]
    pub player_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"match_escrow", chess_match.match_id.as_bytes()],
        bump,
    )]
    pub match_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<JoinMatch>, bet_amount: u64) -> Result<()> {
    let chess_match = &mut ctx.accounts.chess_match;
    let player = &ctx.accounts.player;
    let clock = Clock::get()?;
    
    // Ensure proper bet amount
    require!(bet_amount == 10_000_000, ChessError::InvalidBetAmount);
    
    // Ensure match is waiting for opponent
    require!(
        chess_match.game_status == GameStatus::WaitingForOpponent,
        ChessError::MatchAlreadyFull
    );
    
    // Ensure player isn't already white
    require!(
        chess_match.white_player != player.key(),
        ChessError::AlreadyJoined
    );
    
    // Transfer bet from joining player to match escrow
    let cpi_accounts = Transfer {
        from: ctx.accounts.player_token_account.to_account_info(),
        to: ctx.accounts.match_token_account.to_account_info(),
        authority: player.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, bet_amount)?;
    
    // Update match state
    chess_match.black_player = Some(player.key());
    chess_match.game_status = GameStatus::Active;
    chess_match.total_pot += bet_amount;
    chess_match.white_last_move_time = clock.unix_timestamp; // Reset timer for first move
    
    emit!(PlayerJoinedEvent {
        match_id: chess_match.match_id.clone(),
        player: player.key(),
        color: PlayerColor::Black,
    });
    
    Ok(())
}