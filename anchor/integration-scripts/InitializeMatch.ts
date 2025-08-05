import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
import { idlAddress } from '@coral-xyz/anchor/dist/cjs/idl'
import { getKeypairFromFile } from '@solana-developers/helpers'
import { Connection } from '@solana/web3.js'
import idl from './IDL/speed_chess.json'

const initializeMatch = async (matchId: string) => {

    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed')
    const whitePlayerKeypair = await getKeypairFromFile("test-keys/whitePlayerKeypair.json")
    const whitePlayer = new anchor.Wallet(whitePlayerKeypair);
    const whiteProvider = new anchor.AnchorProvider(connection, whitePlayer, {
        preflightCommitment: 'confirmed',
    })
    anchor.setProvider(whiteProvider)
    const whiteProgram = new Program(idl,whiteProvider)

    
}