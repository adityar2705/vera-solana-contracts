import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VeraSmartContractSolana } from "../target/types/vera_smart_contract_solana";
import { expect } from "chai";
import {
  LAMPORTS_PER_SOL,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";

describe("vera-smart-contract-solana (Legendary PDA Battle Test)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.VeraSmartContractSolana as Program<VeraSmartContractSolana>;

  const authority = provider.wallet as anchor.Wallet;
  const investor1 = Keypair.generate();
  const unauthorizedUser = Keypair.generate();

  const bondAccount = Keypair.generate();
  const bondMint = Keypair.generate();
  
  //--- THIS IS THE NEW INTELLIGENCE ---
  //we derive the address of our program derived address (pda) that will act as the mint authority.
  const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vera_mint_authority")],
      program.programId
  );

  before(async () => {
    await provider.connection.requestAirdrop(investor1.publicKey, 20 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(unauthorizedUser.publicKey, 20 * LAMPORTS_PER_SOL);
  });

  //--- TEST SUITE: PROJECT CREATION ---
  describe("Project Creation", () => {
    it("is initialized correctly with the PDA as mint authority", async () => {
      const name = "Smart Parking Solana";
      const symbol = "VERA-S-PARK";
      const fundingGoal = new anchor.BN(100 * LAMPORTS_PER_SOL);
      const interestRate = 900;

      await program.methods
        .createBond(name, symbol, fundingGoal, interestRate)
        .accounts({
          bondAccount: bondAccount.publicKey,
          bondMint: bondMint.publicKey,
          authority: authority.publicKey,
          mintAuthority: mintAuthorityPda, //pass the pda here
        })
        .signers([bondAccount, bondMint])
        .rpc();

      const accountState = await program.account.veraBondAccount.fetch(bondAccount.publicKey);
      const mintState = await getMint(provider.connection, bondMint.publicKey);

      expect(accountState.authority.equals(authority.publicKey)).to.be.true;
      //assert that the spl token mint's authority is now our pda.
      expect(mintState.mintAuthority.equals(mintAuthorityPda)).to.be.true;
    });
  });

  //--- TEST SUITE: INVESTMENT ---
  describe("Investment", () => {
    it("allows a first-time investor to invest, with the program signing via PDA", async () => {
      const investmentAmount = new anchor.BN(5 * LAMPORTS_PER_SOL);
      const investorAta = getAssociatedTokenAddressSync(bondMint.publicKey, investor1.publicKey);

      await program.methods
        .invest(investmentAmount)
        .accounts({
          bondAccount: bondAccount.publicKey,
          bondMint: bondMint.publicKey,
          investorTokenAccount: investorAta,
          investor: investor1.publicKey,
          authority: authority.publicKey,
          mintAuthority: mintAuthorityPda, //pass the pda here as well
        })
        .signers([investor1])
        .rpc();
      
      const accountState = await program.account.veraBondAccount.fetch(bondAccount.publicKey);
      expect(accountState.totalRaised.eq(investmentAmount)).to.be.true;

      const investorTokenBalance = await provider.connection.getTokenAccountBalance(investorAta);
      expect(investorTokenBalance.value.amount).to.equal(investmentAmount.toString());
    });
  });
  
  //all other tests for revenue settlement and access control remain the same
  //as they do not interact with the minting functionality.
  describe("Revenue Settlement & Access Control", () => {
    it("allows the authority to settle revenue", async () => {
        const revenueAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        const initialState = await program.account.veraBondAccount.fetch(bondAccount.publicKey);
        await program.methods
          .settleRevenue(revenueAmount)
          .accounts({
              bondAccount: bondAccount.publicKey,
              authority: authority.publicKey,
          })
          .rpc();
        const finalState = await program.account.veraBondAccount.fetch(bondAccount.publicKey);
        const expectedTotal = initialState.totalRevenueDistributed.add(revenueAmount);
        expect(finalState.totalRevenueDistributed.eq(expectedTotal)).to.be.true;
    });

    it("REJECTS revenue settlement from an unauthorized user", async () => {
        const revenueAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);
        try {
          await program.methods
            .settleRevenue(revenueAmount)
            .accounts({
              bondAccount: bondAccount.publicKey,
              authority: unauthorizedUser.publicKey,
            })
            .signers([unauthorizedUser])
            .rpc();
          expect.fail("transaction should have failed but did not.");
        } catch (err) {
          expect(err).to.be.instanceOf(anchor.AnchorError);
          const anchorError = err as anchor.AnchorError;
          expect(anchorError.error.errorCode.code).to.equal("ConstraintHasOne");
        }
    });
  });
});

