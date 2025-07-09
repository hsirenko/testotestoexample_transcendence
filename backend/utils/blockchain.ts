import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

// ———————————————————————————————————————————————
// 1. Provider  (connects to Fuji)
// 2. Signer    (the dedicated wallet you deployed with)
// 3. Contract  (ABI + signer)
// ———————————————————————————————————————————————

export const provider = new ethers.JsonRpcProvider(process.env.FUJI_RPC);

export const signer = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);

// JSON import needs "resolveJsonModule": true
import ScoreBoardArtifact from '../blockchain/ScoreBoard.json';

export const scoreBoard = new ethers.Contract(
    process.env.SCOREBOARD_ADDRESS as string,
    (ScoreBoardArtifact as any).abi,
    signer
);
