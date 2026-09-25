import { LABELS, type Classification } from '../shared/taxonomy.js';
import { extractPost } from './post.js';

const CARD_SELECTOR = [
  '[data-testid="mainFeed"] [role="listitem"]',
  '[data-view-name="feed-suggested-update"]',
  'div[data-id^="urn:li:activity:"]',
  'div[data-urn^="urn:li:activity:"]',
  '[data-finite-scroll-hotkey-item]',
  '[data-test-id="main-feed-activity-card"]',
  '.feed-shared-update-v2',
  '.occludable-update'
].join(', ');
interface CardState { textKey: string; generation: number; badge: HTMLElement }
const cards = new WeakMap<Element, CardState>();
let enabled = true;
let scanTimer: ReturnType<typeof setTimeout> | undefined;
let lastError = '';

function feedCards(): Element[] {
  return Array.from(document.querySelectorAll(CARD_SELECTOR))
    .filter((card) => !card.parentElement?.closest(CARD_SELECTOR));
}

function badgeFor(card: Element): HTMLElement {
  const existing = cards.get(card);
  if (existing) return existing.badge;
  const badge = document.createElement('span');
  badge.className = 'postglyph-badge';
  badge.setAttribute('aria-label', 'Postglyph classification');
  const header = card.querySelector('.update-components-actor, .feed-shared-actor, .feed-shared-update-v2__actor');
  if (header?.parentElement) header.insertAdjacentElement('afterend', badge);
  else card.prepend(badge);
  cards.set(card, { textKey: '', generation: 0, badge });
  return badge;
}

function render(badge: HTMLElement, result: Classification): void {
  const percentage = Math.round(result.confidence * 100);
  const uncertain = result.confidence < 0.5;
  badge.dataset.state = uncertain ? 'uncertain' : 'ready';
  badge.textContent = `${uncertain ? 'Likely ' : ''}${LABELS[result.label]} · ${percentage}%`;
  badge.title = `Postglyph confidence: ${percentage}%. This measures how decisively Jev chose among categories, not verified accuracy. Model: ${result.model}.`;
  badge.style.cursor = '';
  badge.onclick = null;
  lastError = '';
}

async function processCard(card: Element): Promise<void> {
  if (!enabled || !card.isConnected) return;
  const badge = badgeFor(card);
  const post = extractPost(card);
  if (!post) {
    const state = cards.get(card)!;
    if (state.textKey === '__empty__') return;
    state.textKey = '__empty__';
    state.generation++;
    badge.dataset.state = 'empty';
    badge.textContent = 'No readable text';
    badge.title = 'Postglyph classifies text. This post has too little readable text.';
    return;
  }
  const state = cards.get(card)!;
  const textKey = JSON.stringify(post);
  if (state.textKey === textKey) return;
  state.textKey = textKey;
  const generation = ++state.generation;
  badge.dataset.state = 'loading';
  badge.textContent = 'Classifying…';
  badge.title = 'Postglyph is classifying this post.';
  try {
    const reply = await chrome.runtime.sendMessage({ type: 'classify', post });
    if (!enabled || !card.isConnected || cards.get(card)?.generation !== generation) return;
    if (reply?.error) throw new Error(reply.error);
    render(badge, reply.result);
  } catch (error) {
    if (!enabled || cards.get(card)?.generation !== generation) return;
    lastError = error instanceof Error ? error.message : 'Classification failed';
    badge.dataset.state = 'error';
    badge.textContent = 'Unavailable · retry';
    badge.title = lastError;
    badge.style.cursor = 'pointer';
    badge.onclick = () => { state.textKey = ''; void processCard(card); };
  }
}

const visibility = new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) void processCard(entry.target);
}, { rootMargin: '600px 0px' });

function scan(): void {
  if (!enabled || !location.pathname.startsWith('/feed')) return;
  for (const card of feedCards()) {
    badgeFor(card);
    visibility.observe(card);
    const bounds = card.getBoundingClientRect();
    if (bounds.bottom >= -600 && bounds.top <= window.innerHeight + 600) void processCard(card);
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null || (message as { type?: string }).type !== 'diagnostics') return false;
  scan();
  const found = feedCards();
  sendResponse({
    onFeed: location.hostname === 'www.linkedin.com' && location.pathname.startsWith('/feed'),
    enabled,
    cards: found.length,
    readable: found.filter((card) => extractPost(card) !== null).length,
    badges: document.querySelectorAll('.postglyph-badge').length,
    lastError
  });
  return false;
});

function scheduleScan(): void {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(scan, 150);
}

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.enabled) return;
  enabled = changes.enabled.newValue !== false;
  for (const badge of document.querySelectorAll<HTMLElement>('.postglyph-badge')) {
    badge.hidden = !enabled;
    if (!enabled) {
      const card = badge.closest(CARD_SELECTOR);
      const state = card && cards.get(card);
      if (state) { state.textKey = ''; state.generation++; }
    }
  }
  if (enabled) scheduleScan();
});

void chrome.storage.local.get('enabled').then((stored) => {
  enabled = stored.enabled !== false;
  if (enabled) scan();
}).catch(() => scan());

new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
