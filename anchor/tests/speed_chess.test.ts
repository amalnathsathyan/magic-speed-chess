import * as anchor from '@coral-xyz/anchor';
import { Program, BN } from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from '@solana/spl-token';
import { assert } from 'chai';
import { SpeedChess } from '../target/types/speed_chess';

describe('speed_chess', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.SpeedChess as Program<SpeedChess>;

  // Keypairs and accounts
  const whitePlayer = Keypair.generate();
  const blackPlayer = Keypair.generate();
  const thirdParty = Keypair.generate();
  let mint: PublicKey;
  let whiteTokenAccount: PublicKey;
  let blackTokenAccount: PublicKey;
  let platformFeeTokenAccount: PublicKey;
  let thirdPartyTokenAccount: PublicKey;
  const matchId = 'test_match';
  const betAmount = new BN(10_000_000);

  // Derive PDAs
  const [chessMatchPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('chess_match'), Buffer.from(matchId)],
    program.programId
  );
  const [matchTokenAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('match_escrow'), Buffer.from(matchId)],
    program.programId
  );

  // Platform fee account (mock)
  const platformFeeWallet = Keypair.generate();

  beforeAll(async () => {
    // Fund players
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: whitePlayer.publicKey,
        lamports: 1_000_000_000,
      }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: blackPlayer.publicKey,
        lamports: 1_000_000_000,
      }),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: thirdParty.publicKey,
        lamports: 1_000_000_000,
      })
    );
    await provider.sendAndConfirm(tx, [payer.payer]);

    // Create token mint
    mint = await createMint(
      provider.connection,
      payer.payer,
      payer.publicKey,
      null,
      6 // Decimals
    );

    // Create token accounts
    whiteTokenAccount = await createAccount(
      provider.connection,
      payer.payer,
      mint,
      whitePlayer.publicKey
    );
    blackTokenAccount = await createAccount(
      provider.connection,
      payer.payer,
      mint,
      blackPlayer.publicKey
    );

    thirdPartyTokenAccount = await createAccount(
      provider.connection,
      payer.payer,
      mint,
      thirdParty.publicKey
    );

    // Mint tokens to players
    await mintTo(
      provider.connection,
      payer.payer,
      mint,
      whiteTokenAccount,
      payer.publicKey,
      100_000_000
    );
    await mintTo(
      provider.connection,
      payer.payer,
      mint,
      blackTokenAccount,
      payer.publicKey,
      100_000_000
    );

    await mintTo(
      provider.connection,
      payer.payer,
      mint,
      thirdPartyTokenAccount,
      payer.publicKey,
      100_000_000
    );

    // Create platform token account
    platformFeeTokenAccount = await createAccount(
      provider.connection,
      payer.payer,
      mint,
      platformFeeWallet.publicKey
    );
  });

  it('Initialize Match', async () => {
    await program.methods
      .initializeMatch(matchId, betAmount)
      .accounts({
        chessMatch: chessMatchPda,
        player: whitePlayer.publicKey,
        bettingTokenMint: mint,
        playerTokenAccount: whiteTokenAccount,
        matchTokenAccount: matchTokenAccountPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([whitePlayer])
      .rpc();

    const chessMatch = await program.account.chessMatch.fetch(chessMatchPda);
    assert.equal(chessMatch.matchId, matchId);
    assert.equal(chessMatch.whitePlayer.toString(), whitePlayer.publicKey.toString());
    assert.equal(chessMatch.blackPlayer, null);
    assert.ok('waitingForOpponent' in chessMatch.gameStatus);
    assert.equal(chessMatch.totalPot.toNumber(), betAmount.toNumber());
    assert.equal(chessMatch.bettingTokenMint.toString(), mint.toString());
    assert.equal(chessMatch.platformFeeBps, 200);
  });

  it('Fail Initialize Match with Invalid Bet Amount', async () => {
    const invalidMatchId = 'invalid_match';
    const [invalidChessMatchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('chess_match'), Buffer.from(invalidMatchId)],
      program.programId
    );
    const [invalidMatchTokenAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('match_escrow'), Buffer.from(invalidMatchId)],
      program.programId
    );

    try {
      await program.methods
        .initializeMatch(invalidMatchId, new BN(5_000_000))
        .accounts({
          chessMatch: invalidChessMatchPda,
          player: whitePlayer.publicKey,
          bettingTokenMint: mint,
          playerTokenAccount: whiteTokenAccount,
          matchTokenAccount: invalidMatchTokenAccountPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([whitePlayer])
        .rpc();
      assert.fail('Should have failed with invalid bet amount');
    } catch (err) {
      assert.include(err.toString(), 'InvalidBetAmount');
    }
  });

  it('Fail Join Match - White player AlreadyJoined', async () => {
    try {
      await program.methods
        .joinMatch(betAmount)
        .accounts({
          chessMatch: chessMatchPda,
          player: whitePlayer.publicKey,
          playerTokenAccount: whiteTokenAccount,
          matchTokenAccount: matchTokenAccountPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([whitePlayer])
        .rpc();
      assert.fail('Should have failed when white player tries to join a match he created');
    } catch (err) {
      assert.include(err.toString(), 'You have already joined this match');
    }
  });

  it('Join Match - Blackplayer Joins', async () => {
    await program.methods
      .joinMatch(betAmount)
      .accounts({
        chessMatch: chessMatchPda,
        player: blackPlayer.publicKey,
        playerTokenAccount: blackTokenAccount,
        matchTokenAccount: matchTokenAccountPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([blackPlayer])
      .rpc();

    const chessMatch = await program.account.chessMatch.fetch(chessMatchPda);
    assert.equal(chessMatch.blackPlayer.toString(), blackPlayer.publicKey.toString());
    assert.ok('active' in chessMatch.gameStatus);
    assert.equal(chessMatch.totalPot.toNumber(), betAmount.toNumber() * 2);
  });

  it('Fail Join Match - Blackplayer tries to join again - The match is already full', async () => {
    try {
      await program.methods
        .joinMatch(betAmount)
        .accounts({
          chessMatch: chessMatchPda,
          player: blackPlayer.publicKey,
          playerTokenAccount: blackTokenAccount,
          matchTokenAccount: matchTokenAccountPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([blackPlayer])
        .rpc();
      assert.fail('Should have failed when black player tries to join the match again');
    } catch (err) {
      assert.include(err.toString(), 'The match is already full');
    }
  });

  it('Fail Join Match - Third Party Joins - The match is already full', async () => {
    try {
      await program.methods
        .joinMatch(betAmount)
        .accounts({
          chessMatch: chessMatchPda,
          player: thirdParty.publicKey,
          playerTokenAccount: thirdPartyTokenAccount,
          matchTokenAccount: matchTokenAccountPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([thirdParty])
        .rpc();
      assert.fail('Should have failed when third player tries to join the match again');
    } catch (err) {
      assert.include(err.toString(), 'The match is already full');
    }
  });


  it('Make Move', async () => {
    // Move pawn from e2 to e4 (row 1 to 3, col 4)
    const fromRow = 1;
    const fromCol = 4;
    const toRow = 3;
    const toCol = 4;

    await program.methods
      .makeMove(fromRow, fromCol, toRow, toCol, null)
      .accounts({
        chessMatch: chessMatchPda,
        player: whitePlayer.publicKey,
        matchTokenAccount: matchTokenAccountPda,
        playerTokenAccount: whiteTokenAccount,
        platformTokenAccount: platformFeeTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([whitePlayer])
      .rpc();

    const chessMatch = await program.account.chessMatch.fetch(chessMatchPda);
    assert.ok('black' in chessMatch.currentTurn);
    assert.isNotNull(chessMatch.board[toRow][toCol]);
    assert.ok('pawn' in chessMatch.board[toRow][toCol].pieceType);
    assert.ok('white' in chessMatch.board[toRow][toCol].color );
    assert.isNull(chessMatch.board[fromRow][fromCol]);
  });

  it('Fail Make Move - Not Your Turn', async () => {
    try {
      await program.methods
        .makeMove(1, 4, 3, 4, null)
        .accounts({
          chessMatch: chessMatchPda,
          player: whitePlayer.publicKey,
          matchTokenAccount: matchTokenAccountPda,
          playerTokenAccount: whiteTokenAccount,
          platformTokenAccount: platformFeeTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([whitePlayer])
        .rpc();
      assert.fail('Should have failed when not player\'s turn');
    } catch (err) {
      assert.include(err.toString(), 'NotYourTurn');
    }
  });

  it('Resign Game', async () => {
    await program.methods
      .resignGame()
      .accounts({
        chessMatch: chessMatchPda,
        player: whitePlayer.publicKey,
      })
      .signers([whitePlayer])
      .rpc();

    const chessMatch = await program.account.chessMatch.fetch(chessMatchPda);
    assert.ok('blackWin' in chessMatch.gameStatus);
  });

  it('Fail Claim Timeout Win - Game Not Active', async () => {
    try {
      await program.methods
        .claimTimeoutWin()
        .accounts({
          chessMatch: chessMatchPda,
          player: blackPlayer.publicKey,
          matchTokenAccount: matchTokenAccountPda,
          playerTokenAccount: blackTokenAccount,
          platformTokenAccount: platformFeeTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([blackPlayer])
        .rpc();
      assert.fail('Should have failed when game is not active');
    } catch (err) {
      assert.include(err.toString(), 'GameNotActive');
    }
  });
});
