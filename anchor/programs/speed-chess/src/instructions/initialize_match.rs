// src/instructions/initialize_match.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::ChessError;
use crate::events::*;
use crate::state::*;      // Brings in ChessMatch, Enums, CastlingRights, MAX_MATCH_ID_LEN, etc.
use crate::utils::*; // For initialize_chess_board (ensure this is in scope, e.g. pub use crate::utils::chess_logic)
                        // If initialize_chess_board is directly in utils module: use crate::utils::initialize_chess_board;

// Define allowed token mints
const SEND_TOKEN_MINT_STR: &str = "SENDYLjLBaTgjyfXtPP2aHUt91WhNzX7iUfpThyApht"; // mock-SEND mint
const WSOL_MINT_STR: &str = "WSiBAnrREwNLdGkDpXuqdKL4fJvAHeJhDfehmFdMdvw";     // mock-Wrapped SOL mint

#[derive(Accounts)]
#[instruction(
    match_id_arg: String, 
    bet_amount_arg: u64, 
    move_timeout_duration_arg: i64, 
    platform_fee_basis_points_arg: u16
)]
pub struct InitializeMatch<'info> {
    #[account(
        init,
        payer = player_signer,
        space = 8 + ChessMatch::INIT_SPACE, // Anchor adds 8 bytes for discriminator
        seeds = [b"chess_match", match_id_arg.as_bytes()], // Use instruction arg for seed
        bump
    )]
    pub chess_match: Account<'info, ChessMatch>,

    #[account(mut)]
    pub player_signer: Signer<'info>, // Renamed from 'player' for clarity

    // This account is used to validate the betting_token_mint against allowed mints
    pub betting_token_mint_account: Account<'info, Mint>, // Renamed from 'betting_token_mint'

    #[account(
        mut,
        constraint = player_token_account.owner == player_signer.key() @ ChessError::InvalidOwner,
        constraint = player_token_account.mint == betting_token_mint_account.key() @ ChessError::InvalidMint
    )]
    pub player_token_account: Account<'info, TokenAccount>, // Player's source ATA for the bet

    #[account(
        init,
        payer = player_signer,
        seeds = [b"match_escrow", match_id_arg.as_bytes()], // Use instruction arg for seed
        bump,
        token::mint = betting_token_mint_account, // Use the validated mint account from context
        token::authority = chess_match // The chess_match PDA is the authority of this escrow account
    )]
    pub match_escrow_token_account: Account<'info, TokenAccount>, // Renamed from 'match_token_account'

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    // rent: Sysvar<'info, Rent>, // Removed, not strictly needed for `init` as payer covers rent.
}

