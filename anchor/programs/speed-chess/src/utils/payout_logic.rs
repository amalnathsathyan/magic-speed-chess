// src/utils/payout_logic.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, TokenAccount, Token};

use crate::errors::ChessError;
use crate::state::ChessMatch;

// Helper function to perform the token transfer CPI
// By taking AccountInfo directly, we can manage lifetimes more clearly if needed,
// though for this specific structure, direct usage within process_payout is also fine.
fn transfer_tokens_with_signer<'a, 'b, 'c, 'info>(
    token_program: &Program<'info, Token>,
    from_account: &AccountInfo<'info>,
    to_account: &AccountInfo<'info>,
    authority_account: &AccountInfo<'info>, // This will be the PDA's AccountInfo
    signer_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: from_account.clone(),
        to: to_account.clone(),
        authority: authority_account.clone(),
    };
    let cpi_context = CpiContext::new_with_signer(
        token_program.to_account_info().clone(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_context, amount)?;
    Ok(())
}


pub fn process_payout<'info>( // Explicitly adding 'info lifetime here
    chess_match: &Account<'info, ChessMatch>,
    // Pass AccountInfo directly for accounts involved in CPI to better manage lifetimes
    match_escrow_token_account_info: &AccountInfo<'info>, // PDA-controlled token account
    winner_token_account_info: &AccountInfo<'info>,
    platform_token_account_info: &AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    program_id: &Pubkey, // The ID of your current program
    // We also need the actual TokenAccount data for validation, so we'll pass it too,
    // or expect the caller to have validated it. For safety, let's assume it's passed.
    match_escrow_token_account_data: &Account<'info, TokenAccount>,
) -> Result<()> {
    // 1. Derive the PDA which is the authority of the match_escrow_token_account
    let (pda_authority, bump_seed) = Pubkey::find_program_address(
        &[b"match_escrow", &chess_match.match_id.as_bytes()],
        program_id,
    );

    // 2. Verify that the derived PDA is indeed the owner of the escrow token account
    // This check is crucial for security.
    if match_escrow_token_account_data.owner != pda_authority {
        return err!(ChessError::InvalidEscrowAccount); // Or a more specific "EscrowAuthorityMismatch"
    }

    // 3. Prepare signer seeds for the PDA
    let match_id_bytes = chess_match.match_id.as_bytes();
    let seeds: &[&[u8]] = &[
        b"match_escrow",
        &match_id_bytes,
        &[bump_seed], // Use the bump from find_program_address
    ];
    let signer_seeds: &[&[&[u8]]] = &[&seeds[..]];

    // 4. Calculate fees and amounts
    let fee = chess_match.total_pot
        .checked_mul(chess_match.platform_fee_basis_points.into())
        .ok_or(ChessError::MathError)?
        .checked_div(10000)
        .ok_or(ChessError::MathError)?;

    let winner_amount = chess_match.total_pot
        .checked_sub(fee)
        .ok_or(ChessError::MathError)?;

    // 5. Transfer platform fee
    // The authority for the transfer is the PDA itself. We need its AccountInfo.
    // Since a PDA doesn't have its own Account struct in ctx.accounts unless it's also a data account,
    // we typically pass the `match_escrow_token_account_info` as the `authority` if it's a PDA *account*
    // and the program is signing for it.
    // However, for spl_token::Transfer, the `authority` field is the *owner* of the `from` account.
    // If the `from` account is owned by a PDA, that PDA is the authority.
    // The CPI call will be signed by the program using the PDA seeds.

    // For transferring *from* a PDA-owned token account, the `authority` in `token::Transfer`
    // should be the PDA's pubkey. The program then "signs" as this PDA.
    // Anchor's CpiContext::new_with_signer handles this by needing the authority's AccountInfo
    // to be one of the accounts in the CpiContext (often the `from.owner` or a separate `authority` account).
    // In our case, `match_escrow_token_account_info.owner` IS the `pda_authority`.
    // The `authority` field in the `Transfer` struct for CPI should be the PDA's key,
    // and the `CpiContext` takes the AccountInfo that represents this authority if needed.
    // Often, for PDA-owned token accounts, the `authority` in `Transfer` struct is the `from_account.to_account_info()`
    // because `from_account.owner` is the PDA. The critical part is `with_signer`.

    // Let's use the helper. The `authority_account` for the helper should be the PDA's AccountInfo.
    // If the PDA itself is not an account (just a key), then this becomes tricky.
    // However, the `match_escrow_token_account` *is* an account, and its *owner* is the PDA.
    // The authority for the token::Transfer struct must be an AccountInfo that *is_signer* or will be signed for by the program.
    // When a PDA is the authority, the program signs. The `authority` in `Transfer` can be the `from.to_account_info()` itself,
    // because `from.owner` is the PDA.

    if fee > 0 {
        msg!("Transferring platform fee: {}", fee);
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info().clone(),
                Transfer {
                    from: match_escrow_token_account_info.clone(),
                    to: platform_token_account_info.clone(),
                    authority: match_escrow_token_account_info.clone(), // The escrow account IS the authority being signed for by PDA
                },
                signer_seeds,
            ),
            fee,
        )?;
    }


    if winner_amount > 0 {
        msg!("Transferring winner amount: {}", winner_amount);
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info().clone(),
                Transfer {
                    from: match_escrow_token_account_info.clone(),
                    to: winner_token_account_info.clone(),
                    authority: match_escrow_token_account_info.clone(), // Same reasoning
                },
                signer_seeds,
            ),
            winner_amount,
        )?;
    }

    Ok(())
}

