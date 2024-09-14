// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is ReentrancyGuard, Pausable, Ownable {
    IERC20 public stakingToken;

    uint256 public constant REWARD_ALLOCATION = 10_000_000 * 1e18;
    uint256 public constant DAILY_EMISSION = 1_000 * 1e18;
    uint256 public constant EMISSION_RATE = DAILY_EMISSION / 1 days;

    uint256 public totalStaked;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public remainingRewards;

    mapping(address => uint256) public userStakeAmount;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public userRewardPerTokenPaid;

    // Leaderboard
    address[] public topStakers;
    uint256 public constant MAX_LEADERBOARD_SIZE = 10;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event Compounded(address indexed user, uint256 amount);
    event LeaderboardUpdated(address[] newTopStakers);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    constructor(IERC20 _stakingToken) Ownable(msg.sender) {
        stakingToken = _stakingToken;
        lastUpdateTime = block.timestamp;
    }

    function setupInitialRewards() external onlyOwner {
        require(remainingRewards == 0, "Rewards already set up");
        remainingRewards = REWARD_ALLOCATION;
        require(stakingToken.transferFrom(msg.sender, address(this), REWARD_ALLOCATION), "Failed to transfer reward tokens");
    }

    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        totalStaked += amount;
        userStakeAmount[msg.sender] += amount;
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Stake transfer failed");
        updateLeaderboard(msg.sender);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        require(amount > 0, "Cannot unstake 0");
        require(userStakeAmount[msg.sender] >= amount, "Not enough staked");
        totalStaked -= amount;
        userStakeAmount[msg.sender] -= amount;
        require(stakingToken.transfer(msg.sender, amount), "Unstake transfer failed");
        
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            require(stakingToken.transfer(msg.sender, reward), "Reward transfer failed");
            remainingRewards -= reward;
            emit RewardClaimed(msg.sender, reward);
        }
        
        updateLeaderboard(msg.sender);
        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() external nonReentrant whenNotPaused updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            require(stakingToken.transfer(msg.sender, reward), "Reward transfer failed");
            remainingRewards -= reward;
            emit RewardClaimed(msg.sender, reward);
        }
    }

    function compound() external nonReentrant whenNotPaused updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            totalStaked += reward;
            userStakeAmount[msg.sender] += reward;
            remainingRewards -= reward;
            updateLeaderboard(msg.sender);
            emit Compounded(msg.sender, reward);
        }
    }

    function emergencyWithdraw() external nonReentrant {
        uint256 amount = userStakeAmount[msg.sender];
        require(amount > 0, "No stake to withdraw");
        
        totalStaked -= amount;
        userStakeAmount[msg.sender] = 0;
        rewards[msg.sender] = 0;
        
        require(stakingToken.transfer(msg.sender, amount), "Emergency withdrawal failed");
        updateLeaderboard(msg.sender);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getStakedAmount(address account) external view returns (uint256) {
        return userStakeAmount[account];
    }

    function getRewards(address account) public view returns (uint256) {
        return rewards[account] + (userStakeAmount[account] * (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + ((block.timestamp - lastUpdateTime) * EMISSION_RATE * 1e18 / totalStaked);
    }

    function getGovernancePower(address account) public view returns (uint256) {
        uint256 stakedAmount = userStakeAmount[account];
        uint256 balance = stakingToken.balanceOf(account);
        return stakedAmount * 2 + balance;
    }

    function getTopStakers() external view returns (address[] memory) {
        return topStakers;
    }

    function updateLeaderboard(address user) internal {
        uint256 userStake = userStakeAmount[user];
        uint256 i;
        bool isInTop = false;

        for (i = 0; i < topStakers.length; i++) {
            if (topStakers[i] == user) {
                isInTop = true;
                break;
            }
        }

        if (isInTop) {
            while (i > 0 && userStakeAmount[topStakers[i - 1]] < userStake) {
                topStakers[i] = topStakers[i - 1];
                i--;
            }
            topStakers[i] = user;
        } else if (topStakers.length < MAX_LEADERBOARD_SIZE || userStake > userStakeAmount[topStakers[topStakers.length - 1]]) {
            if (topStakers.length < MAX_LEADERBOARD_SIZE) {
                topStakers.push(user);
            }
            i = topStakers.length - 1;
            while (i > 0 && userStakeAmount[topStakers[i - 1]] < userStake) {
                topStakers[i] = topStakers[i - 1];
                i--;
            }
            topStakers[i] = user;
            if (topStakers.length > MAX_LEADERBOARD_SIZE) {
                topStakers.pop();
            }
        }

        emit LeaderboardUpdated(topStakers);
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            rewards[account] = getRewards(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

}