// src/instructions/join_match.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::ChessError;
use crate::events::*;
use crate::state::*; // Make sure this brings in ChessMatch, PlayerColor, GameStatus, etc.

// Define allowed token mints (these are string literals, ensure they match your actual mint addresses)
const SEND_TOKEN_MINT_STR: &str = "SENDYLjLBaTgjyfXtPP2aHUt91WhNzX7iUfpThyApht"; // mock-SEND mint
const WSOL_MINT_STR: &str = "WSiBAnrREwNLdGkDpXuqdKL4fJvAHeJhDfehmFdMdvw";     // mock-Wrapped SOL mint

#[derive(Accounts)]
#[instruction(bet_amount_arg: u64)] // Argument for the instruction
pub struct JoinMatch<'info> {
    #[account(
        mut,
        seeds = [b"chess_match", chess_match.match_id.as_bytes()], // Use the match_id from the account itself for seed
        bump = chess_match.bump,
        constraint = chess_match.game_status == GameStatus::WaitingForOpponent @ ChessError::MatchAlreadyFullOrActive, // Updated error
        constraint = chess_match.players[1] == Pubkey::default() @ ChessError::MatchAlreadyFull, 
    )]
    pub chess_match: Account<'info, ChessMatch>,

    #[account(mut)]
    pub player_two_signer: Signer<'info>, // Renamed from player for clarity

    #[account(
        mut,
        constraint = player_token_account.owner == player_two_signer.key() @ ChessError::InvalidOwner,
        // This constraint correctly checks against the mint stored in chess_match
        constraint = player_token_account.mint == chess_match.betting_token_mint @ ChessError::InvalidMintForJoin, // Specific error
    )]
    pub player_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"match_escrow", chess_match.match_id.as_bytes()],
        // The bump for match_escrow_token_account might be different from chess_match.bump
        // It should be fetched or passed if this account was initialized with its own bump.
        // For simplicity, if it's always determinable or if you store it, fine. Otherwise, consider passing it.
        // Let's assume it's derivable or you have a way to get its bump. Often, PDAs used as token authorities
        // don't store their own bump in the token account data itself, the authority is just the PDA key.
        // The seeds constraint above is what matters for identifying the account.
        bump // Assuming this bump is for the escrow PDA, which might need to be passed or stored if not derivable from chess_match.bump
    )]
    pub match_escrow_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>, // Often needed for account initializations or rent payments by payer
}

pub fn handler(ctx: Context<JoinMatch>, bet_amount_arg: u64) -> Result<()> {
    let chess_match = &mut ctx.accounts.chess_match;
    let player_two = &ctx.accounts.player_two_signer; // Use the renamed field
    let clock = Clock::get()?;

    // 1. Verify the joiner is not the creator
    require!(
        chess_match.players[0] != player_two.key(), 
        ChessError::CannotJoinOwnMatch // New Error
    );

    // 2. Validate that the betting_token_mint stored in chess_match is one of the allowed types
    // This step ensures the integrity of the match's configured token.
    let send_mint_pubkey = SEND_TOKEN_MINT_STR.parse::<Pubkey>().map_err(|_| error!(ChessError::InvalidPublicKeyString))?;
    let wsol_mint_pubkey = WSOL_MINT_STR.parse::<Pubkey>().map_err(|_| error!(ChessError::InvalidPublicKeyString))?;
    
    require!(
        chess_match.betting_token_mint == send_mint_pubkey || chess_match.betting_token_mint == wsol_mint_pubkey,
        ChessError::UnsupportedBettingToken // This error means the match was somehow initialized with a bad token
    );

    // 3. Verify the bet_amount_arg against the specific requirements for the *already determined* chess_match.betting_token_mint
    // The player_token_account.mint is already constrained to be == chess_match.betting_token_mint.
    if chess_match.betting_token_mint == send_mint_pubkey {
        require!(bet_amount_arg == 10_000_000, ChessError::InvalidBetAmount); // e.g., 10 SEND
    } else if chess_match.betting_token_mint == wsol_mint_pubkey {
        require!(bet_amount_arg == 100_000_000, ChessError::InvalidBetAmount); // e.g., 0.1 wSOL
    }
    // No 'else' needed because the previous require ensures it's one of these two.

    // 4. Validate that joining player's bet amount matches player one's bet
    require!(
        bet_amount_arg == chess_match.bet_amount_player_one, 
        ChessError::BetAmountMismatch // New Error
    );

    // 5. Perform the token transfer from joining player to the match escrow
    let cpi_accounts_transfer = Transfer {
        from: ctx.accounts.player_token_account.to_account_info(),
        to: ctx.accounts.match_escrow_token_account.to_account_info(),
        authority: player_two.to_account_info(), // Player_two signs for their own token transfer
    };
    let cpi_program_transfer = ctx.accounts.token_program.to_account_info();
    let cpi_context_transfer = CpiContext::new(cpi_program_transfer, cpi_accounts_transfer);
    token::transfer(cpi_context_transfer, bet_amount_arg)?;

    // 6. Update chess match state
    chess_match.players[1] = player_two.key(); // Assign player two
    chess_match.game_status = GameStatus::Active; // Game is now active
    chess_match.bet_amount_player_two = bet_amount_arg;
    chess_match.total_pot = chess_match.bet_amount_player_one
        .checked_add(bet_amount_arg)
        .ok_or(ChessError::MathError)?;
    
    // When player 2 joins, it's still player 1's (White's) turn.
    // The last_move_timestamp was set when P1 initialized the match, effectively starting P1's clock.
    // No change to last_move_timestamp here is needed if that's the desired logic.
    // If you want to reset player 1's clock upon player 2 joining:
    // chess_match.last_move_timestamp = clock.unix_timestamp;

    msg!("Player {} joined match {}. Game is now active.", player_two.key(), chess_match.match_id);

    // 7. Emit PlayerJoinedEvent
    emit!(PlayerJoinedEvent {
        match_id: chess_match.match_id.clone(),
        player_one: chess_match.players[0],
        player_two: chess_match.players[1],
        betting_token_mint: chess_match.betting_token_mint,
        bet_amount_per_player: bet_amount_arg, // Both players bet the same amount
    });

    Ok(())
}
