import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('adds a category badge to a newer LinkedIn feed card', async () => {
  const dom = new JSDOM(`<main data-testid="mainFeed"><div role="listitem">
    <div class="obfuscated-actor">Bela · 2nd</div>
    <div data-testid="expandable-text-box">Applications for the fellowship close on Friday.</div>
  </div></main>`, { url: 'https://www.linkedin.com/feed/' });
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).location = dom.window.location;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  (globalThis as any).MutationObserver = class { observe() {} };
  (globalThis as any).IntersectionObserver = class { observe() {} };
  let diagnostics: ((message: unknown, sender: unknown, respond: (result: unknown) => void) => boolean) | undefined;
  (globalThis as any).chrome = {
    storage: { local: { get: async () => ({ enabled: true }) }, onChanged: { addListener() {} } },
    runtime: {
      sendMessage: async () => ({ result: { label: 'opportunity', confidence: 0.88, model: 'jev-test' } }),
      onMessage: { addListener(listener: typeof diagnostics) { diagnostics = listener; } }
    }
  };

  await import('../src/extension/content.js');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.match(dom.window.document.querySelector('.postglyph-badge')?.textContent || '', /Opportunity.*88%/);
  let page: any;
  diagnostics?.({ type: 'diagnostics' }, {}, (result) => { page = result; });
  assert.equal(page.cards, 1);
  assert.equal(page.readable, 1);
  assert.equal(page.badges, 1);
  dom.window.close();
});
