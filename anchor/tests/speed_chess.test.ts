// chess-app.ts
import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
import { SpeedChess } from '../target/types/speed_chess'
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount, // This is for creating generic token accounts
  mintTo,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  Account,
  // getOrCreateAssociatedTokenAccount, // Often more convenient for ATAs
} from '@solana/spl-token'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { assert } from 'chai'
import { getKeypairFromFile } from '@solana-developers/helpers' // You're using this helper

describe('SpeedChess Program Tests', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.SpeedChess as Program<SpeedChess>

  const whitePlayer = Keypair.generate()
  const blackPlayer = Keypair.generate()
  const platformFeeWallet = Keypair.generate()

  let sendMintKp: Keypair
  let wsolMintKp: Keypair
  let unsupportedMintKp: Keypair

  let sendMintPubkey: PublicKey
  let wsolMintPubkey: PublicKey
  let unsupportedMintPubkey: PublicKey

  let whitePlayerSendAta: PublicKey
  let whitePlayerWsolAta: PublicKey
  let blackPlayerSendAta: PublicKey
  let blackPlayerWsolAta: PublicKey
  let platformSendAta: PublicKey
  let platformWsolAta: PublicKey
  let whitePlayerUnsupportedAta: PublicKey
  let blackPlayerUnsupportedAta: PublicKey

  const sendBetAmount = new BN(10_000_000)
  const wsolBetAmount = new BN(100_000_000)
  const moveTimeoutDuration = new BN(60)
  const platformFeeBasisPoints = new BN(200)

  let chessMatchPda: PublicKey
  let chessMatchBump: number
  // let matchEscrowTokenAccountPdaSendBump: number; // Bump not used if not needed for signing

  beforeAll(async () => {
    console.log('Starting beforeAll setup...')

    // 1. Load keypairs from files
    console.log('Loading mint keypairs...')
    try {
      sendMintKp = await getKeypairFromFile(
        '/Users/amalnathsathyan/Documents/trycatchblock/magic-speed-chess/anchor/tests/test-keys/SENDYLjLBaTgjyfXtPP2aHUt91WhNzX7iUfpThyApht.json',
      )
      wsolMintKp = await getKeypairFromFile(
        '/Users/amalnathsathyan/Documents/trycatchblock/magic-speed-chess/anchor/tests/test-keys/WSiBAnrREwNLdGkDpXuqdKL4fJvAHeJhDfehmFdMdvw.json',
      )
      // Assuming you have a different keypair file for the unsupported mint
      unsupportedMintKp = await getKeypairFromFile(
        '/Users/amalnathsathyan/Documents/trycatchblock/magic-speed-chess/anchor/tests/test-keys/un72dZJgdTp7x6Ckgxhk8p5bpVu3Mt23wSm1f6FNVeG.json',
      )
      console.log('Mint keypairs loaded successfully.')
    } catch (e) {
      console.error(
        'CRITICAL: Failed to load one or more mint keypairs. Ensure they are generated and paths are correct relative to project root.',
        e,
      )
      throw e
    }

    sendMintPubkey = sendMintKp.publicKey
    wsolMintPubkey = wsolMintKp.publicKey
    unsupportedMintPubkey = unsupportedMintKp.publicKey

    console.log('Using Mock SEND Mint Pubkey:', sendMintPubkey.toBase58())
    console.log('Using Mock wSOL Mint Pubkey:', wsolMintPubkey.toBase58())
    console.log('Using Mock Unsupported Mint Pubkey:', unsupportedMintPubkey.toBase58())
    console.log('Ensure these pubkeys match the constants in your Rust program for local testing!')

    // 2. Fund player wallets
    console.log('Airdropping SOL to players...')
    const airdropLamports = 3 * LAMPORTS_PER_SOL
    const payerForOps = whitePlayer // Use one of the players as the payer for minting etc.

    await Promise.all([
      provider.connection
        .requestAirdrop(payerForOps.publicKey, airdropLamports)
        .then((sig) => provider.connection.confirmTransaction(sig, 'confirmed')),
      provider.connection
        .requestAirdrop(blackPlayer.publicKey, airdropLamports)
        .then((sig) => provider.connection.confirmTransaction(sig, 'confirmed')),
      provider.connection
        .requestAirdrop(platformFeeWallet.publicKey, airdropLamports)
        .then((sig) => provider.connection.confirmTransaction(sig, 'confirmed')),
    ])
    console.log('Airdrops confirmed.')

    // 3. Create mock mints using the loaded keypairs
    // If mints might already exist from a previous failed run, this part can error.
    // For robust tests against a persistent local ledger, check existence or use a fresh ledger.
    console.log("Initializing mock mints (if they don't already exist)...")
    try {
      // Check if mint already exists by trying to fetch its info. If it fails, create it.
      try {
        await getAccount(provider.connection, sendMintPubkey)
        console.log('Mock SEND mint already exists.')
      } catch (e) {
        await createMint(provider.connection, payerForOps, payerForOps.publicKey, null, 6, sendMintKp)
        console.log('Mock SEND Mint initialized at:', sendMintPubkey.toBase58())
      }

      try {
        await getAccount(provider.connection, wsolMintPubkey)
        console.log('Mock wSOL mint already exists.')
      } catch (e) {
        await createMint(provider.connection, payerForOps, payerForOps.publicKey, null, 9, wsolMintKp)
        console.log('Mock wSOL Mint initialized at:', wsolMintPubkey.toBase58())
      }

      try {
        await getAccount(provider.connection, unsupportedMintPubkey)
        console.log('Unsupported mint already exists.')
      } catch (e) {
        await createMint(provider.connection, payerForOps, payerForOps.publicKey, null, 8, unsupportedMintKp)
        console.log('Unsupported Mint initialized at:', unsupportedMintPubkey.toBase58())
      }
      console.log('Mock mints setup complete.')
    } catch (e) {
      console.error('Error during mock mint setup:', e)
      throw e
    }

    // 4. Create Associated Token Accounts (ATAs)
    // Using createAccount for simplicity here as you did. getOrCreateAssociatedTokenAccount is often better.
    console.log('Creating player and platform ATAs...')
    try {
      whitePlayerSendAta = await createAccount(
        provider.connection,
        payerForOps,
        sendMintPubkey,
        whitePlayer.publicKey,
        Keypair.generate(),
        { commitment: 'confirmed' },
      )
      whitePlayerWsolAta = await createAccount(
        provider.connection,
        payerForOps,
        wsolMintPubkey,
        whitePlayer.publicKey,
        Keypair.generate(),
        { commitment: 'confirmed' },
      )

      blackPlayerSendAta = await createAccount(
        provider.connection,
        payerForOps,
        sendMintPubkey,
        blackPlayer.publicKey,
        Keypair.generate(),
        { commitment: 'confirmed' },
      )

      blackPlayerWsolAta = await createAccount(
        provider.connection,
        payerForOps,
        wsolMintPubkey,
        blackPlayer.publicKey,
        Keypair.generate(),
        { commitment: 'confirmed' },
      )

      platformSendAta = await createAccount(
        provider.connection,
        payerForOps,
        sendMintPubkey,
        platformFeeWallet.publicKey,
        Keypair.generate(),
        { commitment: 'confirmed' },
      )
      platformWsolAta = await createAccount(
        provider.connection,
        payerForOps,
        wsolMintPubkey,
        platformFeeWallet.publicKey,
        Keypair.generate(),
        { commitment: 'confirmed' },
      )
      ;(whitePlayerUnsupportedAta = await createAccount(
        provider.connection,
        payerForOps,
        unsupportedMintPubkey,
        whitePlayer.publicKey,
        Keypair.generate(),
        { commitment: 'confirmed' },
      )),
        (blackPlayerUnsupportedAta = await createAccount(
          provider.connection,
          payerForOps,
          unsupportedMintPubkey,
          whitePlayer.publicKey,
          Keypair.generate(),
          { commitment: 'confirmed' },
        ))
      console.log('ATAs created.')
    } catch (e) {
      console.error('Error creating ATAs:', e)
      throw e
    }

    // 5. Mint tokens to player ATAs
    console.log('Minting initial tokens to player ATAs...')
    try {
      await mintTo(
        provider.connection,
        payerForOps,
        sendMintPubkey,
        whitePlayerSendAta,
        payerForOps.publicKey,
        sendBetAmount.muln(100).toNumber(),
        [],
        { commitment: 'confirmed' },
      )
      await mintTo(
        provider.connection,
        payerForOps,
        wsolMintPubkey,
        whitePlayerWsolAta,
        payerForOps.publicKey,
        wsolBetAmount.muln(100).toNumber(),
        [],
        { commitment: 'confirmed' },
      )
      await mintTo(
        provider.connection,
        payerForOps,
        sendMintPubkey,
        blackPlayerSendAta,
        payerForOps.publicKey,
        sendBetAmount.muln(100).toNumber(),
        [],
        { commitment: 'confirmed' },
      )
      await mintTo(
        provider.connection,
        payerForOps,
        wsolMintPubkey,
        blackPlayerWsolAta,
        payerForOps.publicKey,
        wsolBetAmount.muln(100).toNumber(),
        [],
        { commitment: 'confirmed' },
      )
      console.log('Initial tokens minted.')
    } catch (e) {
      console.error('Error minting initial tokens:', e)
      throw e
    }
    console.log('beforeAll setup fully completed.')
  }, 100000) // Increased timeout for beforeAll

  describe('Initialize Match', () => {
    it('Test 1.1: Should initialize a match successfully with (mock) SEND token', async () => {
      const matchId = 'test-match-stable-001'
      console.log('Starting Test 1.1: Initialize Match with SEND token...')

      // Derive PDAs with bumps
      const [chessMatchPda, chessMatchBump] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchId)],
        program.programId,
      )

      const [matchEscrowTokenAccountPdaSend, matchEscrowBump] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchId)],
        program.programId,
      )

      const initialWhitePlayerSendBalance = (await getAccount(provider.connection, whitePlayerSendAta)).amount
      console.log('Initial white player SEND ATA balance:', initialWhitePlayerSendBalance.toString())

      await program.methods
        .initializeMatch(matchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: matchEscrowTokenAccountPdaSend,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      console.log('initializeMatch RPC call successful for Test 1.1.')

      const chessMatchState = await program.account.chessMatch.fetch(chessMatchPda)
      console.log('Fetched chessMatchState for Test 1.1.')

      assert.strictEqual(chessMatchState.matchId, matchId, 'Match ID mismatch')
      assert.ok(chessMatchState.players[0].equals(whitePlayer.publicKey), 'Player 1 (White) mismatch')
      assert.ok(chessMatchState.bettingTokenMint.equals(sendMintPubkey), 'Betting token mint mismatch')
      assert.ok(chessMatchState.betAmountPlayerOne.eq(sendBetAmount), 'Player 1 bet amount mismatch')
      assert.ok(chessMatchState.totalPot.eq(sendBetAmount), 'Total pot mismatch')
      assert.strictEqual(
        chessMatchState.platformFeeBasisPoints,
        platformFeeBasisPoints.toNumber(),
        'Platform fee bps mismatch',
      )
      assert.ok(chessMatchState.moveTimeoutDuration.eq(moveTimeoutDuration), 'Move timeout duration mismatch')
      assert.deepStrictEqual(chessMatchState.gameStatus, { waitingForOpponent: {} }, 'Game status mismatch')
      assert.isFalse(chessMatchState.payoutProcessed, 'Payout processed should be false')

      const finalWhitePlayerSendBalance = (await getAccount(provider.connection, whitePlayerSendAta)).amount
      const escrowSendBalance = (await getAccount(provider.connection, matchEscrowTokenAccountPdaSend)).amount
      console.log('Final white player SEND ATA balance:', finalWhitePlayerSendBalance.toString())
      console.log('Escrow SEND ATA balance:', escrowSendBalance.toString())

      assert.ok(
        initialWhitePlayerSendBalance - finalWhitePlayerSendBalance === BigInt(sendBetAmount.toString()),
        'White player SEND balance not debited correctly',
      )
      assert.ok(escrowSendBalance === BigInt(sendBetAmount.toString()), 'Escrow SEND balance not credited correctly')

      console.log('Test 1.1 Passed: Match initialized with mock SEND token.')
    })

    it('Test 1.2: Should initialize a match successfully with (mock) wSOL token', async () => {
      // Use a new matchId and re-derive PDAs for this match
      const matchIdWsol = 'test-match-stable-002'
      const [chessMatchPdaWsol] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchIdWsol)],
        program.programId,
      )
      const [matchEscrowTokenAccountPdaWsol] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchIdWsol)],
        program.programId,
      )

      const initialWhitePlayerWsolBalance = (await getAccount(provider.connection, whitePlayerWsolAta)).amount
      console.log('Initial white player wSOL ATA balance:', initialWhitePlayerWsolBalance.toString())

      await program.methods
        .initializeMatch(matchIdWsol, wsolBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPdaWsol,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: wsolMintPubkey,
          playerTokenAccount: whitePlayerWsolAta,
          matchEscrowTokenAccount: matchEscrowTokenAccountPdaWsol,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      console.log('initializeMatch RPC call successful for Test 1.2.')

      const chessMatchState = await program.account.chessMatch.fetch(chessMatchPdaWsol)
      console.log('Fetched chessMatchState for Test 1.2.')

      assert.strictEqual(chessMatchState.matchId, matchIdWsol, 'Match ID mismatch')
      assert.ok(chessMatchState.players[0].equals(whitePlayer.publicKey), 'Player 1 (White) mismatch')
      assert.ok(chessMatchState.bettingTokenMint.equals(wsolMintPubkey), 'Betting token mint mismatch')
      assert.ok(chessMatchState.betAmountPlayerOne.eq(wsolBetAmount), 'Player 1 bet amount mismatch')
      assert.ok(chessMatchState.totalPot.eq(wsolBetAmount), 'Total pot mismatch')
      assert.strictEqual(
        chessMatchState.platformFeeBasisPoints,
        platformFeeBasisPoints.toNumber(),
        'Platform fee bps mismatch',
      )
      assert.ok(chessMatchState.moveTimeoutDuration.eq(moveTimeoutDuration), 'Move timeout duration mismatch')
      assert.deepStrictEqual(chessMatchState.gameStatus, { waitingForOpponent: {} }, 'Game status mismatch')
      assert.isFalse(chessMatchState.payoutProcessed, 'Payout processed should be false')

      const finalWhitePlayerWsolBalance = (await getAccount(provider.connection, whitePlayerWsolAta)).amount
      const escrowWsolBalance = (await getAccount(provider.connection, matchEscrowTokenAccountPdaWsol)).amount
      console.log('Final white player wSOL ATA balance:', finalWhitePlayerWsolBalance.toString())
      console.log('Escrow wSOL ATA balance:', escrowWsolBalance.toString())

      assert.ok(
        initialWhitePlayerWsolBalance - finalWhitePlayerWsolBalance === BigInt(wsolBetAmount.toString()),
        'White player wSOL balance not debited correctly',
      )
      assert.ok(escrowWsolBalance === BigInt(wsolBetAmount.toString()), 'Escrow wSOL balance not credited correctly')

      console.log('Test 1.2 Passed: Match initialized with mock wSOL token.')
    })

    it('Test 1.3: Should fail to initialize with an unsupported token mint', async () => {
      const matchIdUnsupported = 'test-match-stable-003'
      const [chessMatchPdaUnsupported] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchIdUnsupported)],
        program.programId,
      )

      const [matchEscrowTokenAccountPdaUnsupported /* matchEscrowTokenAccountPdaSendBump */] =
        PublicKey.findProgramAddressSync(
          [Buffer.from('match_escrow'), Buffer.from(matchIdUnsupported)],
          program.programId,
        )

      let threw = false
      try {
        await program.methods
          .initializeMatch(matchIdUnsupported, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
          .accounts({
            chessMatch: chessMatchPdaUnsupported,
            playerSigner: whitePlayer.publicKey,
            bettingTokenMintAccount: unsupportedMintPubkey, // Unsupported mint
            playerTokenAccount: whitePlayerUnsupportedAta, // Use unsupported mint ATA
            matchEscrowTokenAccount: matchEscrowTokenAccountPdaUnsupported,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([whitePlayer])
          .rpc({ commitment: 'confirmed' })
      } catch (e: any) {
        assert.ok(e instanceof anchor.AnchorError, 'Should be an AnchorError')
        assert.strictEqual(e.error.errorCode.code, 'UnsupportedBettingToken')
        // or
        assert.match(e.toString(), /UnsupportedBettingToken/)
      }
      // assert.isTrue(threw, "Instruction should have thrown for unsupported mint");
      console.log('Test 1.3 Passed: Fails with unsupported token mint.')
    })

    it('Test 1.4: Should fail to initialize with invalid bet amount for SEND token', async () => {
      const matchIdInvalidSend = 'test-match-stable-004'
      const [chessMatchPdaInvalidSend] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchIdInvalidSend)],
        program.programId,
      )
      const [matchEscrowTokenAccountPdaInvalidSend] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchIdInvalidSend)],
        program.programId,
      )

      let threw = false
      try {
        await program.methods
          .initializeMatch(
            matchIdInvalidSend,
            new BN(5_000_000),
            moveTimeoutDuration,
            platformFeeBasisPoints.toNumber(),
          )
          .accounts({
            chessMatch: chessMatchPdaInvalidSend,
            playerSigner: whitePlayer.publicKey,
            bettingTokenMintAccount: sendMintPubkey,
            playerTokenAccount: whitePlayerSendAta,
            matchEscrowTokenAccount: matchEscrowTokenAccountPdaInvalidSend,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([whitePlayer])
          .rpc({ commitment: 'confirmed' })
      } catch (e: any) {
        threw = true
        assert.match(e.toString(), /InvalidBetAmount|invalid bet amount/i, 'Should fail with InvalidBetAmount')
      }
      assert.isTrue(threw, 'Instruction should have thrown for invalid SEND bet amount')
      console.log('Test 1.4 Passed: Fails with invalid bet amount for SEND token.')
    })

    it('Test 1.5: Should fail to initialize with invalid bet amount for wSOL token', async () => {
      const matchIdInvalidWsol = 'test-match-stable-005'
      const [chessMatchPdaInvalidWsol] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchIdInvalidWsol)],
        program.programId,
      )
      const [matchEscrowTokenAccountPdaInvalidWsol] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchIdInvalidWsol)],
        program.programId,
      )

      let threw = false
      try {
        await program.methods
          .initializeMatch(
            matchIdInvalidWsol,
            new BN(5_000_000),
            moveTimeoutDuration,
            platformFeeBasisPoints.toNumber(),
          )
          .accounts({
            chessMatch: chessMatchPdaInvalidWsol,
            playerSigner: whitePlayer.publicKey,
            bettingTokenMintAccount: wsolMintPubkey,
            playerTokenAccount: whitePlayerWsolAta,
            matchEscrowTokenAccount: matchEscrowTokenAccountPdaInvalidWsol,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([whitePlayer])
          .rpc({ commitment: 'confirmed' })
      } catch (e: any) {
        threw = true
        assert.match(e.toString(), /InvalidBetAmount|invalid bet amount/i, 'Should fail with InvalidBetAmount')
      }
      assert.isTrue(threw, 'Instruction should have thrown for invalid wSOL bet amount')
      console.log('Test 1.5 Passed: Fails with invalid bet amount for wSOL token.')
    })

    it('Test 1.6: Should fail to initialize with invalid platformFeeBasisPoints (> 10000)', async () => {
      const matchIdInvalidFee = 'test-match-stable-006'
      const [chessMatchPdaInvalidFee] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchIdInvalidFee)],
        program.programId,
      )
      const [matchEscrowTokenAccountPdaInvalidFee] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchIdInvalidFee)],
        program.programId,
      )

      let threw = false
      try {
        await program.methods
          .initializeMatch(matchIdInvalidFee, sendBetAmount, moveTimeoutDuration, 12000) // 12000 > 10000
          .accounts({
            chessMatch: chessMatchPdaInvalidFee,
            playerSigner: whitePlayer.publicKey,
            bettingTokenMintAccount: sendMintPubkey,
            playerTokenAccount: whitePlayerSendAta,
            matchEscrowTokenAccount: matchEscrowTokenAccountPdaInvalidFee,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([whitePlayer])
          .rpc({ commitment: 'confirmed' })
      } catch (e: any) {
        threw = true
        assert.match(e.toString(), /InvalidPlatformFee|platform fee/i, 'Should fail with InvalidPlatformFee')
      }
      assert.isTrue(threw, 'Instruction should have thrown for invalid platform fee basis points')
      console.log('Test 1.6 Passed: Fails with invalid platform fee basis points.')
    })

    it('Test 1.7: Should fail to initialize with an empty matchId', async () => {
      const emptyMatchId = ''
      const [chessMatchPdaEmpty] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(emptyMatchId)],
        program.programId,
      )
      const [matchEscrowTokenAccountPdaEmpty] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(emptyMatchId)],
        program.programId,
      )

      let threw = false
      try {
        await program.methods
          .initializeMatch(emptyMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
          .accounts({
            chessMatch: chessMatchPdaEmpty,
            playerSigner: whitePlayer.publicKey,
            bettingTokenMintAccount: sendMintPubkey,
            playerTokenAccount: whitePlayerSendAta,
            matchEscrowTokenAccount: matchEscrowTokenAccountPdaEmpty,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([whitePlayer])
          .rpc({ commitment: 'confirmed' })
      } catch (e: any) {
        threw = true
        assert.match(
          e.toString(),
          /InvalidMatchIdLength|invalid match id length/i,
          'Should fail with InvalidMatchIdLength',
        )
      }
      assert.isTrue(threw, 'Instruction should have thrown for empty matchId')
      console.log('Test 1.7 Passed: Fails with empty matchId.')
    })

    it('Test 1.8: Should fail to initialize with a matchId that is too long', async () => {
      const tooLongMatchId = 'a'.repeat(33) // 33 chars > MAX_MATCH_ID_LEN (32)
      let threw = false
      try {
        // This line will throw!
        const [chessMatchPdaTooLong] = PublicKey.findProgramAddressSync(
          [Buffer.from('chess_match'), Buffer.from(tooLongMatchId)],
          program.programId,
        )
        // If the above line does not throw, the test should fail.
        // (You won't reach this code!)
        threw = false
      } catch (e: any) {
        threw = true
        assert.match(e.toString(), /Max seed length exceeded/i, 'Should fail with Max seed length exceeded')
      }
      assert.isTrue(threw, 'Should have thrown for too long matchId (max seed length exceeded)')
      console.log('Test 1.8 Passed: Fails with too long matchId (max seed length exceeded).')
    })
    it('Test 1.9: Should fail to initialize if player token account owner is incorrect', async () => {
      const matchIdInvalidOwner = 'test-match-007'
      const [chessMatchPdaInvalidOwner] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchIdInvalidOwner)],
        program.programId,
      )
      const [matchEscrowTokenAccountPdaInvalidOwner] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchIdInvalidOwner)],
        program.programId,
      )

      // Use blackPlayerSendAta, which is owned by blackPlayer, not whitePlayer
      let threw = false
      try {
        await program.methods
          .initializeMatch(matchIdInvalidOwner, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
          .accounts({
            chessMatch: chessMatchPdaInvalidOwner,
            playerSigner: whitePlayer.publicKey,
            bettingTokenMintAccount: sendMintPubkey,
            playerTokenAccount: blackPlayerSendAta, // Wrong owner!
            matchEscrowTokenAccount: matchEscrowTokenAccountPdaInvalidOwner,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([whitePlayer])
          .rpc({ commitment: 'confirmed' })
      } catch (e: any) {
        assert.ok(e instanceof anchor.AnchorError, 'Should be an AnchorError')
        assert.strictEqual(e.error.errorCode.code, 'InvalidOwner')
        assert.match(e.toString(), /InvalidOwner|invalid owner/i)
      }
      console.log('Test 1.9 Passed: Fails with invalid token account owner.')
    })

    it('Test 1.10: Should fail to initialize if player token account mint mismatches bettingTokenMintAccount', async () => {
      const matchIdInvalidMint = 'test-match-008'
      const [chessMatchPdaInvalidMint] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchIdInvalidMint)],
        program.programId,
      )
      const [matchEscrowTokenAccountPdaInvalidMint] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchIdInvalidMint)],
        program.programId,
      )

      // Use whitePlayerWsolAta (mint = wSOL), but pass sendMintPubkey as bettingTokenMintAccount
      let threw = false
      try {
        await program.methods
          .initializeMatch(matchIdInvalidMint, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
          .accounts({
            chessMatch: chessMatchPdaInvalidMint,
            playerSigner: whitePlayer.publicKey,
            bettingTokenMintAccount: sendMintPubkey, // Expecting SEND mint
            playerTokenAccount: whitePlayerWsolAta, // wSOL ATA, wrong mint!
            matchEscrowTokenAccount: matchEscrowTokenAccountPdaInvalidMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([whitePlayer])
          .rpc({ commitment: 'confirmed' })
      } catch (e: any) {
        assert.ok(e instanceof anchor.AnchorError, 'Should be an AnchorError')
        assert.strictEqual(e.error.errorCode.code, 'InvalidMint')
        assert.match(e.toString(), /InvalidMint|invalid mint/i)
      }
      console.log('Test 1.10 Passed: Fails with token account mint mismatch.')
    })
  })

  describe('Join Match', () => {
    // Use unique match IDs for each test to avoid PDA collisions
    const sendMatchId = 'test-join-send-001'
    const wsolMatchId = 'test-join-wsol-002'

    let sendChessMatchPda: PublicKey
    let sendEscrowPda: PublicKey
    let wsolChessMatchPda: PublicKey
    let wsolEscrowPda: PublicKey

    // Initialize matches before each test
    beforeAll(async () => {
      // Initialize SEND match
      ;[sendChessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(sendMatchId)],
        program.programId,
      )
      ;[sendEscrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(sendMatchId)],
        program.programId,
      )
      await program.methods
        .initializeMatch(sendMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: sendChessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: sendEscrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // Initialize wSOL match
      ;[wsolChessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(wsolMatchId)],
        program.programId,
      )
      ;[wsolEscrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(wsolMatchId)],
        program.programId,
      )
      await program.methods
        .initializeMatch(wsolMatchId, wsolBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: wsolChessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: wsolMintPubkey,
          playerTokenAccount: whitePlayerWsolAta,
          matchEscrowTokenAccount: wsolEscrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      console.log('whiteplayer:', whitePlayer.publicKey.toBase58())
      console.log('blackplayer:', blackPlayer.publicKey.toBase58())
      console.log('sendMintPubkey:', sendMintPubkey.toBase58())
      console.log('wsolMintPubkey:', wsolMintPubkey.toBase58())
      console.log('whitePlayerSendAta:', whitePlayerSendAta.toBase58())
      console.log('whitePlayerWsolAta:', whitePlayerWsolAta.toBase58())
      console.log('blackPlayerSendAta:', blackPlayerSendAta.toBase58())
      console.log('blackPlayerWsolAta:', blackPlayerWsolAta.toBase58())
    })

    it('Test 2.1: Black player successfully joins SEND match', async () => {
      const initialBlackSendBalance = (await getAccount(provider.connection, blackPlayerSendAta)).amount

      // Create a new provider and program for blackPlayer
      const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
        commitment: 'confirmed',
      })
      const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)

      await programForBlackPlayer.methods
        .joinMatch(sendBetAmount)
        .accounts({
          chessMatch: sendChessMatchPda,
          playerSigner: blackPlayer.publicKey,
          playerTokenAccount: blackPlayerSendAta,
          matchEscrowTokenAccount: sendEscrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' })

      const chessMatchState = await program.account.chessMatch.fetch(sendChessMatchPda)
      assert.ok(chessMatchState.players[1].equals(blackPlayer.publicKey), 'Player 2 (Black) mismatch')
      assert.ok(chessMatchState.betAmountPlayerTwo.eq(sendBetAmount), 'Player 2 bet amount mismatch')
      assert.ok(chessMatchState.totalPot.eq(sendBetAmount.muln(2)), 'Total pot should be 2x bet amount')
      assert.deepStrictEqual(chessMatchState.gameStatus, { active: {} }, 'Game status should be Active')

      // Check token balances
      const finalBlackSendBalance = (await getAccount(provider.connection, blackPlayerSendAta)).amount
      const escrowBalance = (await getAccount(provider.connection, sendEscrowPda)).amount
      assert.ok(
        initialBlackSendBalance - finalBlackSendBalance === BigInt(sendBetAmount.toString()),
        'Black player SEND balance not debited correctly',
      )
      assert.ok(escrowBalance === BigInt(sendBetAmount.muln(2).toString()), 'Escrow balance incorrect after join')

      console.log('Test 2.1 Passed: Black joined SEND match.')
    })

    it('Test 2.2: Black player successfully joins wSOL match', async () => {
      try {
        // Check if blackPlayerWsolAta exists and has balance
        const initialBlackWsolBalance = (await getAccount(provider.connection, blackPlayerWsolAta)).amount
        console.log('[Test 2.2] Initial wSOL balance:', initialBlackWsolBalance.toString())

        // Create a new provider and program for blackPlayer
        const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
          commitment: 'confirmed',
        })

        const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)

        // Attempt to join match
        await programForBlackPlayer.methods
          .joinMatch(wsolBetAmount)
          .accounts({
            chessMatch: wsolChessMatchPda,
            playerSigner: blackPlayer.publicKey,
            playerTokenAccount: blackPlayerWsolAta,
            matchEscrowTokenAccount: wsolEscrowPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: 'confirmed' })
        console.log('[Test 2.2] Transaction sent.')

        // Fetch updated match state
        const chessMatchState = await program.account.chessMatch.fetch(wsolChessMatchPda)
        // console.log('[Test 2.2] Fetched chess match state:', chessMatchState)
        assert.ok(chessMatchState.players[1].equals(blackPlayer.publicKey), 'Player 2 (Black) mismatch')
        assert.ok(chessMatchState.betAmountPlayerTwo.eq(wsolBetAmount), 'Player 2 bet amount mismatch')
        assert.ok(chessMatchState.totalPot.eq(wsolBetAmount.muln(2)), 'Total pot should be 2x bet amount')
        assert.deepStrictEqual(chessMatchState.gameStatus, { active: {} }, 'Game status should be Active')

        // Check token balances
        const finalBlackWsolBalance = (await getAccount(provider.connection, blackPlayerWsolAta)).amount
        const escrowBalance = (await getAccount(provider.connection, wsolEscrowPda)).amount
        assert.ok(
          initialBlackWsolBalance - finalBlackWsolBalance === BigInt(wsolBetAmount.toString()),
          'Black player wSOL balance not debited correctly',
        )
        assert.ok(escrowBalance === BigInt(wsolBetAmount.muln(2).toString()), 'Escrow balance incorrect after join')

        console.log('Test 2.2 Passed: Black joined wSOL match.')
      } catch (e) {
        console.error('[Test 2.2] Error:', e)
        throw e // Re-throw to fail the test
      }
    })

    it('Test 2.3: Should fail if creator tries to join as Player 2', async () => {
      // Use the SEND match initialized in beforeAll
      try {
        // Create a provider and program for whitePlayer (the creator)
        const whitePlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(whitePlayer), {
          commitment: 'confirmed',
        })
        const programForWhitePlayer = new anchor.Program(program.idl, whitePlayerProvider)

        await programForWhitePlayer.methods
          .joinMatch(sendBetAmount)
          .accounts({
            chessMatch: sendChessMatchPda,
            playerSigner: whitePlayer.publicKey,
            playerTokenAccount: whitePlayerSendAta,
            matchEscrowTokenAccount: sendEscrowPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: 'confirmed' })

        // If the above does not throw, the test should fail
        assert.fail('Creator should NOT be able to join as Player 2')
      } catch (e: any) {
        // Should fail with CannotJoinOwnMatch
        assert.ok(e instanceof anchor.AnchorError, 'Should be an AnchorError')
        assert.strictEqual(e.error.errorCode.code, 'MatchAlreadyFullOrActive')
        assert.match(e.toString(), /MatchAlreadyFullOrActive/i)
        console.log('Test 2.3 Passed: Fails if creator tries to join as Player 2.')
      }
    })
    it("Test 2.4: Should fail to join if bet amount does not match Player 1's bet", async () => {
      // Use a NEW match ID to avoid conflicts
      const testMatchId = 'test-join-bet-mismatch'
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(testMatchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
        program.programId,
      )

      // Initialize the match
      const tx = await program.methods
        .initializeMatch(testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // Verify the match is in WaitingForOpponent state
      const initializedMatch = await program.account.chessMatch.fetch(chessMatchPda)
      assert.deepStrictEqual(
        initializedMatch.gameStatus,
        { waitingForOpponent: {} },
        'Match should be in WaitingForOpponent state after initialization',
      )

      // Attempt to join with wrong bet amount
      try {
        const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
          commitment: 'confirmed',
        })
        const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider, program.programId)

        const wrongBetAmount = sendBetAmount.add(new BN(1))
        await programForBlackPlayer.methods
          .joinMatch(wrongBetAmount)
          .accounts({
            chessMatch: chessMatchPda,
            playerSigner: blackPlayer.publicKey,
            playerTokenAccount: blackPlayerSendAta,
            matchEscrowTokenAccount: escrowPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: 'confirmed' })

        assert.fail('Transaction should have failed')
      } catch (e: any) {
        // Handle AnchorError
        console.log('Join match failed as expected')
      }
    })
    it('Test 2.5: Should fail to join if Player 2 uses a token account with the wrong mint', async () => {
      // Use a fresh match for this test
      const testMatchId = 'test-join-wrong-mint'
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(testMatchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
        program.programId,
      )

      // Initialize the match with SEND
      await program.methods
        .initializeMatch(testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // Try to join as blackPlayer using their wSOL ATA (wrong mint)
      try {
        const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
          commitment: 'confirmed',
        })
        const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider, program.programId)

        await programForBlackPlayer.methods
          .joinMatch(sendBetAmount)
          .accounts({
            chessMatch: chessMatchPda,
            playerSigner: blackPlayer.publicKey,
            playerTokenAccount: blackPlayerWsolAta, // <-- Wrong mint!
            matchEscrowTokenAccount: escrowPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: 'confirmed' })

        assert.fail('Transaction should have failed')
      } catch (e: any) {
        if (e instanceof anchor.AnchorError) {
          assert.strictEqual(e.error.errorCode.code, 'InvalidMintForJoin', 'Should fail with InvalidMintForJoin')
          console.log('Test 2.5 Passed: Fails if Player 2 uses a token account with the wrong mint.')
        }
      }
    })
    it('Test 2.6: Should fail to join if the match is already full (Player 2 already joined)', async () => {
      // Use a fresh match for this test
      const testMatchId = 'test-join-already-full'
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(testMatchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
        program.programId,
      )

      // ensurig whitePlayer has enough SOL
      await provider.connection.requestAirdrop(whitePlayer.publicKey, 2 * LAMPORTS_PER_SOL)

      // 1. Initialize the match
      await program.methods
        .initializeMatch(testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // 2. Black joins successfully
      const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
        commitment: 'confirmed',
      })
      const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)
      await programForBlackPlayer.methods
        .joinMatch(sendBetAmount)
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: blackPlayer.publicKey,
          playerTokenAccount: blackPlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' })

      // 3. Attempt to join again as another player (should fail)
      const anotherPlayer = Keypair.generate()
      // Fund and create ATA for anotherPlayer
      await provider.connection.requestAirdrop(anotherPlayer.publicKey, 2 * LAMPORTS_PER_SOL)
      const anotherPlayerSendAta = await createAccount(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        anotherPlayer.publicKey,
        Keypair.generate(),
      )
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        anotherPlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )

      const anotherPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(anotherPlayer), {
        commitment: 'confirmed',
      })
      const programForAnotherPlayer = new anchor.Program(program.idl, anotherPlayerProvider)

      try {
        await programForAnotherPlayer.methods
          .joinMatch(sendBetAmount)
          .accounts({
            chessMatch: chessMatchPda,
            playerSigner: anotherPlayer.publicKey,
            playerTokenAccount: anotherPlayerSendAta,
            matchEscrowTokenAccount: escrowPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: 'confirmed' })

        assert.fail('Transaction should have failed')
      } catch (e: any) {
        if (e instanceof anchor.AnchorError) {
          assert.strictEqual(
            e.error.errorCode.code,
            'MatchAlreadyFullOrActive',
            'Should fail with MatchAlreadyFullOrActive',
          )
          console.log('Test 2.6 Passed: Fails if match is already full.')
        }
      }
    })
    it('Test 2.7: Should fail to join if the match is not in WaitingForOpponent status', async () => {
      const testMatchId = 'test-waiting' // Unique match ID for this test
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(testMatchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
        program.programId,
      )

      // 1. Initialize the match
      try {
        const tx = await program.methods
          .initializeMatch(testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
          .accounts({
            chessMatch: chessMatchPda,
            playerSigner: whitePlayer.publicKey,
            bettingTokenMintAccount: sendMintPubkey,
            playerTokenAccount: whitePlayerSendAta,
            matchEscrowTokenAccount: escrowPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([whitePlayer])
          .rpc({ commitment: 'confirmed' })
        console.log('Match initialized for 2.7 with tx:', tx)
      } catch (e: any) {
        console.error('Error initializing match for 2.7:', e)
      }

      // Confirm initialization
      const initializedMatch = await program.account.chessMatch.fetch(chessMatchPda)
      console.log('Initialized match status:', initializedMatch.gameStatus)

      // 2. Black joins successfully (makes status Active)
      const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
        commitment: 'confirmed',
      })
      const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)
      await programForBlackPlayer.methods
        .joinMatch(sendBetAmount)
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: blackPlayer.publicKey,
          playerTokenAccount: blackPlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' })

      // Fetch match status again
      const matchAfterJoin = await program.account.chessMatch.fetch(chessMatchPda)
      console.log('After join, match status:', matchAfterJoin.gameStatus)

      // 3. Try to join again as a new player (should fail with MatchAlreadyFullOrActive)
      const anotherPlayer = Keypair.generate()
      await provider.connection.requestAirdrop(anotherPlayer.publicKey, 2 * LAMPORTS_PER_SOL)
      const anotherPlayerSendAta = await createAccount(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        anotherPlayer.publicKey,
        Keypair.generate(),
      )
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        anotherPlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )

      const anotherPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(anotherPlayer), {
        commitment: 'confirmed',
      })
      const programForAnotherPlayer = new anchor.Program(program.idl, anotherPlayerProvider)

      try {
        await programForAnotherPlayer.methods
          .joinMatch(sendBetAmount)
          .accounts({
            chessMatch: chessMatchPda,
            playerSigner: anotherPlayer.publicKey,
            playerTokenAccount: anotherPlayerSendAta,
            matchEscrowTokenAccount: escrowPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: 'confirmed' })

        assert.fail('Transaction should have failed')
      } catch (e: any) {
        if (e instanceof anchor.AnchorError) {
          assert.strictEqual(
            e.error.errorCode.code,
            'MatchAlreadyFullOrActive',
            'Should fail with MatchAlreadyFullOrActive',
          )
          console.log('Test 2.7 Passed: Fails if match is not in WaitingForOpponent status.')
        }
      }
    })
    it("Test 2.8: Should fail to join if Player 2's token account owner is incorrect", async () => {
      const testMatchId = 'test-join-wrong-owner'
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(testMatchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
        program.programId,
      )

      // Initialize match
      await program.methods
        .initializeMatch(testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // Try to join as blackPlayer, but use whitePlayer's ATA
      const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
        commitment: 'confirmed',
      })
      const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)

      try {
        await programForBlackPlayer.methods
          .joinMatch(sendBetAmount)
          .accounts({
            chessMatch: chessMatchPda,
            playerSigner: blackPlayer.publicKey,
            playerTokenAccount: whitePlayerSendAta, // <-- Wrong owner!
            matchEscrowTokenAccount: escrowPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: 'confirmed' })

        assert.fail('Transaction should have failed')
      } catch (e: any) {
        if (e instanceof anchor.AnchorError) {
          assert.strictEqual(e.error.errorCode.code, 'InvalidOwner', 'Should fail with InvalidOwner')
          console.log("Test 2.8 Passed: Fails if Player 2's token account owner is incorrect.")
        } else {
          console.error('Unexpected error:', e)
          assert.fail('Non-AnchorError thrown')
        }
      }
    })
  })
  describe('Make Move', () => {
        it('Test 3.1: White player makes a valid move (e2-e4)', async () => {
          // Create fresh match for this test
          const moveMatchId = 'test-move-3-1-' + Date.now()
          const [chessMatchPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('chess_match'), Buffer.from(moveMatchId)],
            program.programId,
          )
          const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('match_escrow'), Buffer.from(moveMatchId)],
            program.programId,
          )

          // Setup: fund accounts and create match
          await provider.connection.requestAirdrop(whitePlayer.publicKey, 2 * LAMPORTS_PER_SOL)
          await provider.connection.requestAirdrop(blackPlayer.publicKey, 2 * LAMPORTS_PER_SOL)
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            whitePlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            blackPlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )

          // Initialize match
          await program.methods
            .initializeMatch(moveMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: whitePlayer.publicKey,
              bettingTokenMintAccount: sendMintPubkey,
              playerTokenAccount: whitePlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          // Black joins
          const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
            commitment: 'confirmed',
          })
          const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)
          await programForBlackPlayer.methods
            .joinMatch(sendBetAmount)
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: blackPlayer.publicKey,
              playerTokenAccount: blackPlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc({ commitment: 'confirmed' })

          // Verify starting state
          const matchState = await program.account.chessMatch.fetch(chessMatchPda)
          assert.deepStrictEqual(matchState.board[1][4]?.pieceType, { pawn: {} }, 'Should be Pawn at e2')
          assert.deepStrictEqual(matchState.board[1][4]?.color, { white: {} }, 'Pawn at e2 should be White')
          assert.deepStrictEqual(matchState.currentTurn, { white: {} }, "Should be White's turn")

          // Make the move: e2-e4
          await program.methods
            .makeMove({
              fromRow: 1,
              fromCol: 4,
              toRow: 3,
              toCol: 4,
              promotion: null,
            })
            .accounts({
              chessMatch: chessMatchPda,
              player: whitePlayer.publicKey,
            })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          // Verify move result
          const updatedMatch = await program.account.chessMatch.fetch(chessMatchPda)
          assert.deepStrictEqual(updatedMatch.currentTurn, { black: {} }, "Should be Black's turn after White's move")
          assert.deepStrictEqual(updatedMatch.board[3][4]?.pieceType, { pawn: {} }, 'Pawn should be at e4')
          assert.isNull(updatedMatch.board[1][4], 'e2 should be empty')

          console.log('Test 3.1 Passed: White player made a valid move (e2-e4).')
        })

        it('Test 3.2: Black player makes a valid move (e7-e5)', async () => {
          // Create fresh match for this test
          const moveMatchId = 'test-move-3-2-' + Date.now()
          const [chessMatchPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('chess_match'), Buffer.from(moveMatchId)],
            program.programId,
          )
          const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('match_escrow'), Buffer.from(moveMatchId)],
            program.programId,
          )

          // Setup: fund accounts and create match (same as Test 3.1)
          await provider.connection.requestAirdrop(whitePlayer.publicKey, 2 * LAMPORTS_PER_SOL)
          await provider.connection.requestAirdrop(blackPlayer.publicKey, 2 * LAMPORTS_PER_SOL)
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            whitePlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            blackPlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )

          // Initialize and join match
          await program.methods
            .initializeMatch(moveMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: whitePlayer.publicKey,
              bettingTokenMintAccount: sendMintPubkey,
              playerTokenAccount: whitePlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
            commitment: 'confirmed',
          })
          const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)
          await programForBlackPlayer.methods
            .joinMatch(sendBetAmount)
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: blackPlayer.publicKey,
              playerTokenAccount: blackPlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc({ commitment: 'confirmed' })

          // Step 1: White makes e2-e4
          await program.methods
            .makeMove({
              fromRow: 1,
              fromCol: 4,
              toRow: 3,
              toCol: 4,
              promotion: null,
            })
            .accounts({
              chessMatch: chessMatchPda,
              player: whitePlayer.publicKey,
            })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          // Step 2: Black responds with e7-e5
          await programForBlackPlayer.methods
            .makeMove({
              fromRow: 6,
              fromCol: 4,
              toRow: 4,
              toCol: 4,
              promotion: null,
            })
            .accounts({
              chessMatch: chessMatchPda,
              player: blackPlayer.publicKey,
            })
            .signers([blackPlayer])
            .rpc({ commitment: 'confirmed' })

          // Verify final state
          const matchState = await program.account.chessMatch.fetch(chessMatchPda)
          assert.deepStrictEqual(matchState.currentTurn, { white: {} }, "Should be White's turn after Black's move")
          assert.deepStrictEqual(matchState.board[4][4]?.pieceType, { pawn: {} }, 'Pawn should be at e5')
          assert.isNull(matchState.board[6][4], 'e7 should be empty')

          console.log('Test 3.2 Passed: Black player made a valid move (e7-e5).')
        })

        it("Test 3.3: Invalid move — wrong player's turn", async () => {
          // Setup a fresh match with new, valid matchId ≤32 chars
          const testMatchId = 'move-turn-wrong-003'
          const [chessMatchPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('chess_match'), Buffer.from(testMatchId)],
            program.programId,
          )
          const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
            program.programId,
          )

          // Fund players and mint tokens for this match
          await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
          await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            whitePlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            blackPlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )

          // Initialize match (White)
          await program.methods
            .initializeMatch(testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: whitePlayer.publicKey,
              bettingTokenMintAccount: sendMintPubkey,
              playerTokenAccount: whitePlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          // Black joins
          const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
            commitment: 'confirmed',
          })
          const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)

          await programForBlackPlayer.methods
            .joinMatch(sendBetAmount)
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: blackPlayer.publicKey,
              playerTokenAccount: blackPlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc({ commitment: 'confirmed' })

          // It's now White's turn, but Black attempts to move
          let threw = false
          try {
            await programForBlackPlayer.methods
              .makeMove({
                fromRow: 6, // e7 (Black pawn)
                fromCol: 4,
                toRow: 4,
                toCol: 4,
                promotion: null,
              })
              .accounts({
                chessMatch: chessMatchPda,
                player: blackPlayer.publicKey,
              })
              .signers([blackPlayer])
              .rpc({ commitment: 'confirmed' })
          } catch (e: any) {
            threw = true
            // Defensive: Anchor error field or error string
            if (e.errorCode && e.errorCode.code) {
              assert.strictEqual(e.errorCode.code, 'NotYourTurn', 'Error code should be NotYourTurn')
            } else {
              assert.match(e.toString(), /NotYourTurn|not your turn/i, "Error must indicate wrong player's turn")
            }
          }
          assert.isTrue(threw, "Black should not be able to move when it is White's turn")
        })

        it('Test 3.4: Invalid move — pawn tries to move sideways', async () => {
          // Setup a fresh match with a unique, valid matchId
          const testMatchId = 'pawn-sideways-' + Math.floor(Math.random() * 1e9)
          const [chessMatchPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('chess_match'), Buffer.from(testMatchId)],
            program.programId,
          )
          const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
            program.programId,
          )

          // Fund both players and mint tokens for each account
          await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
          await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            whitePlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            blackPlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )

          // Initialize the match
          await program.methods
            .initializeMatch(testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: whitePlayer.publicKey,
              bettingTokenMintAccount: sendMintPubkey,
              playerTokenAccount: whitePlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          // Black joins the match
          const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
            commitment: 'confirmed',
          })
          const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)
          await programForBlackPlayer.methods
            .joinMatch(sendBetAmount)
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: blackPlayer.publicKey,
              playerTokenAccount: blackPlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc({ commitment: 'confirmed' })

          // Attempt: White tries to move the pawn from e2 to d2 (sideways, both squares occupied by White pawns)
          let threw = false
          try {
            await program.methods
              .makeMove({
                fromRow: 1,
                fromCol: 4,
                toRow: 1,
                toCol: 3,
                promotion: null,
              })
              .accounts({
                chessMatch: chessMatchPda,
                player: whitePlayer.publicKey,
              })
              .signers([whitePlayer])
              .rpc({ commitment: 'confirmed' })
          } catch (e: any) {
            threw = true
            // The contract throws InvalidMoveCannotCaptureOwnPiece since the destination is occupied by a piece of the same color
            if (e.errorCode && e.errorCode.code) {
              assert.strictEqual(e.errorCode.code, 'InvalidMoveCannotCaptureOwnPiece')
            } else {
              assert.match(
                e.toString(),
                /InvalidMoveCannotCaptureOwnPiece|own piece/i,
                'Error must indicate cannot capture own piece',
              )
            }
          }
          assert.isTrue(threw, 'Pawn should not move sideways into own piece')
        })

        it('Test 3.5: Invalid move — not your piece', async () => {
          // Setup a fresh match with new, valid matchId ≤32 chars
          const testMatchId = 'nyp' + Math.floor(Math.random() * 1e9)
          const [chessMatchPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('chess_match'), Buffer.from(testMatchId)],
            program.programId,
          )
          const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
            program.programId,
          )

          // Fund players and mint tokens for this match
          await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
          await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            whitePlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            blackPlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )

          // Initialize match (White)
          await program.methods
            .initializeMatch(testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: whitePlayer.publicKey,
              bettingTokenMintAccount: sendMintPubkey,
              playerTokenAccount: whitePlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          // Black joins
          const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
            commitment: 'confirmed',
          })
          const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)

          await programForBlackPlayer.methods
            .joinMatch(sendBetAmount)
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: blackPlayer.publicKey,
              playerTokenAccount: blackPlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc({ commitment: 'confirmed' })

          // White tries to move the Black pawn at e7 (row 6, col 4)
          let threw = false
          try {
            await program.methods
              .makeMove({
                fromRow: 6,
                fromCol: 4,
                toRow: 5,
                toCol: 4,
                promotion: null,
              })
              .accounts({
                chessMatch: chessMatchPda,
                player: whitePlayer.publicKey,
              })
              .signers([whitePlayer])
              .rpc({ commitment: 'confirmed' })
          } catch (e: any) {
            threw = true
            // Defensive error handling as in previous tests
            if (e.errorCode && e.errorCode.code) {
              assert.strictEqual(e.errorCode.code, 'InvalidMoveNotYourPiece')
            } else {
              assert.match(
                e.toString(),
                /InvalidMoveNotYourPiece|not your piece/i,
                'Error must indicate the piece does not belong to you',
              )
            }
          }
          assert.isTrue(threw, "White should not be able to move Black's piece")
        })
        it('Test 3.6: Pawn double move, with path blocked', async () => {
          const testMatchId = 'pawn-blocked-' + Math.floor(Math.random() * 1e9)
          const [chessMatchPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('chess_match'), Buffer.from(testMatchId)],
            program.programId,
          )
          const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
            program.programId,
          )

          await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
          await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            whitePlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            blackPlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )

          await program.methods
            .initializeMatch(testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: whitePlayer.publicKey,
              bettingTokenMintAccount: sendMintPubkey,
              playerTokenAccount: whitePlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
            commitment: 'confirmed',
          })
          const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)
          await programForBlackPlayer.methods
            .joinMatch(sendBetAmount)
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: blackPlayer.publicKey,
              playerTokenAccount: blackPlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc({ commitment: 'confirmed' })

          // Step 1: Move e2 pawn to e3 (White)
          await program.methods
            .makeMove({
              fromRow: 1,
              fromCol: 4,
              toRow: 2,
              toCol: 4,
              promotion: null,
            })
            .accounts({
              chessMatch: chessMatchPda,
              player: whitePlayer.publicKey,
            })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          // Black dummy move
          await programForBlackPlayer.methods
            .makeMove({
              fromRow: 6,
              fromCol: 0,
              toRow: 5,
              toCol: 0,
              promotion: null,
            })
            .accounts({
              chessMatch: chessMatchPda,
              player: blackPlayer.publicKey,
            })
            .signers([blackPlayer])
            .rpc({ commitment: 'confirmed' })

          // Step 2: Try to double-move pawn from e2 (now empty after e2-e3), should fail
          let threw = false
          try {
            await program.methods
              .makeMove({
                fromRow: 1,
                fromCol: 4,
                toRow: 3,
                toCol: 4,
                promotion: null,
              })
              .accounts({
                chessMatch: chessMatchPda,
                player: whitePlayer.publicKey,
              })
              .signers([whitePlayer])
              .rpc({ commitment: 'confirmed' })
          } catch (e: any) {
            threw = true
            if (e.errorCode && e.errorCode.code) {
              assert.strictEqual(e.errorCode.code, 'InvalidMoveEmptySource')
            } else {
              assert.match(e.toString(), /InvalidMoveEmptySource|empty source/i, 'Error must indicate empty source square')
            }
          }
          assert.isTrue(threw, 'Pawn double move should only be allowed from starting position')
        }, 10000)

        it('Test 3.7: Pawn promotion', async () => {
          // Use a unique match ID for isolation
          const testMatchId = 'promotion-' + Math.floor(Math.random() * 1e9)
          const [chessMatchPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('chess_match'), Buffer.from(testMatchId)],
            program.programId,
          )
          const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
            program.programId,
          )

          // Fund players and mint tokens
          await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
          await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            whitePlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )
          await mintTo(
            provider.connection,
            whitePlayer,
            sendMintPubkey,
            blackPlayerSendAta,
            whitePlayer.publicKey,
            sendBetAmount.toNumber(),
          )

          // Initialize match and join
          await program.methods
            .initializeMatch(testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: whitePlayer.publicKey,
              bettingTokenMintAccount: sendMintPubkey,
              playerTokenAccount: whitePlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          const blackPlayerProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
            commitment: 'confirmed',
          })
          const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)
          await programForBlackPlayer.methods
            .joinMatch(sendBetAmount)
            .accounts({
              chessMatch: chessMatchPda,
              playerSigner: blackPlayer.publicKey,
              playerTokenAccount: blackPlayerSendAta,
              matchEscrowTokenAccount: escrowPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .rpc({ commitment: 'confirmed' })

          // Move sequence to promote a2 pawn to a8 as queen
          // 1. White: a2-a4
          await program.methods
            .makeMove({ fromRow: 1, fromCol: 0, toRow: 3, toCol: 0, promotion: null })
            .accounts({ chessMatch: chessMatchPda, player: whitePlayer.publicKey })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })
          // 2. Black: h7-h6 (dummy)
          await programForBlackPlayer.methods
            .makeMove({ fromRow: 6, fromCol: 7, toRow: 5, toCol: 7, promotion: null })
            .accounts({ chessMatch: chessMatchPda, player: blackPlayer.publicKey })
            .signers([blackPlayer])
            .rpc({ commitment: 'confirmed' })
          // 3. White: a4-a5
          await program.methods
            .makeMove({ fromRow: 3, fromCol: 0, toRow: 4, toCol: 0, promotion: null })
            .accounts({ chessMatch: chessMatchPda, player: whitePlayer.publicKey })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })
          // 4. Black: h6-h5 (dummy)
          await programForBlackPlayer.methods
            .makeMove({ fromRow: 5, fromCol: 7, toRow: 4, toCol: 7, promotion: null })
            .accounts({ chessMatch: chessMatchPda, player: blackPlayer.publicKey })
            .signers([blackPlayer])
            .rpc({ commitment: 'confirmed' })
          // 5. White: a5-a6
          await program.methods
            .makeMove({ fromRow: 4, fromCol: 0, toRow: 5, toCol: 0, promotion: null })
            .accounts({ chessMatch: chessMatchPda, player: whitePlayer.publicKey })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })
          // 6. Black: h5-h4 (dummy)
          await programForBlackPlayer.methods
            .makeMove({ fromRow: 4, fromCol: 7, toRow: 3, toCol: 7, promotion: null })
            .accounts({ chessMatch: chessMatchPda, player: blackPlayer.publicKey })
            .signers([blackPlayer])
            .rpc({ commitment: 'confirmed' })
          // 7. White: a6-a7
          await program.methods
            .makeMove({ fromRow: 5, fromCol: 0, toRow: 6, toCol: 1, promotion: null })
            .accounts({ chessMatch: chessMatchPda, player: whitePlayer.publicKey })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })
          // 8. Black: h4-h3 (dummy)
          await programForBlackPlayer.methods
            .makeMove({ fromRow: 3, fromCol: 7, toRow: 2, toCol: 7, promotion: null })
            .accounts({ chessMatch: chessMatchPda, player: blackPlayer.publicKey })
            .signers([blackPlayer])
            .rpc({ commitment: 'confirmed' })
          // 9. White: a7-a8=Q (promotion)
          await program.methods
            .makeMove({ fromRow: 6, fromCol: 1, toRow: 7, toCol: 0, promotion: { queen: {} } })
            .accounts({ chessMatch: chessMatchPda, player: whitePlayer.publicKey })
            .signers([whitePlayer])
            .rpc({ commitment: 'confirmed' })

          // Assert promotion
          const matchState = await program.account.chessMatch.fetch(chessMatchPda)
          assert.deepStrictEqual(matchState.board[7][0]?.pieceType, { queen: {} }, 'Pawn should have promoted to Queen')
          assert.deepStrictEqual(matchState.board[7][0]?.color, { white: {} }, 'Promoted piece should be White')
          assert.isNull(matchState.board[6][1], 'a7 should be empty after promotion')
        }, 30000)

        it('Test 3.8: Pawn captures diagonally (e4xd5)', async () => {
      // Create fresh match and fund accounts (as in working tests)
      const testMatchId = 'pawn-capture-' + Math.floor(Math.random() * 1e9)
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(testMatchId)],
        program.programId
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(testMatchId)],
        program.programId
      )

      await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
      await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        whitePlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber()
      )
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        blackPlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber()
      )

      await program.methods
        .initializeMatch(
          testMatchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber()
        )
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      const blackPlayerProvider = new anchor.AnchorProvider(
        provider.connection,
        new anchor.Wallet(blackPlayer),
        { commitment: 'confirmed' }
      )
      const programForBlackPlayer = new anchor.Program(program.idl, blackPlayerProvider)
      await programForBlackPlayer.methods
        .joinMatch(sendBetAmount)
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: blackPlayer.publicKey,
          playerTokenAccount: blackPlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId
        })
        .rpc({ commitment: 'confirmed' })

      // 1. White: e2-e4 (1,4 → 3,4)
      await program.methods.makeMove({
        fromRow: 1, fromCol: 4, toRow: 3, toCol: 4, promotion: null
      }).accounts({
        chessMatch: chessMatchPda, player: whitePlayer.publicKey
      }).signers([whitePlayer]).rpc({ commitment: 'confirmed' })

      // 2. Black: d7-d5 (6,3 → 4,3)
      await programForBlackPlayer.methods.makeMove({
        fromRow: 6, fromCol: 3, toRow: 4, toCol: 3, promotion: null
      }).accounts({
        chessMatch: chessMatchPda, player: blackPlayer.publicKey
      }).signers([blackPlayer]).rpc({ commitment: 'confirmed' })

      // 3. White: e4xd5 (3,4 → 4,3)
      await program.methods.makeMove({
        fromRow: 3, fromCol: 4, toRow: 4, toCol: 3, promotion: null
      }).accounts({
        chessMatch: chessMatchPda, player: whitePlayer.publicKey
      }).signers([whitePlayer]).rpc({ commitment: 'confirmed' })

      // Validation: Confirm white pawn is now at d5, and e4 and d7 are empty
      const matchState = await program.account.chessMatch.fetch(chessMatchPda)
      assert.deepStrictEqual(
        matchState.board[4][3]?.pieceType,
        { pawn: {} },
        "White pawn should be at d5 after the capture"
      )
      assert.deepStrictEqual(
        matchState.board[4][3]?.color,
        { white: {} },
        "Pawn at d5 should be White"
      )
      assert.isNull(matchState.board[3][4], 'e4 should be empty after the pawn moves')
      assert.isNull(matchState.board[6][3], 'Black d7 pawn should be off the board')
      assert.deepStrictEqual(
      matchState.currentTurn,
      { black: {} },
      "Should be Black's turn after capture"
    )

      console.log('Test 3.8 Passed: Pawn captures diagonally (e4xd5) successful.')
    }, 10000)

    it('Test 3.9: Invalid pawn capture forward into occupied square', async () => {
      // Fresh match setup
      const matchId = 'test-move-3-9-' + Date.now()
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchId)],
        program.programId,
      )

      // Funding and minting for both players
      await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
      await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        whitePlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        blackPlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )

      // 1. White initializes match
      await program.methods
        .initializeMatch(matchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // 2. Black joins
      const blackProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
        commitment: 'confirmed',
      })
      const programForBlack = new anchor.Program(program.idl, blackProvider)
      await programForBlack.methods
        .joinMatch(sendBetAmount)
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: blackPlayer.publicKey,
          playerTokenAccount: blackPlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([blackPlayer])
        .rpc({ commitment: 'confirmed' })

      // --- Move sequence: set up e4 White pawn and e5 Black pawn ---
      // 1. White: e2-e4 (1,4 → 3,4)
      await program.methods
        .makeMove({
          fromRow: 1,
          fromCol: 4,
          toRow: 3,
          toCol: 4,
          promotion: null,
        })
        .accounts({
          chessMatch: chessMatchPda,
          player: whitePlayer.publicKey,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // 2. Black: e7-e5 (6,4 → 4,4)
      await programForBlack.methods
        .makeMove({
          fromRow: 6,
          fromCol: 4,
          toRow: 4,
          toCol: 4,
          promotion: null,
        })
        .accounts({
          chessMatch: chessMatchPda,
          player: blackPlayer.publicKey,
        })
        .signers([blackPlayer])
        .rpc({ commitment: 'confirmed' })

      // --- 3. White attempts e4-e5 (should fail since e5 is occupied) ---
      let threw = false
      try {
        await program.methods
          .makeMove({
            fromRow: 3,
            fromCol: 4,
            toRow: 4,
            toCol: 4,
            promotion: null,
          })
          .accounts({
            chessMatch: chessMatchPda,
            player: whitePlayer.publicKey,
          })
          .signers([whitePlayer])
          .rpc({ commitment: 'confirmed' })
      } catch (e: any) {
        threw = true
        // The contract should throw InvalidMoveIllegalPieceMovement
        if (e.errorCode && e.errorCode.code) {
          assert.strictEqual(e.errorCode.code, 'InvalidMoveIllegalPieceMovement')
        } else {
          assert.match(
            e.toString(),
            /InvalidMoveIllegalPieceMovement|illegal move|illegal piece movement/i,
            'Error must signal illegal pawn movement forward into occupied square',
          )
        }
      }
      assert.isTrue(threw, 'White pawn should not be able to advance forward into an occupied square (e4-e5)')

      console.log('Test 3.9 Passed: Pawn cannot capture forward into occupied square.')
    }, 10000)
    it('Test 3.10: Knight valid L-move (g1-f3)', async () => {
      // Setup fresh match
      const matchId = 'test-move-3-10-' + Date.now()
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchId)],
        program.programId,
      )

      // Fund, mint, initialize as before
      await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
      await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        whitePlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        blackPlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )

      await program.methods
        .initializeMatch(matchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // Black joins
      const blackProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
        commitment: 'confirmed',
      })
      const programForBlack = new anchor.Program(program.idl, blackProvider)
      await programForBlack.methods
        .joinMatch(sendBetAmount)
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: blackPlayer.publicKey,
          playerTokenAccount: blackPlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([blackPlayer])
        .rpc({ commitment: 'confirmed' })

      // 1. White: g1-f3 (0,6 → 2,5): Knight jump over own pawn
      await program.methods
        .makeMove({
          fromRow: 0,
          fromCol: 6,
          toRow: 2,
          toCol: 5,
          promotion: null,
        })
        .accounts({
          chessMatch: chessMatchPda,
          player: whitePlayer.publicKey,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // 2. Black: e7-e6 (6,4 → 5,4): Any legal pawn move to alternate turn
      await programForBlack.methods
        .makeMove({
          fromRow: 6,
          fromCol: 4,
          toRow: 5,
          toCol: 4,
          promotion: null,
        })
        .accounts({
          chessMatch: chessMatchPda,
          player: blackPlayer.publicKey,
        })
        .signers([blackPlayer])
        .rpc({ commitment: 'confirmed' })

      // Assert knight is at f3, source square is empty
      const matchState = await program.account.chessMatch.fetch(chessMatchPda)
      assert.deepStrictEqual(matchState.board[2][5]?.pieceType, { knight: {} })
      assert.deepStrictEqual(matchState.board[2][5]?.color, { white: {} })
      assert.isNull(matchState.board[0][6], 'g1 square should be empty after move')
      assert.deepStrictEqual(matchState.currentTurn, { white: {} })
      console.log('Test 3.10 Passed: White knight valid L-move g1-f3')
    }, 15000)

    it('Test 3.11: Knight jumps over pieces (b8-c6)', async () => {
      const matchId = 'test-move-3-11-' + Date.now()
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchId)],
        program.programId,
      )

      // Fund, mint, initialize as before
      await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
      await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        whitePlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        blackPlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )

      await program.methods
        .initializeMatch(matchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // Black joins
      const blackProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
        commitment: 'confirmed',
      })
      const programForBlack = new anchor.Program(program.idl, blackProvider)
      await programForBlack.methods
        .joinMatch(sendBetAmount)
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: blackPlayer.publicKey,
          playerTokenAccount: blackPlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([blackPlayer])
        .rpc({ commitment: 'confirmed' })

      // 1. White: e2-e4
      await program.methods
        .makeMove({
          fromRow: 1,
          fromCol: 4,
          toRow: 3,
          toCol: 4,
          promotion: null,
        })
        .accounts({
          chessMatch: chessMatchPda,
          player: whitePlayer.publicKey,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // 2. Black: b8-c6 (7,1 → 5,2): Knight jumps over pawn at b7
      await programForBlack.methods
        .makeMove({
          fromRow: 7,
          fromCol: 1,
          toRow: 5,
          toCol: 2,
          promotion: null,
        })
        .accounts({
          chessMatch: chessMatchPda,
          player: blackPlayer.publicKey,
        })
        .signers([blackPlayer])
        .rpc({ commitment: 'confirmed' })

      // Assert knight is at c6, source square is empty
      const matchState = await program.account.chessMatch.fetch(chessMatchPda)
      assert.deepStrictEqual(matchState.board[5][2]?.pieceType, { knight: {} })
      assert.deepStrictEqual(matchState.board[5][2]?.color, { black: {} })
      assert.isNull(matchState.board[7][1], 'b8 square should be empty after move')
      assert.deepStrictEqual(matchState.currentTurn, { white: {} })
      console.log('Test 3.11 Passed: Black knight jumps over pawn b8-c6')
    }, 15000)

    it('Test 3.12: Bishop valid move along open diagonal (f1–b5)', async () => {
      const matchId = 'bishop-f1-b5-' + Date.now()
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchId)],
        program.programId,
      )

      // Setup: airdrop, mint, initialize, join (repeat your known-good flows)

      await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
      await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        whitePlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        blackPlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )
      await program.methods
        .initializeMatch(matchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'finalized' })

      const blackProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
        commitment: 'finalized',
      })
      const programForBlackPlayer = new anchor.Program(program.idl, blackProvider)

      await programForBlackPlayer.methods
        .joinMatch(sendBetAmount)
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: blackPlayer.publicKey,
          playerTokenAccount: blackPlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([blackPlayer])
        .rpc({ commitment: 'finalized' })

      // 1. White: g2–g3 (1,6 → 2,6)
      await program.methods
        .makeMove({
          fromRow: 1,
          fromCol: 6,
          toRow: 2,
          toCol: 6,
          promotion: null,
        })
        .accounts({ chessMatch: chessMatchPda, player: whitePlayer.publicKey })
        .signers([whitePlayer])
        .rpc({ commitment: 'finalized' })

      // 2. Black: g7–g6 (6,6 → 5,6), dummy
      await programForBlackPlayer.methods
        .makeMove({
          fromRow: 6,
          fromCol: 6,
          toRow: 5,
          toCol: 6,
          promotion: null,
        })
        .accounts({ chessMatch: chessMatchPda, player: blackPlayer.publicKey })
        .signers([blackPlayer])
        .rpc({ commitment: 'finalized' })

      // 3. White: f1–b5 (0,5 → 4,1), bishop moves along open diagonal
      await program.methods
        .makeMove({
          fromRow: 0,
          fromCol: 5,
          toRow: 4,
          toCol: 1,
          promotion: null,
        })
        .accounts({ chessMatch: chessMatchPda, player: whitePlayer.publicKey })
        .signers([whitePlayer])
        .rpc({ commitment: 'finalized' })

      const matchState = await program.account.chessMatch.fetch(chessMatchPda)
      assert.deepStrictEqual(matchState.board[4][1]?.pieceType, { bishop: {} })
      assert.deepStrictEqual(matchState.board[4][1]?.color, { white: {} })
      assert.isNull(matchState.board[0][5])
      assert.deepStrictEqual(matchState.currentTurn, { black: {} })

      console.log('Test 3.12 Passed: Bishop valid move f1–b5')
    }, 15000)

    it('Test 3.13: Invalid bishop move blocked by piece (c1–d2)', async () => {
      const matchId = 'bishop-blocked-' + Date.now()
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchId)],
        program.programId,
      )
      await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
      await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        whitePlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        blackPlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )
      await program.methods
        .initializeMatch(matchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })
      const blackProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
        commitment: 'confirmed',
      })
      const programForBlackPlayer = new anchor.Program(program.idl, blackProvider)
      await programForBlackPlayer.methods
        .joinMatch(sendBetAmount)
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: blackPlayer.publicKey,
          playerTokenAccount: blackPlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([blackPlayer])
        .rpc({ commitment: 'confirmed' })

      // 1. White: c1–d2 (0,2→1,3), but d2 is still occupied by own pawn
      let threw = false
      try {
        await program.methods
          .makeMove({
            fromRow: 0,
            fromCol: 2,
            toRow: 1,
            toCol: 3,
            promotion: null,
          })
          .accounts({
            chessMatch: chessMatchPda,
            player: whitePlayer.publicKey,
          })
          .signers([whitePlayer])
          .rpc({ commitment: 'confirmed' })
      } catch (e: any) {
        threw = true
        // Your contract most likely throws InvalidMoveCannotCaptureOwnPiece for this
        if (e.errorCode && e.errorCode.code) {
          assert.strictEqual(e.errorCode.code, 'InvalidMoveCannotCaptureOwnPiece')
        } else {
          assert.match(
            e.toString(),
            /InvalidMoveCannotCaptureOwnPiece|own piece|blocked/i,
            'Error must indicate path blocked by own piece',
          )
        }
      }
      assert.isTrue(threw, 'Blocked bishop move should fail')
      console.log('Test 3.13 Passed: Bishop cannot move through own pawn d2')
    }, 10000)

    it('Test 3.14: Rook valid vertical move (a1–a3)', async () => {
      const matchId = 'rook-a1-a3-' + Date.now()
      const [chessMatchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchId)],
        program.programId,
      )
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchId)],
        program.programId,
      )
      await provider.connection.requestAirdrop(whitePlayer.publicKey, LAMPORTS_PER_SOL)
      await provider.connection.requestAirdrop(blackPlayer.publicKey, LAMPORTS_PER_SOL)
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        whitePlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )
      await mintTo(
        provider.connection,
        whitePlayer,
        sendMintPubkey,
        blackPlayerSendAta,
        whitePlayer.publicKey,
        sendBetAmount.toNumber(),
      )
      await program.methods
        .initializeMatch(matchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: whitePlayer.publicKey,
          bettingTokenMintAccount: sendMintPubkey,
          playerTokenAccount: whitePlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })
      const blackProvider = new anchor.AnchorProvider(provider.connection, new anchor.Wallet(blackPlayer), {
        commitment: 'confirmed',
      })
      const programForBlackPlayer = new anchor.Program(program.idl, blackProvider)
      await programForBlackPlayer.methods
        .joinMatch(sendBetAmount)
        .accounts({
          chessMatch: chessMatchPda,
          playerSigner: blackPlayer.publicKey,
          playerTokenAccount: blackPlayerSendAta,
          matchEscrowTokenAccount: escrowPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([blackPlayer])
        .rpc({ commitment: 'confirmed' })

      // 1. White: a2–a4 (1,0→3,0)
      await program.methods
        .makeMove({ fromRow: 1, fromCol: 0, toRow: 3, toCol: 0, promotion: null })
        .accounts({
          chessMatch: chessMatchPda,
          player: whitePlayer.publicKey,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      // 2. Black: h7–h6 (6,7→5,7) (dummy move)
      await programForBlackPlayer.methods
        .makeMove({ fromRow: 6, fromCol: 7, toRow: 5, toCol: 7, promotion: null })
        .accounts({
          chessMatch: chessMatchPda,
          player: blackPlayer.publicKey,
        })
        .signers([blackPlayer])
        .rpc({ commitment: 'confirmed' })

      // 3. White: a1–a3 (0,0→2,0) (clear!)
      await program.methods
        .makeMove({ fromRow: 0, fromCol: 0, toRow: 2, toCol: 0, promotion: null })
        .accounts({
          chessMatch: chessMatchPda,
          player: whitePlayer.publicKey,
        })
        .signers([whitePlayer])
        .rpc({ commitment: 'confirmed' })

      const matchState = await program.account.chessMatch.fetch(chessMatchPda)
      assert.deepStrictEqual(matchState.board[2][0]?.pieceType, { rook: {} })
      assert.deepStrictEqual(matchState.board[2][0]?.color, { white: {} })
      assert.isNull(matchState.board[0][0])
      console.log('Test 3.14 Passed: Rook valid move vertical a1–a3')
    }, 15000)
  })
})
