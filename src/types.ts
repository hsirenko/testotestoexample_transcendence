/* Shared DTO shapes returned by the backend */

export interface WinsTotalDTO {
    wins: number;
    losses: number;
}

export interface GoalsTotalDTO {
    scored: number;
    conceded: number;
}

/* Array [12] used only for old mock data */
export interface MonthlyNumsDTO extends Array<number> {}

/* New – monthly win-rate payload  */
export interface MonthlyWinRateDTO {
    month: string; // "Jul", …
    winRate: number; // 0-100
}

/* New – monthly goals payload */
export interface MonthlyGoalsRowDTO {
    month: string;
    scored: number;
    conceded: number;
}

export interface MonthlyGoalsDTO {
    scored: number[]; // still used for mock mode
    conceded: number[];
}

export interface StreakDTO {
    streak: number;
}

export interface LongestHitDTO {
    longest: number;
    opponent: string;
}

export interface TrophyDTO {
    total: number;
}

export interface MatchRow {
    id: string;
    date: string; // ISO yyyy-mm-dd
    opponent: string;
    score: string; // “11 – 8”
    result: 'Win' | 'Loss';
}
