import { scoreBoard } from '../utils/blockchain';
import { pseudoAddress } from '../utils/evm';

export interface ScoreLine {
    userId: number; // internal DB id
    score: number; // 0-65535
    wallet?: string; // optional real wallet
}

/** Writes every player's score onto the ScoreBoard contract. */
export async function persistScoresOnChain(tournamentId: number, lines: ScoreLine[]) {
    for (const line of lines) {
        const playerAddress = line.wallet ?? pseudoAddress(line.userId); // fallback if wallet missing

        try {
            const tx = await scoreBoard.recordScore(tournamentId, playerAddress, line.score);
            await tx.wait();
            console.log(
                `✓ on-chain score ${line.score} for user#${line.userId} (${playerAddress})`
            );
        } catch (err) {
            console.error('✗ failed to write score', err);
        }
    }
}
