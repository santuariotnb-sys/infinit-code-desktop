// Regex compartilhadas para detectar porta de dev server no output do terminal
// Usado por: useTerminal.ts, Preview.tsx
export const SERVER_REGEXES = [
  /(?:localhost|127\.0\.0\.1|\[::1\]):(\d{4,5})/,
  /Local:\s+https?:\/\/(?:localhost|127\.0\.0\.1):(\d{4,5})/i,
  /https?:\/\/localhost:(\d{4,5})/i,
  /Server listening at.*?:(\d{4,5})/i,
  /started at.*?:(\d{4,5})/i,
  /ready (?:on|started server on).*?:(\d{4,5})/i,
  /(?:started|listening|running|available|serving).*?port[:\s]+(\d{4,5})/i,
  /\bon port[:\s]+(\d{4,5})/i,
  /:\s*(\d{4,5})\s*(?:→|->|\()/,
  /App running at.*?:(\d{4,5})/i,
  /Network:.*?:(\d{4,5})/i,
  /running on https?:\/\/[^:]+:(\d{4,5})/i,
  /Development Server started.*?:(\d{4,5})/i,
  /application successfully started.*?:(\d{4,5})/i,
  /\bport\s+(\d{4,5})\b/i,
];

export function detectPort(data: string): number | null {
  for (const re of SERVER_REGEXES) {
    const m = data.match(re);
    if (m) {
      const port = parseInt(m[1], 10);
      if (port >= 1024 && port <= 65535) return port;
    }
  }
  return null;
}
