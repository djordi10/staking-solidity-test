# Decentralized Staking and Governance System

This project implements a comprehensive decentralized staking and governance system, featuring Solidity smart contracts and a Next.js frontend interface.

## Project Structure

project-root/
├── contracts/ # Smart contract source files
├── scripts/ # Utility scripts
├── test/ # Smart contract tests
├── frontend/ # Next.js frontend application
├── hardhat.config.ts # Hardhat configuration
└── README.md # This file


## Features

### Staking
- Token staking and unstaking
- Reward distribution
- Governance power calculation based on staked amounts
- Compound feature: Automatically reinvest earned rewards
- Leaderboard: Track top stakers in the system
- Emergency Withdraw: Allow users to quickly withdraw funds in case of emergencies

### Governance
- Proposal creation and management
- Voting mechanism tied to staking power
- Proposal execution
- Delegation of voting rights

## Smart Contracts

Located in the `contracts/` directory:

### Staking.sol
- Manages token staking and unstaking
- Handles reward distribution
- Calculates governance power for users
- Implements compound functionality for rewards
- Maintains a leaderboard of top stakers
- Includes emergency withdraw function for user safety

### Governance.sol
- Implements proposal lifecycle (creation, voting, execution)
- Integrates with Staking contract for voting power
- Manages delegation and quorum settings

## Frontend (Next.js)

Located in the `frontend/` directory. Provides a user interface for:

- Staking and unstaking tokens
- Viewing and claiming rewards
- Compounding rewards automatically
- Viewing the leaderboard of top stakers
- Creating and voting on governance proposals
- Delegating voting rights
- Performing emergency withdrawals

### Setup and Running

To set up and run the frontend:

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Copy the `.env.example` file to `.env.local`:
     ```
     cp .env.example .env.local
     ```
   - Open `.env.local` and fill in the required values for your environment

4. Run the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:3000] in your browser to view the application.

### Testing

You can test the deployed version of the frontend at:
[https://staking-frontend-ztjf.vercel.app/]

This testing link provides access to the latest deployed version of the frontend, allowing you to interact with the staking and governance features without setting up the local environment.

## Development

- Smart Contracts: Developed using Solidity 0.8.24
- Testing: Hardhat with Chai and Ethers.js
- Frontend: Next.js with React