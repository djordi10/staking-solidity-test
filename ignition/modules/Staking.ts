import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import StakingTokenModule from "./StakingToken";

const StakingModule = buildModule("StakingModule", (m) => {
  const { stakingToken } = m.useModule(StakingTokenModule);

  const staking = m.contract("Staking", [stakingToken]);

  const rewardAllocation = m.getParameter("rewardAllocation", BigInt(10_000_000) * BigInt(10**18));

  m.call(stakingToken, "approve", [staking, rewardAllocation], {
    from: m.getAccount(0),
  });

  m.call(staking, "setupInitialRewards");

  return { staking, stakingToken };
});

export default StakingModule;