// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Staking.sol";

contract Governance is Ownable {
    Staking public stakingContract;

    uint256 public votingDelay;
    uint256 public votingPeriod;
    uint256 public proposalThreshold;
    uint256 public quorumPercentage;
    mapping(address => address) public delegates;

    enum ProposalState { Pending, Active, Canceled, Defeated, Succeeded, Queued, Executed }

    struct Proposal {
        address proposer;
        uint256 voteStart;
        uint256 voteEnd;
        bool executed;
        bool canceled;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        mapping(address => bool) hasVoted;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string description;
    }

    mapping(uint256 => Proposal) public proposals;

    event ProposalCreated(uint256 indexed proposalId, address proposer, address[] targets, uint256[] values, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description);
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event QuorumPercentageChanged(uint256 oldQuorumPercentage, uint256 newQuorumPercentage);

    constructor(Staking _stakingContract) Ownable(msg.sender) {
        stakingContract = _stakingContract;
        // votingDelay = 1 days;
        // votingPeriod = 1 weeks;
        votingDelay = 1 minutes; //for testing set delay to 1 minute
        votingPeriod = 1 hours; //for testing set period to 1 hour
        proposalThreshold = 100e18;
        quorumPercentage = 40; // 40% quorum
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public returns (uint256) {
        require(getVotingPower(msg.sender) >= proposalThreshold, "Proposer votes below threshold");
        require(targets.length == values.length && targets.length == calldatas.length, "Invalid proposal length");

        uint256 proposalId = hashProposal(targets, values, calldatas, keccak256(bytes(description)));
        Proposal storage proposal = proposals[proposalId];
        require(proposal.voteStart == 0, "Proposal already exists");

        uint256 startTime = block.timestamp + votingDelay;
        uint256 endTime = startTime + votingPeriod;

        proposal.proposer = msg.sender;
        proposal.voteStart = startTime;
        proposal.voteEnd = endTime;
        proposal.targets = targets;
        proposal.values = values;
        proposal.calldatas = calldatas;
        proposal.description = description;

        emit ProposalCreated(proposalId, msg.sender, targets, values, calldatas, startTime, endTime, description);

        return proposalId;
    }

    function castVote(uint256 proposalId, uint8 support) public returns (uint256) {
        require(state(proposalId) == ProposalState.Active, "Voting is not active");
        require(support <= 2, "Invalid vote type");
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.hasVoted[msg.sender], "Already voted");

        uint256 weight = getVotingPower(msg.sender);

        if (support == 0) {
            proposal.againstVotes += weight;
        } else if (support == 1) {
            proposal.forVotes += weight;
        } else if (support == 2) {
            proposal.abstainVotes += weight;
        }

        proposal.hasVoted[msg.sender] = true;

        emit VoteCast(msg.sender, proposalId, support, weight);

        return weight;
    }

    function executeProposal(uint256 proposalId) public {
        require(state(proposalId) == ProposalState.Succeeded, "Proposal cannot be executed");
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;

        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = proposal.targets[i].call{value: proposal.values[i]}(proposal.calldatas[i]);
            require(success, "Proposal execution failed");
        }

        emit ProposalExecuted(proposalId);
    }

    function cancelProposal(uint256 proposalId) public {
        require(state(proposalId) == ProposalState.Pending, "Cannot cancel proposal");
        Proposal storage proposal = proposals[proposalId];
        require(msg.sender == proposal.proposer, "Only proposer can cancel");

        proposal.canceled = true;

        emit ProposalCanceled(proposalId);
    }

    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.voteStart > 0, "Proposal does not exist");

        if (proposal.canceled) {
            return ProposalState.Canceled;
        } else if (block.timestamp < proposal.voteStart) {
            return ProposalState.Pending;
        } else if (block.timestamp <= proposal.voteEnd) {
            return ProposalState.Active;
        } else if (proposal.forVotes <= proposal.againstVotes || !isQuorumReached(proposalId)) {
            return ProposalState.Defeated;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else {
            return ProposalState.Succeeded;
        }
    }

    function setQuorumPercentage(uint256 newQuorumPercentage) public onlyOwner {
        require(newQuorumPercentage > 0 && newQuorumPercentage <= 100, "Invalid quorum percentage");
        uint256 oldQuorumPercentage = quorumPercentage;
        quorumPercentage = newQuorumPercentage;
        emit QuorumPercentageChanged(oldQuorumPercentage, newQuorumPercentage);
    }

    function delegate(address delegatee) public {
        address oldDelegate = delegates[msg.sender];
        delegates[msg.sender] = delegatee;
        emit DelegateChanged(msg.sender, oldDelegate, delegatee);
    }

    function getVotingPower(address account) public view returns (uint256) {
        address delegatee = delegates[account];
        if (delegatee == address(0)) {
            return stakingContract.getGovernancePower(account);
        }
        return stakingContract.getGovernancePower(delegatee);
    }

    function isQuorumReached(uint256 proposalId) public view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 totalVotingPower = stakingContract.totalStaked();
        return (totalVotes * 100) >= (totalVotingPower * quorumPercentage);
    }

    function hashProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(targets, values, calldatas, descriptionHash)));
    }
}