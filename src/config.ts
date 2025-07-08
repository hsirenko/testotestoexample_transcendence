// Development mode: direct access to backend when on port 5500
export const API_BASE = location.port === '5500' ? 'http://localhost:3000/api' : '/api';
export const WS_BASE  = (() => {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  if (location.port === '5500') {
    return `${proto}://localhost:3000/ws`;
  }
  return `${proto}://${location.host}/ws`;
})();
