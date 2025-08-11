import * as anchor from '@coral-xyz/anchor'
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
} from '@solana/spl-token'
import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js'
import { getKeypairFromFile } from '@solana-developers/helpers';

async function mockTokenSetup() {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
    const whitePlayerKeypair = await getKeypairFromFile("/Users/amalnathsathyan/Documents/trycatchblock/magic-speed-chess/anchor/integration-scripts/test-keys/whitePlayerKeypair.json");
    const testUsdcKeypair = await getKeypairFromFile("/Users/amalnathsathyan/Documents/trycatchblock/magic-speed-chess/anchor/integration-scripts/test-keys/testUsdcKeypair.json")
    const blackPlayerKeypair = await getKeypairFromFile("/Users/amalnathsathyan/Documents/trycatchblock/magic-speed-chess/anchor/integration-scripts/test-keys/blackPlayerKeypair.json");

    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(whitePlayerKeypair), {
        preflightCommitment: 'confirmed',
    })
    anchor.setProvider(provider)

    // --- FIX: Use a more robust check for the mint account's existence ---
    const mintAccountInfo = await connection.getAccountInfo(testUsdcKeypair.publicKey);

    if (mintAccountInfo === null) {
        // This confirms the account address is truly available.
        console.log('Mock USDC mint not found. Initializing a new one...');
        try {
            await createMint(
                provider.connection,
                whitePlayerKeypair,           // Payer of the transaction
                whitePlayerKeypair.publicKey, // Mint Authority
                null,                         // Freeze Authority (optional)
                6,                            // Decimals
                testUsdcKeypair,              // The keypair for the new mint account
                { commitment: "confirmed" }
            );
            console.log('Mock USDC Mint initialized at:', testUsdcKeypair.publicKey.toBase58());
        } catch (createError) {
            console.error("CRITICAL: Failed to create mint even though address was free.", createError);
            throw createError;
        }
    } else {
        // The account address is already in use.
        console.log('Mock USDC mint account already exists at:', testUsdcKeypair.publicKey.toBase58());
    }

    // The rest of the script can now proceed with the assumption that the mint exists.
    console.log("Setting up Associated Token Accounts...");
    let whitePlayerAta;
    let blackPlayerAta;

    try {
        const whitePlayerAtaInfo = await getOrCreateAssociatedTokenAccount(
            provider.connection, whitePlayerKeypair, testUsdcKeypair.publicKey, whitePlayerKeypair.publicKey, false, 'confirmed'
        );
        whitePlayerAta = whitePlayerAtaInfo.address;
        console.log('White Player ATA:', whitePlayerAta.toBase58());

        const blackPlayerAtaInfo = await getOrCreateAssociatedTokenAccount(
            provider.connection, whitePlayerKeypair, testUsdcKeypair.publicKey, blackPlayerKeypair.publicKey, false, 'confirmed'
        );
        blackPlayerAta = blackPlayerAtaInfo.address;
        console.log('Black Player ATA:', blackPlayerAta.toBase58());

    } catch (e) {
        console.error('Error creating ATAs:', e);
        throw e;
    }

    console.log('Minting initial tokens to player ATAs...');
    try {
        await mintTo(
            provider.connection, whitePlayerKeypair, testUsdcKeypair.publicKey, whitePlayerAta, whitePlayerKeypair, 1000000000, [], { commitment: 'confirmed' }
        );

        const mintTx = await mintTo(
            provider.connection, whitePlayerKeypair, testUsdcKeypair.publicKey, blackPlayerAta, whitePlayerKeypair, 1000000000, [], { commitment: 'confirmed' }
        );
        console.log('Tokens Minted successfully. Final transaction signature:', mintTx);
    } catch (e) {
        console.error('Error minting tokens:', e);
        throw e;
    }

    console.log('Token setup completed successfully.');
}

mockTokenSetup().catch(err => {
    console.error("Script failed to run:", err.message);
});
