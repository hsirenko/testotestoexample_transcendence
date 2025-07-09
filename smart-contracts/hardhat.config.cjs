//frontend/smart-contracts/hardhat.config.cjs
/** @type import('hardhat/config').HardhatUserConfig */
require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

// Load environment variables
const FUJI_RPC = process.env.FUJI_RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Validate required environment variables
if (!FUJI_RPC || !PRIVATE_KEY) {
    throw new Error('Please set FUJI_RPC and PRIVATE_KEY in your .env file');
}

module.exports = {
    solidity: '0.8.28',
    networks: {
        fuji: {
            url: FUJI_RPC,
            accounts: [PRIVATE_KEY],
            chainId: 43113,
        },
    },
    etherscan: { apiKey: 'FUJI_DOESNT_REQUIRE' },
};
