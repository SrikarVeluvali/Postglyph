import { normalizeText, type PostInput } from '../shared/taxonomy.js';

const BODY_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '[data-test-id="expandable-text-box"]',
  '[data-test-id="main-feed-activity-card__commentary"]',
  '.update-components-text',
  '.feed-shared-update-v2__description',
  '.feed-shared-text',
  '.attributed-text-segment-list__content',
  '.feed-shared-inline-show-more-text'
];
const AUTHOR_SELECTOR = '.update-components-actor__name, .feed-shared-actor__name';
const REPOST_SELECTOR = '.feed-shared-update-v2__reshared-update .update-components-text';
const FALLBACK_SELECTOR = '.break-words, [data-test-id="main-feed-activity-card"] span[dir="ltr"], span[dir="ltr"]';
const EXCLUDED_SELECTOR = '.update-components-actor, .feed-shared-actor, .comments-comment-item, .comments-comment-entity, button, nav, .postglyph-badge';

function visibleText(element: Element | null): string {
  if (!(element instanceof HTMLElement)) return '';
  return normalizeText((element.innerText ?? element.textContent ?? '').replace(/(?:…|\.\.\.)\s*see more\s*$/i, ''));
}

export function extractPost(card: Element): PostInput | null {
  const body = BODY_SELECTORS.map((selector) => card.querySelector(selector)).find((element) => visibleText(element).length >= 15)
    ?? Array.from(card.querySelectorAll(FALLBACK_SELECTOR))
      .filter((element) => !element.closest(EXCLUDED_SELECTOR))
      .sort((a, b) => visibleText(b).length - visibleText(a).length)
      .find((element) => visibleText(element).length >= 15);
  if (!body) return null;
  const text = visibleText(body);
  if (text.length < 15) return null;
  const author = visibleText(card.querySelector(AUTHOR_SELECTOR));
  const repost = card.querySelector(REPOST_SELECTOR);
  const repostText = repost && !body.contains(repost) ? visibleText(repost) : '';
  return { text: text.slice(0, 12_000), author: author.slice(0, 300), repostText: repostText.slice(0, 12_000) };
}