pub fn process_draw_payout<'info>( // Explicitly adding 'info lifetime here
    chess_match: &Account<'info, ChessMatch>,
    match_escrow_token_account_info: &AccountInfo<'info>,
    player_one_token_account_info: &AccountInfo<'info>,
    player_two_token_account_info: &AccountInfo<'info>,
    platform_token_account_info: &AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    program_id: &Pubkey,
    match_escrow_token_account_data: &Account<'info, TokenAccount>,
) -> Result<()> {
    let (pda_authority, bump_seed) = Pubkey::find_program_address(
        &[b"match_escrow", &chess_match.match_id.as_bytes()],
        program_id,
    );

    if match_escrow_token_account_data.owner != pda_authority {
        return err!(ChessError::InvalidEscrowAccount);
    }

    let match_id_bytes = chess_match.match_id.as_bytes();
    let seeds: &[&[u8]] = &[
        b"match_escrow",
        &match_id_bytes,
        &[bump_seed],
    ];
    let signer_seeds: &[&[&[u8]]] = &[&seeds[..]];

    let fee = chess_match.total_pot
        .checked_mul(chess_match.platform_fee_basis_points.into())
        .ok_or(ChessError::MathError)?
        .checked_div(10000)
        .ok_or(ChessError::MathError)?;

    let remaining_pot = chess_match.total_pot
        .checked_sub(fee)
        .ok_or(ChessError::MathError)?;

    let player_one_refund = remaining_pot
        .checked_div(2)
        .ok_or(ChessError::MathError)?; // Integer division, player two gets remainder

    let player_two_refund = remaining_pot
        .checked_sub(player_one_refund)
        .ok_or(ChessError::MathError)?;


    if fee > 0 {
        msg!("Transferring platform fee in draw: {}", fee);
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info().clone(),
                Transfer {
                    from: match_escrow_token_account_info.clone(),
                    to: platform_token_account_info.clone(),
                    authority: match_escrow_token_account_info.clone(),
                },
                signer_seeds,
            ),
            fee,
        )?;
    }

    if player_one_refund > 0 {
        msg!("Transferring player one refund: {}", player_one_refund);
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info().clone(),
                Transfer {
                    from: match_escrow_token_account_info.clone(),
                    to: player_one_token_account_info.clone(),
                    authority: match_escrow_token_account_info.clone(),
                },
                signer_seeds,
            ),
            player_one_refund,
        )?;
    }

    if player_two_refund > 0 {
        msg!("Transferring player two refund: {}", player_two_refund);
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info().clone(),
                Transfer {
                    from: match_escrow_token_account_info.clone(),
                    to: player_two_token_account_info.clone(),
                    authority: match_escrow_token_account_info.clone(),
                },
                signer_seeds,
            ),
            player_two_refund,
        )?;
    }

    Ok(())
}
