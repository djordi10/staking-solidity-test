// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStaking {
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
    function claimRewards() external;
    function compoundRewards() external;
    function delegate(address delegatee) external;
    function cancelDelegation() external;
    function getStakedAmount(address user) external view returns (uint256);
    function getPendingRewards(address user) external view returns (uint256);
    function getTopStakers() external view returns (address[] memory);
}