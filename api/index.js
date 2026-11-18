/**
 * Função serverless da Vercel: todas as rotas /api/* chegam aqui
 * (rewrite em vercel.json) e são tratadas pela mesma aplicação Fastify do servidor local (compilada em backend/dist).
 */
import { handler } from '../backend/dist/app.js';

export default function vercelHandler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.searchParams.get('__path');
  if (path !== null) {
    url.searchParams.delete('__path');
    req.url = '/api/' + path + url.search;
  }
  return handler(req, res);
}

