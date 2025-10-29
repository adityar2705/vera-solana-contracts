import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { VeraSmartContractSolana } from '../target/types/vera_smart_contract_solana';
import { Keypair, SystemProgram, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

async function createBond() {
  // Set up connection to Alchemy devnet
  const connection = new Connection("https://solana-devnet.g.alchemy.com/v2/mZF2f5gdft3uw-GcFj8Qd", "confirmed");
  
  // Load wallet from default Solana CLI location
  const walletPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );

  // Create wallet interface for Anchor
  const wallet = new anchor.Wallet(walletKeypair);

  // Set up provider
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Load the program
  const programId = new anchor.web3.PublicKey("72wg7oHFnghg21VrKqLTFrMvr9BnfHTopAZsX2XyZe8");
  const idl = JSON.parse(
    fs.readFileSync('./target/idl/vera_smart_contract_solana.json', 'utf-8')
  );
  const program = new Program(idl, programId, provider) as Program<VeraSmartContractSolana>;
  
  console.log("🚀 Creating a new bond on Devnet via Alchemy...\n");
  console.log("Program ID:", program.programId.toBase58());
  console.log("Payer/Authority:", provider.wallet.publicKey.toBase58());

  // Check wallet balance
  const balance = await connection.getBalance(provider.wallet.publicKey);
  console.log("Wallet Balance:", balance / LAMPORTS_PER_SOL, "SOL");
  
  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.log("\n⚠️  Low balance! Get devnet SOL from: https://faucet.solana.com/");
    console.log("Your address:", provider.wallet.publicKey.toBase58());
  }

  // Generate new keypairs for the bond account and bond mint
  const bondAccount = Keypair.generate();
  const bondMint = Keypair.generate();

  // Derive the mint authority PDA
  const [mintAuthorityPda, mintAuthorityBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vera_mint_authority")],
    program.programId
  );

  console.log("\n📋 Account Addresses:");
  console.log("Bond Account:", bondAccount.publicKey.toBase58());
  console.log("Bond Mint:", bondMint.publicKey.toBase58());
  console.log("Mint Authority PDA:", mintAuthorityPda.toBase58());
  console.log("Mint Authority Bump:", mintAuthorityBump);

  // Bond parameters
  const bondParams = {
    name: "Chennai Electricity Grid",
    symbol: "CHE-GRID",
    fundingGoal: new BN(100 * LAMPORTS_PER_SOL), // 100 SOL
    interestRate: 700, // 5% (500 basis points)
  };

  console.log("\n💰 Bond Parameters:");
  console.log("Name:", bondParams.name);
  console.log("Symbol:", bondParams.symbol);
  console.log("Funding Goal:", bondParams.fundingGoal.toNumber() / LAMPORTS_PER_SOL, "SOL");
  console.log("Interest Rate:", bondParams.interestRate / 100, "%");

  try {
    console.log("\n⏳ Sending transaction...");
    
    // Create the bond
    const tx = await program.methods
      .createBond(
        bondParams.name,
        bondParams.symbol,
        bondParams.fundingGoal,
        bondParams.interestRate
      )
      .accounts({
        bondAccount: bondAccount.publicKey,
        bondMint: bondMint.publicKey,
        mintAuthority: mintAuthorityPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([bondAccount, bondMint])
      .rpc();

    console.log("\n✅ Bond created successfully!");
    console.log("Transaction signature:", tx);
    console.log("\n🔗 View on Solscan:");
    console.log(`https://solscan.io/tx/${tx}?cluster=devnet`);
    
    // Wait a bit for the transaction to be confirmed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fetch and display the bond account data
    const bondData = await program.account.veraBondAccount.fetch(bondAccount.publicKey);
    console.log("\n📊 Bond Account Data:");
    console.log(JSON.stringify({
      name: bondData.name,
      symbol: bondData.symbol,
      fundingGoal: bondData.fundingGoal.toString(),
      totalRaised: bondData.totalRaised.toString(),
      interestRate: bondData.interestRate,
      totalRevenueDistributed: bondData.totalRevenueDistributed.toString(),
      authority: bondData.authority.toBase58(),
      bondMint: bondData.bondMint.toBase58(),
    }, null, 2));

    console.log("\n💾 SAVE THESE FOR YOUR FRONTEND:");
    console.log("─────────────────────────────────────────────────────");
    console.log("BOND_ACCOUNT:", bondAccount.publicKey.toBase58());
    console.log("BOND_MINT:", bondMint.publicKey.toBase58());
    console.log("─────────────────────────────────────────────────────");

  } catch (error: any) {
    console.error("\n❌ Error creating bond:", error);
    
    if (error.logs) {
      console.error("\n📜 Transaction Logs:");
      error.logs.forEach((log: string) => console.error(log));
    }
    
    throw error;
  }
}

createBond()
  .then(() => {
    console.log("\n✨ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });