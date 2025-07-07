/* src/config.ts – runtime only, no TS magic */

export const API_BASE = '/api';           // nginx proxies this path
export const WS_BASE  = (() => {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
})();
