import { MatchRow } from './types.js';
import { getAuthHeader } from './utils/auth.js';

const API_BASE = ``;
const ENDPOINT = `${API_BASE}/api/matches/history`;


/* Called from nav.ts when the History tab is opened */
export async function initHistoryTab(): Promise<void> {
    try {
        //1- Fetch + parse
        const r = await fetch(ENDPOINT, { headers: getAuthHeader(true) });
        if (!r.ok) throw new Error('Failed to load history.');
        const rows = (await r.json()) as MatchRow[];

        //2- Render
        renderRows(rows);
    } catch (err: any) {
        console.error('History fetch failed:', err);

        const tbody = document.getElementById('history-body') as HTMLTableSectionElement | null;
        if (tbody) {
            tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-4 text-center text-red-400">
          Failed to load history.
        </td>
      </tr>`;
        }
    }

    function renderRows(rows: MatchRow[]): void {
        const tbody = document.getElementById('history-body') as HTMLTableSectionElement;
        if (!tbody) return;

        tbody.innerHTML = '';

        rows.forEach((row, i) => {
            const tr = document.createElement('tr');
            if (i % 2) tr.className = 'bg-white/5';

            tr.innerHTML = `
      <td class="py-2">${row.id}</td>
      <td class="py-2">${row.date}</td>
      <td>${row.opponent}</td>
      <td>${row.score}</td>
      <td class="${row.result === 'Win' ? 'text-green-400' : 'text-red-400'}">
        ${row.result}
      </td>
    `;
            tbody.appendChild(tr);
        });
    }
}
