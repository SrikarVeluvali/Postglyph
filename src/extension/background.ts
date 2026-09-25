import { isLabel, TAXONOMY_VERSION, type Classification, type PostInput } from '../shared/taxonomy.js';

const HELPER_URL = 'http://127.0.0.1:43187';
const CACHE_KEY = 'postglyphResultsV1';
const CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 500;
const MAX_CONCURRENT = 3;

interface CacheEntry { result: Classification; savedAt: number }
type Cache = Record<string, CacheEntry>;

let cachePromise: Promise<Cache> | undefined;
let writePromise: Promise<unknown> = Promise.resolve();
const pending = new Map<string, Promise<Classification>>();
const queue: Array<() => void> = [];
let active = 0;

async function getCache(): Promise<Cache> {
  cachePromise ??= chrome.storage.local.get(CACHE_KEY).then((stored) => (stored[CACHE_KEY] || {}) as Cache);
  return cachePromise;
}

async function hashPost(post: PostInput): Promise<string> {
  const bytes = new TextEncoder().encode(`${TAXONOMY_VERSION}:jev-latest:${post.author || ''}:${post.text}:${post.repostText || ''}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function slot<T>(work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active++;
      work().then(resolve, reject).finally(() => {
        active--;
        queue.shift()?.();
      });
    };
    if (active < MAX_CONCURRENT) run(); else queue.push(run);
  });
}

async function requestClassification(post: PostInput): Promise<Classification> {
  const { localToken } = await chrome.storage.local.get('localToken');
  if (!localToken) throw new Error('Open Postglyph and enter the local helper token');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${HELPER_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localToken}` },
      body: JSON.stringify(post),
      signal: controller.signal
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Local helper token is incorrect');
      throw new Error(response.status === 503 ? 'Classification service is unavailable' : `Helper error ${response.status}`);
    }
    const result: Classification = await response.json();
    if (!isLabel(result.label) || typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      throw new Error('Invalid classification response');
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function classify(post: PostInput): Promise<Classification> {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  if (!enabled) throw new Error('Postglyph is paused');
  const key = await hashPost(post);
  const cache = await getCache();
  const saved = cache[key];
  if (saved && Date.now() - saved.savedAt < CACHE_AGE_MS) return saved.result;
  const existing = pending.get(key);
  if (existing) return existing;
  const job = slot(() => requestClassification(post)).then((result) => {
    cache[key] = { result, savedAt: Date.now() };
    const entries = Object.entries(cache).filter(([, value]) => Date.now() - value.savedAt < CACHE_AGE_MS);
    entries.sort((a, b) => b[1].savedAt - a[1].savedAt);
    for (const oldKey of Object.keys(cache)) delete cache[oldKey];
    Object.assign(cache, Object.fromEntries(entries.slice(0, CACHE_LIMIT)));
    writePromise = writePromise.then(() => chrome.storage.local.set({ [CACHE_KEY]: cache }));
    return writePromise.then(() => result);
  }).finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}

async function status() {
  const { enabled = true, localToken } = await chrome.storage.local.get(['enabled', 'localToken']);
  try {
    const response = await fetch(`${HELPER_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return { enabled, tokenConfigured: !!localToken, helperOnline: false, tokenValid: false };
    if (!localToken) return { enabled, tokenConfigured: false, helperOnline: true, tokenValid: false };
    const auth = await fetch(`${HELPER_URL}/auth`, {
      headers: { Authorization: `Bearer ${localToken}` }, signal: AbortSignal.timeout(2000)
    });
    return { enabled, tokenConfigured: true, helperOnline: true, tokenValid: auth.ok };
  } catch {
    return { enabled, tokenConfigured: !!localToken, helperOnline: false, tokenValid: false };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || typeof message !== 'object' || message === null) return false;
  const data = message as Record<string, unknown>;
  if (data.type === 'status') {
    status().then(sendResponse);
    return true;
  }
  if (data.type === 'classify' && sender.url?.startsWith('https://www.linkedin.com/')) {
    const post = data.post as PostInput;
    if (!post || typeof post.text !== 'string') return false;
    classify(post).then((result) => sendResponse({ result }), (error) => sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' }));
    return true;
  }
  return false;
});
