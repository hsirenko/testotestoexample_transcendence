import { FastifyInstance } from 'fastify';
import { scoreBoard } from '../utils/blockchain';
import { authMiddleware } from '../middleware/auth';
import { pseudoAddress } from '../utils/evm';
import db from '../utils/db';

export default async function scoreRoutes(fastify: FastifyInstance) {
    fastify.get('/api/score/:tid', { preHandler: authMiddleware }, async (req, reply) => {
        const tid = Number((req.params as any).tid);

        const players: string[] = await scoreBoard.listPlayers(tid);
        const rows = await Promise.all(
            players.map(async (p) => ({
                player: p,
                score: Number(await scoreBoard.getScore(tid, p)),
            }))
        );
        return reply.send(rows);
    });

    // Get tournament scores for the current user
    fastify.get('/api/user/tournament-scores', { preHandler: authMiddleware }, async (req: any, reply: any) => {
        const userId = (req as any).user.userId;
        
        try {
            // Get all tournaments the user participated in
            const tournaments = db.prepare(`
                SELECT DISTINCT t.id, t.name, t.created_at, t.status, t.winner_id,
                       winner.username as winner_username
                FROM tournaments t
                JOIN tournament_players tp ON t.id = tp.tournament_id
                LEFT JOIN users winner ON t.winner_id = winner.id
                WHERE tp.user_id = ? AND t.status = 'finished'
                ORDER BY t.created_at DESC
            `).all(userId);

            if (tournaments.length === 0) {
                return reply.send([]);
            }

            // Get the user's wallet address or generate pseudo address
            const user = db.prepare('SELECT wallet_address FROM users WHERE id = ?').get(userId) as { wallet_address: string | null };
            const userAddress = user?.wallet_address || pseudoAddress(userId);

            // For each tournament, fetch scores from blockchain
            const tournamentScores = await Promise.all(
                tournaments.map(async (tournament: any) => {
                    try {
                        // Get all players and their scores from blockchain
                        const players: string[] = await scoreBoard.listPlayers(tournament.id);
                        const playersData = await Promise.all(
                            players.map(async (playerAddress) => {
                                const score = Number(await scoreBoard.getScore(tournament.id, playerAddress));
                                
                                // Try to find the username for this address
                                let username = 'Unknown Player';
                                
                                // Check if it's a real wallet address
                                const userWithWallet = db.prepare('SELECT username FROM users WHERE wallet_address = ?').get(playerAddress);
                                if (userWithWallet) {
                                    username = (userWithWallet as any).username;
                                } else {
                                    // Check if it's a pseudo address
                                    const allUsers = db.prepare('SELECT id, username FROM users').all();
                                    for (const u of allUsers as any[]) {
                                        if (pseudoAddress(u.id) === playerAddress) {
                                            username = u.username;
                                            break;
                                        }
                                    }
                                }
                                
                                return {
                                    address: playerAddress,
                                    username,
                                    score,
                                    isCurrentUser: playerAddress === userAddress
                                };
                            })
                        );

                        // Sort players by score (descending), with winner always first
                        playersData.sort((a, b) => {
                            // If scores are equal, tournament winner goes first
                            if (a.score === b.score) {
                                if (a.username === tournament.winner_username) return -1;
                                if (b.username === tournament.winner_username) return 1;
                                return 0;
                            }
                            return b.score - a.score;
                        });

                        // Get match data for this tournament
                        const matches = db.prepare(`
                            SELECT m.id, m.game_id, m.player1_id, m.player2_id, m.winner_id, 
                                   m.score_p1, m.score_p2, m.played_at,
                                   p1.username as player1_username, p2.username as player2_username
                            FROM matches m
                            JOIN users p1 ON m.player1_id = p1.id
                            JOIN users p2 ON m.player2_id = p2.id
                            WHERE m.tournament_id = ? AND m.winner_id IS NOT NULL
                            ORDER BY m.played_at ASC
                        `).all(tournament.id);

                        return {
                            tournamentId: tournament.id,
                            tournamentName: tournament.name,
                            createdAt: tournament.created_at,
                            winnerUsername: tournament.winner_username,
                            players: playersData,
                            matches: matches,
                            userScore: playersData.find(p => p.isCurrentUser)?.score || 0,
                            userRank: playersData.findIndex(p => p.isCurrentUser) + 1
                        };
                    } catch (error) {
                        console.error(`Error fetching scores for tournament ${tournament.id}:`, error);
                        return {
                            tournamentId: tournament.id,
                            tournamentName: tournament.name,
                            createdAt: tournament.created_at,
                            winnerUsername: tournament.winner_username,
                            players: [],
                            matches: [],
                            userScore: 0,
                            userRank: 0,
                            error: 'Failed to fetch blockchain data'
                        };
                    }
                })
            );

            return reply.send(tournamentScores);
        } catch (error) {
            console.error('Error fetching user tournament scores:', error);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Debug endpoint to test tournament scores for any user (remove in production)
    fastify.get('/api/debug/tournament-scores/:userId', async (req: any, reply: any) => {
        const userId = Number((req.params as any).userId);
        
        try {
            // Get all tournaments the user participated in
            const tournaments = db.prepare(`
                SELECT DISTINCT t.id, t.name, t.created_at, t.status, t.winner_id,
                       winner.username as winner_username
                FROM tournaments t
                JOIN tournament_players tp ON t.id = tp.tournament_id
                LEFT JOIN users winner ON t.winner_id = winner.id
                WHERE tp.user_id = ? AND t.status = 'finished'
                ORDER BY t.created_at DESC
            `).all(userId);

            if (tournaments.length === 0) {
                return reply.send({ message: 'No tournaments found for this user', tournaments: [] });
            }

            // Get the user's wallet address or generate pseudo address
            const user = db.prepare('SELECT wallet_address FROM users WHERE id = ?').get(userId) as { wallet_address: string | null };
            const userAddress = user?.wallet_address || pseudoAddress(userId);

            // For each tournament, fetch scores from blockchain
            const tournamentScores = await Promise.all(
                tournaments.map(async (tournament: any) => {
                    try {
                        // Get all players and their scores from blockchain
                        const players: string[] = await scoreBoard.listPlayers(tournament.id);
                        const playersData = await Promise.all(
                            players.map(async (playerAddress) => {
                                const score = Number(await scoreBoard.getScore(tournament.id, playerAddress));
                                
                                // Try to find the username for this address
                                let username = 'Unknown Player';
                                
                                // Check if it's a real wallet address
                                const userWithWallet = db.prepare('SELECT username FROM users WHERE wallet_address = ?').get(playerAddress);
                                if (userWithWallet) {
                                    username = (userWithWallet as any).username;
                                } else {
                                    // Check if it's a pseudo address
                                    const allUsers = db.prepare('SELECT id, username FROM users').all();
                                    for (const u of allUsers as any[]) {
                                        if (pseudoAddress(u.id) === playerAddress) {
                                            username = u.username;
                                            break;
                                        }
                                    }
                                }
                                
                                return {
                                    address: playerAddress,
                                    username,
                                    score,
                                    isCurrentUser: playerAddress === userAddress
                                };
                            })
                        );

                        // Sort players by score (descending), with winner always first
                        playersData.sort((a, b) => {
                            // If scores are equal, tournament winner goes first
                            if (a.score === b.score) {
                                if (a.username === tournament.winner_username) return -1;
                                if (b.username === tournament.winner_username) return 1;
                                return 0;
                            }
                            return b.score - a.score;
                        });

                        // Get match data for this tournament
                        const matches = db.prepare(`
                            SELECT m.id, m.game_id, m.player1_id, m.player2_id, m.winner_id, 
                                   m.score_p1, m.score_p2, m.played_at,
                                   p1.username as player1_username, p2.username as player2_username
                            FROM matches m
                            JOIN users p1 ON m.player1_id = p1.id
                            JOIN users p2 ON m.player2_id = p2.id
                            WHERE m.tournament_id = ? AND m.winner_id IS NOT NULL
                            ORDER BY m.played_at ASC
                        `).all(tournament.id);

                        return {
                            tournamentId: tournament.id,
                            tournamentName: tournament.name,
                            createdAt: tournament.created_at,
                            winnerUsername: tournament.winner_username,
                            players: playersData,
                            matches: matches,
                            userScore: playersData.find(p => p.isCurrentUser)?.score || 0,
                            userRank: playersData.findIndex(p => p.isCurrentUser) + 1
                        };
                    } catch (error) {
                        console.error(`Error fetching scores for tournament ${tournament.id}:`, error);
                        return {
                            tournamentId: tournament.id,
                            tournamentName: tournament.name,
                            createdAt: tournament.created_at,
                            winnerUsername: tournament.winner_username,
                            players: [],
                            matches: [],
                            userScore: 0,
                            userRank: 0,
                            error: 'Failed to fetch blockchain data'
                        };
                    }
                })
            );

            return reply.send({ 
                message: `Tournament scores for user ${userId}`,
                userAddress,
                tournaments: tournamentScores 
            });
        } catch (error) {
            console.error('Error fetching tournament scores:', error);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}
