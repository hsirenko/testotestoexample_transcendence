/* src/history.ts  – tiny helper to sync SPA state with the browser history */

type ViewState =
  | { screen: 'home' }                                // landing page / dashboard
  | { screen: 'overlay';   id: string; inner: string | null }               // any modal / overlay
  | { screen: 'game';      gameId: string };          // remote or local game

/* ───── initial entry ───── */
if (!history.state) {
  history.replaceState({ screen: 'home' } satisfies ViewState, '');
}

/* ───── programmatic helpers ───── */
export function pushHome() {
  history.pushState({ screen: 'home' } satisfies ViewState, '');
}

export function pushOverlay(overlayId: string, innerId?: string) {
  history.pushState(
    { screen: 'overlay', id: overlayId, inner: innerId ?? null },
    ''
  );
}
export function pushGame(gameId: string) {
  history.pushState({ screen: 'game', gameId } satisfies ViewState, '');
}

/* ───── global pop handler ───── */
export function installPopHandler(router: (s: ViewState) => void) {
  window.addEventListener('popstate', ev => {
    //console.log('[POP]', ev.state);
    router(ev.state as ViewState);
  });
}

export function showHome(): void {
  // unhide the main dashboard / landing section
  document.getElementById('home-screen')?.classList.remove('hidden');

  // make sure other major sections are hidden
  document.getElementById('game-screen')?.classList.add('hidden');

  // extra clean-up if you have side panels etc.
  document.body.classList.remove('game-playing');
}
