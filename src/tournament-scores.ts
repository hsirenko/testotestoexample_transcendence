// tournament-scores.ts - Tournament scores display functionality

import { getAuthHeader } from './utils/auth.js';

interface TournamentScorePlayer {
    address: string;
    username: string;
    score: number;
    isCurrentUser: boolean;
}

interface TournamentMatch {
    id: number;
    game_id: string;
    player1_id: number;
    player2_id: number;
    winner_id: number;
    score_p1: number;
    score_p2: number;
    played_at: string;
    player1_username: string;
    player2_username: string;
}

interface TournamentScore {
    tournamentId: number;
    tournamentName: string;
    createdAt: string;
    winnerUsername: string;
    players: TournamentScorePlayer[];
    matches: TournamentMatch[];
    userScore: number;
    userRank: number;
    error?: string;
}


async function fetchTournamentScores(): Promise<TournamentScore[]> {
    const response = await fetch('/api/user/tournament-scores', {
        headers: getAuthHeader()
    });
    
    if (!response.ok) {
        throw new Error('Failed to fetch tournament scores');
    }
    
    return await response.json();
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getRankBadge(rank: number): string {
    switch (rank) {
        case 1: return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500 text-yellow-900">🥇 1st</span>';
        case 2: return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-400 text-gray-900">🥈 2nd</span>';
        case 3: return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-700 text-yellow-100">🥉 3rd</span>';
        default: return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-600 text-gray-100">${rank}th</span>`;
    }
}

function createTournamentScoreCard(tournament: TournamentScore): string {
    const isWinner = tournament.userRank === 1;
    const hasError = tournament.error;
    
    return `
        <div class="bg-white/5 rounded-lg p-6 border border-white/10">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <h3 class="text-xl font-bold text-white">${tournament.tournamentName}</h3>
                    <p class="text-sm text-white/70">${formatDate(tournament.createdAt)}</p>
                    ${tournament.winnerUsername ? `<p class="text-sm text-amber-400">Winner: ${tournament.winnerUsername}</p>` : ''}
                </div>
                <div class="text-right">
                    ${hasError ? 
                        '<span class="text-red-400 text-sm">⚠️ Error loading data</span>' : 
                        `<div class="text-2xl font-bold text-white">${tournament.userScore}</div>
                         <div class="text-sm text-white/70">Your Score</div>
                         <div class="mt-2">${getRankBadge(tournament.userRank)}</div>`
                    }
                </div>
            </div>
            
            ${hasError ? 
                `<div class="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/20">
                    <p>${tournament.error}</p>
                    <p class="mt-2 text-xs">Tournament ID: ${tournament.tournamentId}</p>
                </div>` :
                `<div class="space-y-2">
                    <h4 class="text-lg font-semibold text-white mb-3">Tournament Matches</h4>
                    <div class="space-y-3">
                        ${tournament.matches.map((match, index) => {
                            const matchType = index < 2 ? 'Semi-final' : 'Final';
                            const matchNumber = index < 2 ? ` ${index + 1}` : '';
                            const player1Current = tournament.players.find(p => p.username === match.player1_username)?.isCurrentUser || false;
                            const player2Current = tournament.players.find(p => p.username === match.player2_username)?.isCurrentUser || false;
                            
                            return `
                            <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                                <div class="text-sm font-medium text-white/70 mb-2">${matchType}${matchNumber}</div>
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-4">
                                        <div class="text-center">
                                            <div class="font-medium text-white ${player1Current ? 'text-amber-400' : ''} ${match.winner_id === match.player1_id ? 'text-green-400' : ''}">
                                                ${match.player1_username}${player1Current ? ' (You)' : ''}
                                            </div>
                                            <div class="text-2xl font-bold text-white mt-1">${match.score_p1}</div>
                                        </div>
                                        <div class="text-white/50 text-lg">VS</div>
                                        <div class="text-center">
                                            <div class="font-medium text-white ${player2Current ? 'text-amber-400' : ''} ${match.winner_id === match.player2_id ? 'text-green-400' : ''}">
                                                ${match.player2_username}${player2Current ? ' (You)' : ''}
                                            </div>
                                            <div class="text-2xl font-bold text-white mt-1">${match.score_p2}</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-xs text-white/50">${new Date(match.played_at).toLocaleString()}</div>
                                        ${match.winner_id === match.player1_id ? 
                                            `<div class="text-green-400 text-sm font-medium mt-1">🏆 ${match.player1_username} won</div>` :
                                            `<div class="text-green-400 text-sm font-medium mt-1">🏆 ${match.player2_username} won</div>`
                                        }
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>`
            }
            
            <div class="mt-4 pt-4 border-t border-white/10">
                <div class="flex items-center text-xs text-white/50">
                    <span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Scores verified on Avalanche Fuji blockchain
                </div>
            </div>
        </div>
    `;
}

function showLoading() {
    const loadingEl = document.getElementById('tournament-scores-loading');
    const errorEl = document.getElementById('tournament-scores-error');
    const emptyEl = document.getElementById('tournament-scores-empty');
    const contentEl = document.getElementById('tournament-scores-content');
    
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (contentEl) contentEl.classList.add('hidden');
}

function showError() {
    const loadingEl = document.getElementById('tournament-scores-loading');
    const errorEl = document.getElementById('tournament-scores-error');
    const emptyEl = document.getElementById('tournament-scores-empty');
    const contentEl = document.getElementById('tournament-scores-content');
    
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (contentEl) contentEl.classList.add('hidden');
}

function showEmpty() {
    const loadingEl = document.getElementById('tournament-scores-loading');
    const errorEl = document.getElementById('tournament-scores-error');
    const emptyEl = document.getElementById('tournament-scores-empty');
    const contentEl = document.getElementById('tournament-scores-content');
    
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (contentEl) contentEl.classList.add('hidden');
}

function showContent() {
    const loadingEl = document.getElementById('tournament-scores-loading');
    const errorEl = document.getElementById('tournament-scores-error');
    const emptyEl = document.getElementById('tournament-scores-empty');
    const contentEl = document.getElementById('tournament-scores-content');
    
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (contentEl) contentEl.classList.remove('hidden');
}

export async function loadTournamentScores(): Promise<void> {
    showLoading();
    
    try {
        const scores = await fetchTournamentScores();
        
        if (scores.length === 0) {
            showEmpty();
            return;
        }
        
        const listEl = document.getElementById('tournament-scores-list');
        if (listEl) {
            listEl.innerHTML = scores.map(createTournamentScoreCard).join('');
        }
        
        showContent();
    } catch (error) {
        console.error('Error loading tournament scores:', error);
        showError();
    }
}

// Setup retry functionality
document.addEventListener('DOMContentLoaded', () => {
    const retryBtn = document.getElementById('tournament-scores-retry');
    if (retryBtn) {
        retryBtn.addEventListener('click', loadTournamentScores);
    }
});