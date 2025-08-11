import * as anchor from '@coral-xyz/anchor'
import { getKeypairFromFile } from '@solana-developers/helpers'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import idl from './IDL/speed_chess.json' with {type: 'json'}
import type {SpeedChess} from './IDL/speed_chess';
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAccount, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { BN } from 'bn.js'

const initializeMatch = async (matchId: string, betAmount: number) => { // Fix parameter type
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
    const whitePlayerKeypair = await getKeypairFromFile("/Users/amalnathsathyan/Documents/trycatchblock/magic-speed-chess/anchor/integration-scripts/test-keys/whitePlayerKeypair.json");
    const whitePlayer = new anchor.Wallet(whitePlayerKeypair);
    const whiteProvider = new anchor.AnchorProvider(connection, whitePlayer, {
        preflightCommitment: 'confirmed',
    })
    anchor.setProvider(whiteProvider)

    const whiteProgram = new anchor.Program(idl as SpeedChess, whiteProvider)

    let whitePlayerAta;
    const testUsdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') // Try devnet USDC
    const betAmountBN = new BN(betAmount) // Fix variable naming
    const moveTimeoutDuration = new BN(60)
    const platformFeeBasisPoints = new BN(200)

    const [matchPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chess_match'), Buffer.from(matchId)],
        whiteProgram.programId,
    )
    const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('match_escrow'), Buffer.from(matchId)],
        whiteProgram.programId,
    )
    
    try {
        // Check SOL balance first
        const balance = await connection.getBalance(whitePlayerKeypair.publicKey);
        console.log('Wallet SOL balance:', balance / 1e9, 'SOL');
        
        if (balance < 0.01 * 1e9) {
            throw new Error(`Insufficient SOL balance: ${balance / 1e9} SOL. Airdrop SOL to: ${whitePlayerKeypair.publicKey.toBase58()}`);
        }

        whitePlayerAta = await getAssociatedTokenAddressSync(testUsdcMint,whitePlayer.publicKey,false,TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID);
        const whitePlayerAtaInfo = await getAccount(whiteProvider.connection,whitePlayerAta,'confirmed',TOKEN_PROGRAM_ID)
        console.log('White Player ATA:', whitePlayerAtaInfo.address.toBase58());

    } catch (e) {
        console.error('Error creating ATAs:', e);
        console.error('Wallet:', whitePlayerKeypair.publicKey.toBase58());
        console.error('Mint:', testUsdcMint.toBase58());
        whitePlayerAta = await createAccount(whiteProvider.connection,whitePlayerKeypair,testUsdcMint,whitePlayer.publicKey,)
        console.log({whitePlayerAta})
    }

    const initTxSig = await whiteProgram.methods
        .initializeMatch(matchId, betAmountBN, moveTimeoutDuration, platformFeeBasisPoints.toNumber()) // Use betAmountBN
        .accountsStrict({
            chessMatch: matchPda,
            playerSigner: whitePlayer.publicKey,
            bettingTokenMintAccount: testUsdcMint,
            playerTokenAccount: whitePlayerAta,
            matchEscrowTokenAccount: escrowPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .signers([whitePlayerKeypair])
        .rpc({ commitment: 'confirmed' })

    console.log("Match Initialized Successfully", initTxSig)
}

initializeMatch("test-002", 1_000_000).catch(e => {
    console.error("Script failed to run:", e.message);
})
