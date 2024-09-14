import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("StakingToken", function () {
  async function deployStakingTokenFixture() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const StakingToken = await hre.ethers.getContractFactory("StakingToken");
    const stakingToken = await StakingToken.deploy("Staking Token", "STK");

    return { stakingToken, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { stakingToken, owner } = await loadFixture(deployStakingTokenFixture);
      expect(await stakingToken.owner()).to.equal(owner.address);
    });

    it("Should set the correct name and symbol", async function () {
      const { stakingToken } = await loadFixture(deployStakingTokenFixture);
      expect(await stakingToken.name()).to.equal("Staking Token");
      expect(await stakingToken.symbol()).to.equal("STK");
    });

    it("Should have zero initial supply", async function () {
      const { stakingToken } = await loadFixture(deployStakingTokenFixture);
      expect(await stakingToken.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const { stakingToken, otherAccount } = await loadFixture(deployStakingTokenFixture);
      await expect(stakingToken.mint(otherAccount.address, 100))
        .to.changeTokenBalance(stakingToken, otherAccount, 100);
    });

    it("Should fail if non-owner tries to mint", async function () {
      const { stakingToken, otherAccount } = await loadFixture(deployStakingTokenFixture);
      await expect(stakingToken.connect(otherAccount).mint(otherAccount.address, 100))
        .to.be.revertedWithCustomError(stakingToken, "OwnableUnauthorizedAccount")
        .withArgs(otherAccount.address);
    });
  });

  describe("Burning", function () {
    it("Should allow owner to burn tokens", async function () {
      const { stakingToken, otherAccount } = await loadFixture(deployStakingTokenFixture);
      await stakingToken.mint(otherAccount.address, 100);
      await expect(stakingToken.burn(otherAccount.address, 50))
        .to.changeTokenBalance(stakingToken, otherAccount, -50);
    });

    it("Should fail if non-owner tries to burn", async function () {
      const { stakingToken, otherAccount } = await loadFixture(deployStakingTokenFixture);
      await stakingToken.mint(otherAccount.address, 100);
      await expect(stakingToken.connect(otherAccount).burn(otherAccount.address, 50))
        .to.be.revertedWithCustomError(stakingToken, "OwnableUnauthorizedAccount")
        .withArgs(otherAccount.address);
    });

    it("Should fail if trying to burn more tokens than available", async function () {
      const { stakingToken, otherAccount } = await loadFixture(deployStakingTokenFixture);
      await stakingToken.mint(otherAccount.address, 100);
      await expect(stakingToken.burn(otherAccount.address, 150))
        .to.be.revertedWithCustomError(stakingToken, "ERC20InsufficientBalance")
        .withArgs(otherAccount.address, 100, 150);
    });
  });
});