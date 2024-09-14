import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const StakingTokenModule = buildModule("StakingTokenModule", (m) => {
  // Define parameters with default values
  const name = m.getParameter("name", "Staking Token");
  const symbol = m.getParameter("symbol", "STK");
  const initialSupply = m.getParameter("initialSupply", BigInt(10000000) * BigInt(10**18)); //

  // Deploy the StakingToken contract
  const stakingToken = m.contract("StakingToken", [name, symbol]);

  // Mint initial supply to the deployer
  m.call(stakingToken, "mint", [m.getAccount(0), initialSupply]);

  return { stakingToken };
});

export default StakingTokenModule;
