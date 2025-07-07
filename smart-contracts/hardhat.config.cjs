//frontend/smart-contracts/hardhat.config.cjs
/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");
// require("dotenv").config();

const FUJI_RPC   = "https://avalanche-fuji-c-chain-rpc.publicnode.com";     // e.g. https://avalanche-fuji...
const PRIVATE_KEY = "16264a2fa6b25f47a4bad96b2135416ee8555243726a078f1152e4fe2ec9c267"; // wallet that deploys

module.exports = {
  solidity: "0.8.28",
  networks: {
    fuji: {
      url: FUJI_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 43113,
    },
  },
  etherscan: { apiKey: "FUJI_DOESNT_REQUIRE" },
};
