import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Governance", function () {
  async function deployGovernanceFixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const StakingToken = await ethers.getContractFactory("StakingToken");
    const stakingToken = await StakingToken.deploy("Governance Token", "GOV");

    const Staking = await ethers.getContractFactory("Staking");
    const staking = await Staking.deploy(await stakingToken.getAddress());

    const Governance = await ethers.getContractFactory("Governance");
    const governance = await Governance.deploy(await staking.getAddress());

    // Mint and stake tokens for testing
    const stakeAmount = ethers.parseEther("1000");
    await stakingToken.mint(addr1.address, stakeAmount);
    await stakingToken.mint(addr2.address, stakeAmount);
    await stakingToken.mint(addr3.address, stakeAmount);

    await stakingToken.connect(addr1).approve(await staking.getAddress(), stakeAmount);
    await stakingToken.connect(addr2).approve(await staking.getAddress(), stakeAmount);
    await stakingToken.connect(addr3).approve(await staking.getAddress(), stakeAmount);

    await staking.connect(addr1).stake(stakeAmount);
    await staking.connect(addr2).stake(stakeAmount);
    await staking.connect(addr3).stake(stakeAmount);

    return { governance, staking, stakingToken, owner, addr1, addr2, addr3 };
  }

  describe("Deployment", function () {
    it("Should set the correct staking contract address", async function () {
      const { governance, staking } = await loadFixture(deployGovernanceFixture);
      expect(await governance.stakingContract()).to.equal(await staking.getAddress());
    });

    it("Should set correct initial values", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      expect(await governance.votingDelay()).to.equal(86400); // 1 day
      expect(await governance.votingPeriod()).to.equal(604800); // 1 week
      expect(await governance.proposalThreshold()).to.equal(ethers.parseEther("100"));
      expect(await governance.quorumPercentage()).to.equal(40);
    });
  });

  describe("Proposal Creation", function () {
    it("Should allow users to create proposals", async function () {
      const { governance, addr1 } = await loadFixture(deployGovernanceFixture);
      const targets = [addr1.address];
      const values = [0];
      const calldatas = ["0x"];
      const description = "Test Proposal";

      await expect(governance.connect(addr1).propose(targets, values, calldatas, description))
        .to.emit(governance, "ProposalCreated");
    });

    it("Should not allow proposals from users below threshold", async function () {
      const { governance, owner } = await loadFixture(deployGovernanceFixture);
      const targets = [owner.address];
      const values = [0];
      const calldatas = ["0x"];
      const description = "Test Proposal";

      await expect(governance.propose(targets, values, calldatas, description))
        .to.be.revertedWith("Proposer votes below threshold");
    });
  });

  describe("Voting", function () {
    async function createProposal(governance: any, addr1: any) {
      const targets = [addr1.address];
      const values = [0];
      const calldatas = ["0x"];
      const description = "Test Proposal";
      const tx = await governance.connect(addr1).propose(targets, values, calldatas, description);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => log.fragment.name === 'ProposalCreated');
      const proposalId = event?.args[0] ?? null;

      if (proposalId === null) {
        throw new Error("Failed to retrieve proposalId");
      }

      // Advance time to just before the voting period starts
      await time.increase(86400 - 1);

      return proposalId;
    }

    async function createProposalBeforeVotingPeriod(governance: any, addr1: any) {
        const targets = [addr1.address];
        const values = [0];
        const calldatas = ["0x"];
        const description = "Test Proposal";
        const tx = await governance.connect(addr1).propose(targets, values, calldatas, description);
        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => log.fragment.name === 'ProposalCreated');
        const proposalId = event?.args[0] ?? null;
  
        if (proposalId === null) {
          throw new Error("Failed to retrieve proposalId");
        }
  
        // Advance time to just before the voting period starts
        await time.increase(86400 - 60);
  
        return proposalId;
      }

    it("Should allow users to cast votes", async function () {
      const { governance, addr1, addr2 } = await loadFixture(deployGovernanceFixture);
      const proposalId = await createProposal(governance, addr1);

      // Advance time to start of voting period
      await time.increase(1);

      await expect(governance.connect(addr2).castVote(proposalId, 1))
        .to.emit(governance, "VoteCast")
        .withArgs(addr2.address, proposalId, 1, await governance.getVotingPower(addr2.address));
    });

    it("Should not allow voting before voting delay", async function () {
      const { governance, addr1, addr2 } = await loadFixture(deployGovernanceFixture);
      const proposalId = await createProposalBeforeVotingPeriod(governance, addr1);

      await expect(governance.connect(addr2).castVote(proposalId, 1))
        .to.be.revertedWith("Voting is not active");
    });

    it("Should not allow voting after voting period", async function () {
      const { governance, addr1, addr2 } = await loadFixture(deployGovernanceFixture);
      const proposalId = await createProposal(governance, addr1);

      // Move past the voting period
      await time.increase(86400 + 604800 + 1);

      await expect(governance.connect(addr2).castVote(proposalId, 1))
        .to.be.revertedWith("Voting is not active");
    });

    it("Should not allow double voting", async function () {
      const { governance, addr1, addr2 } = await loadFixture(deployGovernanceFixture);
      const proposalId = await createProposal(governance, addr1);

      // Advance time to start of voting period
      await time.increase(1);

      await governance.connect(addr2).castVote(proposalId, 1);
      await expect(governance.connect(addr2).castVote(proposalId, 1))
        .to.be.revertedWith("Already voted");
    });
  });

  describe("Proposal Execution", function () {
    async function createProposal(governance: any, addr1: any) {
        const targets = [addr1.address];
        const values = [0];
        const calldatas = ["0x"];
        const description = "Test Proposal";
        const tx = await governance.connect(addr1).propose(targets, values, calldatas, description);
        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => log.fragment.name === 'ProposalCreated');
        const proposalId = event?.args[0] ?? null;
  
        if (proposalId === null) {
          throw new Error("Failed to retrieve proposalId");
        }
  
        // Advance time to just before the voting period starts
        await time.increase(86400 - 1);
  
        return proposalId;
    }

    it("Should not allow execution during voting period", async function () {
      const { governance, addr1, addr2, addr3 } = await loadFixture(deployGovernanceFixture);
      const proposalId = await createProposal(governance, addr1);

      // Check Pending state
      expect(await governance.state(proposalId)).to.equal(0); // Pending

      // Move to the start of the voting period
      await time.increase(86400 + 1); // 1 day (voting delay) + 1 second

      // Check Active state
      expect(await governance.state(proposalId)).to.equal(1); // Active

      // Cast some votes
      await governance.connect(addr1).castVote(proposalId, 1);
      await governance.connect(addr2).castVote(proposalId, 1);

      // Try to execute the proposal during the voting period
      await expect(governance.executeProposal(proposalId))
        .to.be.revertedWith("Proposal cannot be executed");

      // Move to just after the voting period ends
      await time.increase(604800); // 1 week (voting period)

      // Now the proposal should be in Succeeded state (assuming it passed)
      expect(await governance.state(proposalId)).to.equal(4); // Succeeded

      // Now execution should be allowed
      await expect(governance.executeProposal(proposalId)).to.not.be.reverted;

      // Check Executed state
      expect(await governance.state(proposalId)).to.equal(6); // Executed
    });
  });

  describe("Quorum", function () {
    it("Should allow owner to change quorum percentage", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      await expect(governance.setQuorumPercentage(50))
        .to.emit(governance, "QuorumPercentageChanged")
        .withArgs(40, 50);
    });

    it("Should not allow setting invalid quorum percentage", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      await expect(governance.setQuorumPercentage(0)).to.be.revertedWith("Invalid quorum percentage");
      await expect(governance.setQuorumPercentage(101)).to.be.revertedWith("Invalid quorum percentage");
    });
  });

  describe("Delegation", function () {
    it("Should allow users to delegate their voting power", async function () {
      const { governance, addr1, addr2 } = await loadFixture(deployGovernanceFixture);
      await expect(governance.connect(addr1).delegate(addr2.address))
        .to.emit(governance, "DelegateChanged")
        .withArgs(addr1.address, ethers.ZeroAddress, addr2.address);
    });

    it("Should correctly calculate voting power after delegation", async function () {
      const { governance, addr1, addr2 } = await loadFixture(deployGovernanceFixture);
      await governance.connect(addr1).delegate(addr2.address);
      const votingPower = await governance.getVotingPower(addr2.address);
      expect(votingPower).to.be.gt(ethers.parseEther("1000"));
    });
  });

  describe("Proposal State", function () {
    async function createProposal(governance: any, addr1: any) {
        const targets = [addr1.address];
        const values = [0];
        const calldatas = ["0x"];
        const description = "Test Proposal";
        const tx = await governance.connect(addr1).propose(targets, values, calldatas, description);
        const receipt = await tx.wait();
        const event = receipt?.logs.find((log: any) => log.fragment.name === 'ProposalCreated');
        const proposalId = event?.args[0] ?? null;
  
        if (proposalId === null) {
          throw new Error("Failed to retrieve proposalId");
        }
  
        // Advance time to just before the voting period starts
        await time.increase(86400 - 1);
  
        return proposalId;
    }
    
    it("Should correctly report proposal states", async function () {
      const { governance, addr1 } = await loadFixture(deployGovernanceFixture);
      const proposalId = await createProposal(governance, addr1);

      expect(await governance.state(proposalId)).to.equal(0); // Pending

      await time.increase(1); // Move to start of voting period
      expect(await governance.state(proposalId)).to.equal(1); // Active

      await time.increase(604801); // Move past voting period
      expect(await governance.state(proposalId)).to.equal(3); // Defeated (no votes cast)

    });
  });
});