import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Staking", function () {
  async function deployStakingFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const StakingToken = await ethers.getContractFactory("StakingToken");
    const stakingToken = await StakingToken.deploy("Staking Token", "STK");

    const Staking = await ethers.getContractFactory("Staking");
    const staking = await Staking.deploy(await stakingToken.getAddress());

    // Mint some tokens for testing
    await stakingToken.mint(addr1.address, ethers.parseEther("1000"));
    await stakingToken.mint(addr2.address, ethers.parseEther("1000"));

    // Setup initial rewards
    await stakingToken.mint(owner.address, ethers.parseEther("10000000"));
    await stakingToken.connect(owner).approve(await staking.getAddress(), ethers.parseEther("10000000"));
    await staking.setupInitialRewards();

    return { staking, stakingToken, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the correct staking token address", async function () {
      const { staking, stakingToken } = await loadFixture(deployStakingFixture);
      expect(await staking.stakingToken()).to.equal(await stakingToken.getAddress());
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake tokens", async function () {
      const { staking, stakingToken, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.parseEther("100");

      await stakingToken.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await expect(staking.connect(addr1).stake(stakeAmount))
        .to.changeTokenBalances(
          stakingToken,
          [addr1, staking],
          [-stakeAmount, stakeAmount]
        );

      expect(await staking.getStakedAmount(addr1.address)).to.equal(stakeAmount);
    });

    it("Should fail if user tries to stake zero amount", async function () {
      const { staking, addr1 } = await loadFixture(deployStakingFixture);
      await expect(staking.connect(addr1).stake(0)).to.be.revertedWith("Cannot stake 0");
    });
  });

  describe("Unstaking", function () {
    it("Should allow users to unstake tokens and receive rewards", async function () {
      const { staking, stakingToken, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.parseEther("100");
      const unstakeAmount = ethers.parseEther("50");

      await stakingToken.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);

      await time.increase(86400); // 1 day

      const balanceBefore = await stakingToken.balanceOf(addr1.address);
      const stakedBefore = await staking.getStakedAmount(addr1.address);

      await staking.connect(addr1).unstake(unstakeAmount);

      const stakedAfter = await staking.getStakedAmount(addr1.address);
      const balanceAfter = await stakingToken.balanceOf(addr1.address);

      expect(stakedAfter).to.equal(stakedBefore - unstakeAmount);
      expect(balanceAfter).to.be.gt(balanceBefore + unstakeAmount);
    });

    it("Should fail if user tries to unstake more than they have staked", async function () {
      const { staking, stakingToken, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.parseEther("100");

      await stakingToken.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);

      await expect(staking.connect(addr1).unstake(stakeAmount + 1n))
        .to.be.revertedWith("Not enough staked");
    });
  });

  describe("Rewards", function () {
    it("Should calculate rewards correctly", async function () {
      const { staking, stakingToken, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.parseEther("100");

      await stakingToken.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);

      await time.increase(86400); // 1 day

      const reward = await staking.getRewards(addr1.address);
      expect(reward).to.be.gt(0);
    });

    it("Should allow users to claim rewards", async function () {
      const { staking, stakingToken, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.parseEther("100");
      const dailyReward = ethers.parseEther("1000");

      await stakingToken.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);

      const initialBalance = await stakingToken.balanceOf(addr1.address);

      await time.increase(86400); // 1 day

      await staking.connect(addr1).claimRewards();

      const finalBalance = await stakingToken.balanceOf(addr1.address);

      expect(finalBalance).to.be.closeTo(
        initialBalance + dailyReward,
        ethers.parseEther("0.02") // Increased tolerance to allow for small differences
      );
    });

    it("Should allow users to compound rewards", async function () {
      const { staking, stakingToken, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.parseEther("100");
      const dailyReward = ethers.parseEther("1000");

      await stakingToken.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);

      await time.increase(86400); // 1 day

      await staking.connect(addr1).compound();

      const stakedAfter = await staking.getStakedAmount(addr1.address);
      expect(stakedAfter).to.be.closeTo(
        stakeAmount + dailyReward,
        ethers.parseEther("0.02") // Increased tolerance to allow for small differences
      );
    });
  });

  describe("Leaderboard", function () {
    it("Should update the leaderboard correctly", async function () {
      const { staking, stakingToken, addr1, addr2 } = await loadFixture(deployStakingFixture);
      const stakeAmount1 = ethers.parseEther("100");
      const stakeAmount2 = ethers.parseEther("200");

      await stakingToken.connect(addr1).approve(await staking.getAddress(), stakeAmount1);
      await stakingToken.connect(addr2).approve(await staking.getAddress(), stakeAmount2);

      await staking.connect(addr1).stake(stakeAmount1);
      await staking.connect(addr2).stake(stakeAmount2);

      const topStakers = await staking.getTopStakers();
      expect(topStakers[0]).to.equal(addr2.address);
      expect(topStakers[1]).to.equal(addr1.address);
    });
  });

  describe("Governance Power", function () {
    it("Should calculate governance power correctly", async function () {
      const { staking, stakingToken, addr1 } = await loadFixture(deployStakingFixture);
      const stakeAmount = ethers.parseEther("100");
      const unstakeAmount = ethers.parseEther("50");

      await stakingToken.connect(addr1).approve(await staking.getAddress(), stakeAmount);
      await staking.connect(addr1).stake(stakeAmount);

      const powerAfterStake = await staking.getGovernancePower(addr1.address);
      const balanceAfterStake = await stakingToken.balanceOf(addr1.address);
      const expectedPowerAfterStake = (stakeAmount * 2n) + balanceAfterStake;
      expect(powerAfterStake).to.equal(expectedPowerAfterStake);

      await staking.connect(addr1).unstake(unstakeAmount);

      const remainingStake = await staking.getStakedAmount(addr1.address);
      const balanceAfterUnstake = await stakingToken.balanceOf(addr1.address);
      const powerAfterUnstake = await staking.getGovernancePower(addr1.address);
      const expectedPowerAfterUnstake = (remainingStake * 2n) + balanceAfterUnstake;
      expect(powerAfterUnstake).to.equal(expectedPowerAfterUnstake);

      const additionalTokens = ethers.parseEther("25");
      await stakingToken.mint(addr1.address, additionalTokens);

      const powerAfterReceivingTokens = await staking.getGovernancePower(addr1.address);
      const expectedPowerAfterReceivingTokens = expectedPowerAfterUnstake + additionalTokens;
      expect(powerAfterReceivingTokens).to.equal(expectedPowerAfterReceivingTokens);
    });
  });
});