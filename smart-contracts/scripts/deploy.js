// frontend/smart-contracts/scripts/deploy.js
const hre = require('hardhat');

async function main() {
    // 1️⃣  Either deploy directly…
    const scoreboard = await hre.ethers.deployContract('ScoreBoard');

    // 2️⃣  …or via a factory (both work)
    // const ScoreBoard = await hre.ethers.getContractFactory("ScoreBoard");
    // const scoreboard = await ScoreBoard.deploy();

    // v6 → wait until the tx is mined
    await scoreboard.waitForDeployment();

    console.log('ScoreBoard address:', await scoreboard.getAddress());
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