pub fn handler(
    ctx: Context<InitializeMatch>, 
    match_id_arg: String, 
    bet_amount_arg: u64,
    move_timeout_duration_arg: i64,
    platform_fee_basis_points_arg: u16,
) -> Result<()> {
    let chess_match_account = &mut ctx.accounts.chess_match;
    let player_signer_account = &ctx.accounts.player_signer;
    let clock = Clock::get()?;

    // 1. Validate match_id length (important for PDA and state String)
    require!(
        !match_id_arg.is_empty() && match_id_arg.len() <= MAX_MATCH_ID_LEN, 
        ChessError::InvalidMatchIdLength
    );

    // 2. Validate Betting Token (SEND or wSOL)
    let send_mint_pubkey = SEND_TOKEN_MINT_STR.parse::<Pubkey>().map_err(|_| error!(ChessError::InvalidPublicKeyString))?;
    let wsol_mint_pubkey = WSOL_MINT_STR.parse::<Pubkey>().map_err(|_| error!(ChessError::InvalidPublicKeyString))?;
    let actual_betting_token_mint_key = ctx.accounts.betting_token_mint_account.key();

    require!(
        actual_betting_token_mint_key == send_mint_pubkey || actual_betting_token_mint_key == wsol_mint_pubkey,
        ChessError::UnsupportedBettingToken
    );

    // 3. Validate Bet Amount (keeping your specific value for now, make this flexible if needed)
    // This check should ideally consider token decimals.
    // Example: if 10_000_000 is for a 6-decimal token like SEND.
    if actual_betting_token_mint_key == send_mint_pubkey {
        require!(bet_amount_arg == 10_000_000, ChessError::InvalidBetAmount); // e.g., 10 SEND
    } else if actual_betting_token_mint_key == wsol_mint_pubkey {
        // For wSOL (9 decimals), a similar "unit" bet would be much larger.
        // For example, 0.1 wSOL = 100_000_000 lamports. Adjust this as per your game's design.
        require!(bet_amount_arg == 100_000_000, ChessError::InvalidBetAmount); // e.g., 0.1 wSOL
    } else {
        // This branch should ideally not be reached due to the UnsupportedBettingToken check.
        return err!(ChessError::InvalidBetAmount); // Fallback, though logically covered.
    }

    // 4. Initialize ChessMatch account fields
    chess_match_account.match_id = match_id_arg.clone(); // Use the validated instruction argument
    chess_match_account.players[0] = player_signer_account.key();
    chess_match_account.players[1] = Pubkey::default(); // Player 2 joins later
    chess_match_account.current_player_idx = 0; 
    chess_match_account.current_turn = PlayerColor::White;
    
    chess_match_account.last_move_timestamp = clock.unix_timestamp; 
    chess_match_account.move_timeout_duration = move_timeout_duration_arg;

    chess_match_account.game_status = GameStatus::WaitingForOpponent;
    chess_match_account.game_end_reason = None;

    // Ensure chess_logic::initialize_chess_board is correctly imported/accessible
    // If it's in `src/utils/chess_logic.rs`, then `use crate::utils::chess_logic;` at the top
    // and then `chess_logic::initialize_chess_board()`.
    // If `initialize_chess_board` itself is pub in `src/utils/mod.rs` and re-exported,
    // then `crate::utils::initialize_chess_board()` might work.
    // Your original file used `use crate::utils::initialize_chess_board;`
    chess_match_account.board = chess_logic::initialize_chess_board();
    chess_match_account.castling_rights = CastlingRights::default();
    chess_match_account.en_passant_target = None;
    chess_match_account.halfmove_clock = 0;
    chess_match_account.fullmove_number = 1;

    chess_match_account.betting_token_mint = actual_betting_token_mint_key;
    chess_match_account.bet_amount_player_one = bet_amount_arg;
    chess_match_account.bet_amount_player_two = 0; 
    chess_match_account.total_pot = bet_amount_arg; 
    
    require!(platform_fee_basis_points_arg <= 10000, ChessError::InvalidPlatformFee); // Max 100% fee
    chess_match_account.platform_fee_basis_points = platform_fee_basis_points_arg;
    
    chess_match_account.bump = ctx.bumps.chess_match; // Store the bump for the chess_match PDA

    // 5. Transfer the bet from the player to the match escrow
    let cpi_accounts_transfer = Transfer {
        from: ctx.accounts.player_token_account.to_account_info(),
        to: ctx.accounts.match_escrow_token_account.to_account_info(),
        authority: player_signer_account.to_account_info(), // Player signs for their own token transfer
    };
    let cpi_program_transfer = ctx.accounts.token_program.to_account_info();
    let cpi_ctx_transfer = CpiContext::new(cpi_program_transfer, cpi_accounts_transfer);
    token::transfer(cpi_ctx_transfer, bet_amount_arg)?;

    // 6. Emit event
    emit!(MatchCreatedEvent {
        match_id: chess_match_account.match_id.clone(),
        creator: player_signer_account.key(),
        betting_token_mint: chess_match_account.betting_token_mint, // This is already a Pubkey
        bet_amount: bet_amount_arg,
        move_timeout_duration: move_timeout_duration_arg,
        platform_fee_basis_points: platform_fee_basis_points_arg,
    });

    msg!("Match created: {}", chess_match_account.match_id);
    Ok(())
}

