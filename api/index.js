/**
 * Função serverless da Vercel: todas as rotas /api/* chegam aqui
 * (rewrite em vercel.json) e são tratadas pelo mesmo handler do servidor local.
 */
import { handler } from '../backend/src/server.js';

export default function vercelHandler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.searchParams.get('__path');
  if (path !== null) {
    url.searchParams.delete('__path');
    req.url = '/api/' + path + url.search;
  }
  return handler(req, res);
}

