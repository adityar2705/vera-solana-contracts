use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, MintTo, TokenAccount, TokenInterface};
use anchor_lang::solana_program::system_instruction;

//your program id is correct.
declare_id!("72wg7oHFnghg21VrKqLTFrMvr9BnfHTopAZsX2XyZe8");

#[program]
pub mod vera_smart_contract_solana {
    use super::*;

    //initializes a new bond.
    pub fn create_bond(
        ctx: Context<CreateBond>,
        name: String,
        symbol: String,
        funding_goal: u64,
        interest_rate: u16,
    ) -> Result<()> {
        let bond_account = &mut ctx.accounts.bond_account;
        bond_account.name = name;
        bond_account.symbol = symbol;
        bond_account.funding_goal = funding_goal;
        bond_account.interest_rate = interest_rate;
        bond_account.total_raised = 0;
        bond_account.total_revenue_distributed = 0;
        bond_account.authority = ctx.accounts.authority.key();
        bond_account.bond_mint = ctx.accounts.bond_mint.key();
        Ok(())
    }

    //processes an investment. no whitelist logic.
    pub fn invest(ctx: Context<Invest>, amount: u64) -> Result<()> {
        //1. transfer sol
        let ix = system_instruction::transfer(
            &ctx.accounts.investor.key(),
            &ctx.accounts.authority.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(&ix, &[
            ctx.accounts.investor.to_account_info(),
            ctx.accounts.authority.to_account_info(),
        ])?;

        //2. update counters
        let bond_account = &mut ctx.accounts.bond_account;
        bond_account.total_raised = bond_account.total_raised.checked_add(amount).unwrap();

        //3. mint tokens
        let seeds = b"vera_mint_authority";
        let bump = ctx.bumps.mint_authority;
        let signer: &[&[&[u8]]] = &[&[seeds, &[bump]]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.bond_mint.to_account_info(),
            to: ctx.accounts.investor_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        let cpi_context = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer);
        anchor_spl::token_interface::mint_to(cpi_context, amount)?;
        
        Ok(())
    }

    //the oracle function remains the same.
    pub fn settle_revenue(ctx: Context<SettleRevenue>, amount: u64) -> Result<()> {
        let bond_account = &mut ctx.accounts.bond_account;
        bond_account.total_revenue_distributed = bond_account
            .total_revenue_distributed
            .checked_add(amount)
            .unwrap();
        Ok(())
    }
}

//this is the on-chain state for a single vera revenue bond.
#[account]
pub struct VeraBondAccount {
    pub name: String,
    pub symbol: String,
    pub funding_goal: u64,
    pub total_raised: u64,
    pub interest_rate: u16,
    pub total_revenue_distributed: u64,
    pub authority: Pubkey,
    pub bond_mint: Pubkey,
}

//defines the accounts for the `create_bond` instruction.
#[derive(Accounts)]
pub struct CreateBond<'info> {
    #[account(init, payer = authority, space = 8 + 4 + 32 + 4 + 32 + 8 + 8 + 2 + 8 + 32 + 32)]
    pub bond_account: Account<'info, VeraBondAccount>,
    #[account(init, payer = authority, mint::decimals = 9, mint::authority = mint_authority)]
    pub bond_mint: InterfaceAccount<'info, Mint>,
    #[account(seeds = [b"vera_mint_authority"], bump)]
    /// CHECK: this is a pda, no data is stored on it.
    pub mint_authority: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
}

//defines the accounts for the `invest` instruction.
#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)]
    pub bond_account: Account<'info, VeraBondAccount>,
    
    //no whitelist check here.
    
    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = bond_mint,
        associated_token::authority = investor
    )]
    pub investor_token_account: InterfaceAccount<'info, TokenAccount>,
    
    #[account(mut, address = bond_account.bond_mint)]
    pub bond_mint: InterfaceAccount<'info, Mint>,

    #[account(seeds = [b"vera_mint_authority"], bump)]
    pub mint_authority: SystemAccount<'info>,

    #[account(mut)]
    pub investor: Signer<'info>,
    
    #[account(mut, address = bond_account.authority)]
    /// CHECK: this is a manual check for the demo.
    pub authority: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

//defines the security constraints for `settle_revenue`.
#[derive(Accounts)]
pub struct SettleRevenue<'info> {
    #[account(mut, has_one = authority)]
    pub bond_account: Account<'info, VeraBondAccount>,
    pub authority: Signer<'info>,
}