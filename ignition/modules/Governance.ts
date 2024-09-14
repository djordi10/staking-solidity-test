import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const GovernanceModule = buildModule("GovernanceModule", (m) => {
  // Get the address of the already deployed Staking contract
  const stakingAddress = m.getParameter("stakingAddress", "0xc3928A267b411Df684960ED6C5f62dB0bBDfC3fd");  // Replace with actual address

  // Deploy Governance contract
  const governance = m.contract("Governance", [stakingAddress]);

  return { governance };
});

export default GovernanceModule;