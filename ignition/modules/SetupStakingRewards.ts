import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SetupStakingRewardsModule = buildModule("SetupStakingRewardsModule", (m) => {
  const stakingAddress = "0xc3928A267b411Df684960ED6C5f62dB0bBDfC3fd"; // Replace with actual address
  const staking = m.contractAt("Staking", stakingAddress);

  m.call(staking, "setupInitialRewards");

  return { staking };
});

export default SetupStakingRewardsModule;