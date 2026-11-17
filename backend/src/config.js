import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Carrega backend/.env (KEY=VALUE) sem dependências externas.
const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  brapiToken: process.env.BRAPI_TOKEN || '',
  finnhubToken: process.env.FINNHUB_TOKEN || '',
  userAgent: 'MarketBrasil/0.1 (+dashboard)',
};
