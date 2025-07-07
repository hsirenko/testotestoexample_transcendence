/* src/history.ts  – tiny helper to sync SPA state with the browser history */

type ViewState =
  | { screen: 'home' }
  | { screen: 'overlay';   id: string; inner: string | null }
  | { screen: 'game';      gameId: string };

if (!history.state) {
  history.replaceState({ screen: 'home' } satisfies ViewState, '');
}

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

export function installPopHandler(router: (s: ViewState) => void) {
  window.addEventListener('popstate', ev => {
    router(ev.state as ViewState);
  });
}

export function showHome(): void {
  document.getElementById('home-screen')?.classList.remove('hidden');
  document.getElementById('game-screen')?.classList.add('hidden');
  document.body.classList.remove('game-playing');
}
