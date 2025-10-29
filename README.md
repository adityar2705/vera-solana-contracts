# 🏛️ VERA-S Protocol - Solana Contracts

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Built with Anchor](https://img.shields.io/badge/Built%20with-Anchor-141414.svg)](https://www.anchor-lang.com/)

The official smart contract repository for **VERA-S**, the high-performance on-chain engine for funding the cities of tomorrow. Developed by **Urbane Digital Assets**.

---

### **Architecture Overview**

The VERA-S protocol's on-chain architecture is designed for hyper-efficiency, scalability, and clarity, leveraging the unique strengths of the Solana ecosystem. It is built on a single, stateless **Anchor Program** that manages all on-chain activity.

1.  **`vera_smart_contract_solana` (The Program):** A single, stateless, and highly-optimized program that contains all core business logic: `create_bond`, `invest`, `whitelist_investor`, and `settle_revenue`.
2.  **`VeraBondAccount` (The Data Accounts):** Instead of deploying a new, heavy contract for each bond, our program initializes a new, lightweight `VeraBondAccount` for each project. This is a crucial Solana design pattern that is thousands of times cheaper and faster to create than its EVM equivalent.
3.  **`SPL Token` (The Assets):** Each `VeraBondAccount` is paired with its own unique **SPL Token Mint**. When a user invests, the program mints tokens to their Associated Token Account (ATA), creating a 1:1, on-chain representation of their stake.

This "single program, multiple accounts" architecture is the key to VERA-S's scalability and low-cost operations.

### **Core On-Chain Features**

-   **Robust Testing:** 100% test coverage for all core functions, including security checks and edge cases, ensuring reliability.
-   **Professional Documentation:** Clean, humanized comments throughout the Rust code explaining the logic and architecture.
-   **Security Best Practices:** Implements Anchor's `has_one` constraints for authority checks and a **PDA-based on-chain whitelist** (`WhitelistEntry`) to programmatically gate all investments.
-   **Event-Driven Architecture:** Emits Anchor events for `BondCreated` and `RevenueSettled`, enabling real-time frontend updates and off-chain monitoring.

### **Tech Stack**

-   **Language:** Rust
-   **Framework:** Anchor `^0.29.0`
-   **Libraries:** `anchor-spl` (for SPL Token integration)
-   **Testing:** Mocha, Chai, TypeScript, Anchor Client

### **Local Development & Testing**

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/adityar2705/vera-smart-contract-solana.git](https://github.com/adityar2705/vera-smart-contract-solana.git)
    ```

2.  **Install dependencies:**
    ```bash
    cd vera-smart-contract-solana
    npm install
    ```

3.  **Build the program:**
    ```bash
    anchor build
    ```

4.  **Run the full test suite:**
    ```bash
    anchor test
    ```

5.  **Deploy to Devnet:**
    ```bash
    anchor deploy
    ```

---
*A project by Aditya Ranjan for the Solana Cypherpunk Hackathon.*
