import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

// Ensure your configuration variables are set before executing the script
const { vars } = require("hardhat/config");

const SEPOLIA_PRIVATE_KEY = vars.get("SEPOLIA_PRIVATE_KEY");

// const config: HardhatUserConfig = {
//   solidity: "0.8.24",
// };

// export default config;
module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      url: `https://ethereum-sepolia-rpc.publicnode.com`,
      accounts: [SEPOLIA_PRIVATE_KEY],
    },
  },
};
