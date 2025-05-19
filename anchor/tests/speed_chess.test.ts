// chess-app.ts
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { SpeedChess } from "../target/types/speed_chess";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount, // This is for creating generic token accounts
  mintTo,
  getAccount,
  // getOrCreateAssociatedTokenAccount, // Often more convenient for ATAs
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { assert } from "chai";
import { getKeypairFromFile } from "@solana-developers/helpers"; // You're using this helper

describe("SpeedChess Program Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SpeedChess as Program<SpeedChess>;

  const whitePlayer = Keypair.generate();
  const blackPlayer = Keypair.generate();
  const platformFeeWallet = Keypair.generate();

  let sendMintKp: Keypair;
  let wsolMintKp: Keypair;
  let unsupportedMintKp: Keypair;

  let sendMintPubkey: PublicKey;
  let wsolMintPubkey: PublicKey;
  let unsupportedMintPubkey: PublicKey;

  let whitePlayerSendAta: PublicKey;
  let whitePlayerWsolAta: PublicKey;
  let blackPlayerSendAta: PublicKey;
  let platformSendAta: PublicKey;
  let platformWsolAta: PublicKey;

  const matchId = "test-match-stable-001";
  const sendBetAmount = new BN(10_000_000); 
  const wsolBetAmount = new BN(100_000_000);
  const moveTimeoutDuration = new BN(60);
  const platformFeeBasisPoints = new BN(200);

  let chessMatchPda: PublicKey;
  let chessMatchBump: number;
  let matchEscrowTokenAccountPdaSend: PublicKey;
  // let matchEscrowTokenAccountPdaSendBump: number; // Bump not used if not needed for signing

  beforeAll(async () => {
    console.log("Starting beforeAll setup...");

    // 1. Load keypairs from files
    console.log("Loading mint keypairs...");
    try {
      sendMintKp = await getKeypairFromFile("/Users/amalnathsathyan/Documents/trycatchblock/magic-speed-chess/anchor/tests/test-keys/SENDYLjLBaTgjyfXtPP2aHUt91WhNzX7iUfpThyApht.json");
      wsolMintKp = await getKeypairFromFile("/Users/amalnathsathyan/Documents/trycatchblock/magic-speed-chess/anchor/tests/test-keys/WSiBAnrREwNLdGkDpXuqdKL4fJvAHeJhDfehmFdMdvw.json")
      // Assuming you have a different keypair file for the unsupported mint
      unsupportedMintKp =await getKeypairFromFile("/Users/amalnathsathyan/Documents/trycatchblock/magic-speed-chess/anchor/tests/test-keys/un72dZJgdTp7x6Ckgxhk8p5bpVu3Mt23wSm1f6FNVeG.json");
      console.log("Mint keypairs loaded successfully.");
    } catch (e) {
      console.error("CRITICAL: Failed to load one or more mint keypairs. Ensure they are generated and paths are correct relative to project root.", e);
      throw e;
    }
    
    sendMintPubkey = sendMintKp.publicKey;
    wsolMintPubkey = wsolMintKp.publicKey;
    unsupportedMintPubkey = unsupportedMintKp.publicKey;

    console.log("Using Mock SEND Mint Pubkey:", sendMintPubkey.toBase58());
    console.log("Using Mock wSOL Mint Pubkey:", wsolMintPubkey.toBase58());
    console.log("Using Mock Unsupported Mint Pubkey:", unsupportedMintPubkey.toBase58());
    console.log("Ensure these pubkeys match the constants in your Rust program for local testing!");

    // 2. Fund player wallets
    console.log("Airdropping SOL to players...");
    const airdropLamports = 2 * LAMPORTS_PER_SOL;
    const payerForOps = whitePlayer; // Use one of the players as the payer for minting etc.

    await Promise.all([
        provider.connection.requestAirdrop(payerForOps.publicKey, airdropLamports)
            .then(sig => provider.connection.confirmTransaction(sig, "confirmed")),
        provider.connection.requestAirdrop(blackPlayer.publicKey, airdropLamports)
            .then(sig => provider.connection.confirmTransaction(sig, "confirmed")),
        provider.connection.requestAirdrop(platformFeeWallet.publicKey, airdropLamports)
            .then(sig => provider.connection.confirmTransaction(sig, "confirmed")),
    ]);
    console.log("Airdrops confirmed.");

    // 3. Create mock mints using the loaded keypairs
    // If mints might already exist from a previous failed run, this part can error.
    // For robust tests against a persistent local ledger, check existence or use a fresh ledger.
    console.log("Initializing mock mints (if they don't already exist)...");
    try {
      // Check if mint already exists by trying to fetch its info. If it fails, create it.
      try { await getAccount(provider.connection, sendMintPubkey); console.log("Mock SEND mint already exists."); }
      catch (e) { 
        await createMint(provider.connection, payerForOps, payerForOps.publicKey, null, 6, sendMintKp); 
        console.log("Mock SEND Mint initialized at:", sendMintPubkey.toBase58());
      }

      try { await getAccount(provider.connection, wsolMintPubkey); console.log("Mock wSOL mint already exists."); }
      catch (e) {
        await createMint(provider.connection, payerForOps, payerForOps.publicKey, null, 9, wsolMintKp);
        console.log("Mock wSOL Mint initialized at:", wsolMintPubkey.toBase58());
      }
      
      try { await getAccount(provider.connection, unsupportedMintPubkey); console.log("Unsupported mint already exists."); }
      catch (e) {
        await createMint(provider.connection, payerForOps, payerForOps.publicKey, null, 8, unsupportedMintKp);
        console.log("Unsupported Mint initialized at:", unsupportedMintPubkey.toBase58());
      }
      console.log("Mock mints setup complete.");
    } catch(e) {
        console.error("Error during mock mint setup:", e);
        throw e;
    }

    // 4. Create Associated Token Accounts (ATAs)
    // Using createAccount for simplicity here as you did. getOrCreateAssociatedTokenAccount is often better.
    console.log("Creating player and platform ATAs...");
    try {
        whitePlayerSendAta = await createAccount(provider.connection, payerForOps, sendMintPubkey, whitePlayer.publicKey, Keypair.generate(), {commitment: "confirmed"});
        whitePlayerWsolAta = await createAccount(provider.connection, payerForOps, wsolMintPubkey, whitePlayer.publicKey, Keypair.generate(), {commitment: "confirmed"});
        
        blackPlayerSendAta = await createAccount(provider.connection, payerForOps, sendMintPubkey, blackPlayer.publicKey, Keypair.generate(), {commitment: "confirmed"});

        platformSendAta = await createAccount(provider.connection, payerForOps, sendMintPubkey, platformFeeWallet.publicKey, Keypair.generate(), {commitment: "confirmed"});
        platformWsolAta = await createAccount(provider.connection, payerForOps, wsolMintPubkey, platformFeeWallet.publicKey, Keypair.generate(), {commitment: "confirmed"});
        console.log("ATAs created.");
    } catch (e) {
        console.error("Error creating ATAs:", e);
        throw e;
    }

    // 5. Mint tokens to player ATAs
    console.log("Minting initial tokens to player ATAs...");
    try {
        await mintTo(provider.connection, payerForOps, sendMintPubkey, whitePlayerSendAta, payerForOps.publicKey, sendBetAmount.muln(5).toNumber(), [], {commitment: "confirmed"});
        await mintTo(provider.connection, payerForOps, wsolMintPubkey, whitePlayerWsolAta, payerForOps.publicKey, wsolBetAmount.muln(5).toNumber(), [], {commitment: "confirmed"});
        await mintTo(provider.connection, payerForOps, sendMintPubkey, blackPlayerSendAta, payerForOps.publicKey, sendBetAmount.muln(5).toNumber(), [], {commitment: "confirmed"});
        console.log("Initial tokens minted.");
    } catch (e) {
        console.error("Error minting initial tokens:", e);
        throw e;
    }

    // 6. Derive PDAs
    console.log("Deriving PDAs...");
    [chessMatchPda, chessMatchBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("chess_match"), Buffer.from(matchId)],
      program.programId
    );
    // matchEscrowTokenAccountPdaSendBump is not directly used in this test call, but good to have if needed later
    [matchEscrowTokenAccountPdaSend, /* matchEscrowTokenAccountPdaSendBump */] = PublicKey.findProgramAddressSync(
      [Buffer.from("match_escrow"), Buffer.from(matchId)],
      program.programId
    );
    console.log("PDAs derived.");
    console.log("beforeAll setup fully completed.");
  }, 100000); // Increased timeout for beforeAll

  describe("Initialize Match", () => {
    it("Test 1.1: Should initialize a match successfully with (mock) SEND token", async () => {
  //     console.log("Starting Test 1.1: Initialize Match with SEND token...");
  //     const initialWhitePlayerSendBalance = (await getAccount(provider.connection, whitePlayerSendAta)).amount;
  //     console.log("Initial white player SEND ATA balance:", initialWhitePlayerSendBalance.toString());

  //     await program.methods
  //       .initializeMatch(matchId, sendBetAmount, moveTimeoutDuration, platformFeeBasisPoints.toNumber())
  //       .accounts({
  //         chessMatch: chessMatchPda,
  //         playerSigner: whitePlayer.publicKey,
  //         bettingTokenMintAccount: sendMintPubkey,
  //         playerTokenAccount: whitePlayerSendAta,
  //         matchEscrowTokenAccount: matchEscrowTokenAccountPdaSend,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .signers([whitePlayer])
  //       .rpc({ commitment: "confirmed" }); // Ensure RPC confirms
      
  //     console.log("initializeMatch RPC call successful for Test 1.1.");

  //     const chessMatchState = await program.account.chessMatch.fetch(chessMatchPda);
  //     console.log("Fetched chessMatchState for Test 1.1.");

  //     // Assertions... (as before)
  //     assert.strictEqual(chessMatchState.matchId, matchId, "Match ID mismatch");
  //     assert.ok(chessMatchState.players[0].equals(whitePlayer.publicKey), "Player 1 (White) mismatch");
  //     assert.ok(chessMatchState.bettingTokenMint.equals(sendMintPubkey), "Betting token mint mismatch");
  //     assert.ok(chessMatchState.betAmountPlayerOne.eq(sendBetAmount), "Player 1 bet amount mismatch");
  //     assert.ok(chessMatchState.totalPot.eq(sendBetAmount), "Total pot mismatch");
  //     assert.strictEqual(chessMatchState.platformFeeBasisPoints, platformFeeBasisPoints.toNumber(), "Platform fee bps mismatch");
  //     assert.ok(chessMatchState.moveTimeoutDuration.eq(moveTimeoutDuration), "Move timeout duration mismatch");
  //     assert.deepStrictEqual(chessMatchState.gameStatus, { waitingForOpponent: {} }, "Game status mismatch");
  //     assert.isFalse(chessMatchState.payoutProcessed, "Payout processed should be false");

  //     const finalWhitePlayerSendBalance = (await getAccount(provider.connection, whitePlayerSendAta)).amount;
  //     const escrowSendBalance = (await getAccount(provider.connection, matchEscrowTokenAccountPdaSend)).amount;
  //     console.log("Final white player SEND ATA balance:", finalWhitePlayerSendBalance.toString());
  //     console.log("Escrow SEND ATA balance:", escrowSendBalance.toString());

  //     assert.ok(
  //       initialWhitePlayerSendBalance - finalWhitePlayerSendBalance === BigInt(sendBetAmount.toString()),
  //       "White player SEND balance not debited correctly"
  //     );
  //     assert.ok(escrowSendBalance === BigInt(sendBetAmount.toString()), "Escrow SEND balance not credited correctly");
      
  //     console.log("Test 1.1 Passed: Match initialized with mock SEND token.");
    });
  });
});
