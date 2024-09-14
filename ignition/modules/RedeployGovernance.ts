import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RedeployGovernanceModule = buildModule("RedeployGovernanceModule", (m) => {
  // Get the address of the already deployed Staking contract
  const stakingAddress = m.getParameter("stakingAddress", "0xc3928A267b411Df684960ED6C5f62dB0bBDfC3fd");  // Replace with actual address

  // Deploy Governance contract
  const governance = m.contract("Governance", [stakingAddress]);

  // Optional: Set initial parameters if needed
  // m.call(governance, "setQuorumPercentage", [40]);

  return { governance };
});

export default RedeployGovernanceModule;