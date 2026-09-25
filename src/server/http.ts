import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { normalizeText, type PostInput } from '../shared/taxonomy.js';
import type { Classifier } from './classifier.js';

const MAX_BODY_BYTES = 24_000;
const MAX_TEXT_LENGTH = 12_000;

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  let text = '';
  for await (const chunk of req) {
    text += chunk.toString();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('Body too large');
  }
  return text;
}

function validPost(value: unknown): value is PostInput {
  if (typeof value !== 'object' || value === null) return false;
  const post = value as Record<string, unknown>;
  return typeof post.text === 'string' && normalizeText(post.text).length >= 15 && post.text.length <= MAX_TEXT_LENGTH
    && (post.author === undefined || typeof post.author === 'string' && post.author.length <= 300)
    && (post.repostText === undefined || typeof post.repostText === 'string' && post.repostText.length <= MAX_TEXT_LENGTH);
}

export function makeHttpServer(classify: Classifier, token: string): Server {
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin?.startsWith('chrome-extension://')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method === 'GET' && req.url === '/health') { json(res, 200, { ok: true }); return; }
    if (req.method === 'GET' && req.url === '/auth') {
      json(res, req.headers.authorization === `Bearer ${token}` ? 200 : 401,
        req.headers.authorization === `Bearer ${token}` ? { ok: true } : { error: 'Invalid local helper token' });
      return;
    }
    if (req.method !== 'POST' || req.url !== '/classify') { json(res, 404, { error: 'Not found' }); return; }
    if (req.headers.authorization !== `Bearer ${token}`) { json(res, 401, { error: 'Invalid local helper token' }); return; }
    try {
      const post: unknown = JSON.parse(await readBody(req));
      if (!validPost(post)) { json(res, 400, { error: 'Expected readable post text of 15–12000 characters' }); return; }
      const result = await classify(post);
      json(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Classification failed';
      if (message === 'Body too large') { json(res, 413, { error: message }); return; }
      if (error instanceof SyntaxError) { json(res, 400, { error: 'Invalid JSON' }); return; }
      console.error('Classification failed:', message);
      json(res, 503, { error: 'Classification service unavailable' });
    }
  });
}
