import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { extractPost } from '../src/extension/post.js';

test('extracts the post body and author without comments or controls', () => {
  const dom = new JSDOM(`<div class="occludable-update">
    <div class="update-components-actor"><span class="update-components-actor__name">Ada</span></div>
    <div class="update-components-text">We are hiring a backend engineer. Apply here.</div>
    <div class="comments">This is a comment about another job.</div>
    <button>Like</button>
  </div>`);
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  const card = dom.window.document.querySelector('.occludable-update')!;
  assert.deepEqual(extractPost(card), { text: 'We are hiring a backend engineer. Apply here.', author: 'Ada', repostText: '' });
});

test('does not classify a media-only post or short preview', () => {
  const dom = new JSDOM('<div class="occludable-update"><div class="update-components-text">Photo</div></div>');
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  assert.equal(extractPost(dom.window.document.querySelector('div')!), null);
});

test('extracts commentary from a newer activity card without old feed classes', () => {
  const dom = new JSDOM(`<div data-id="urn:li:activity:123" data-finite-scroll-hotkey-item>
    <div class="update-components-actor"><span class="update-components-actor__name">Bela</span></div>
    <div data-test-id="main-feed-activity-card"><span dir="ltr" class="break-words">Applications for the fellowship close on Friday.</span></div>
    <div class="comments-comment-entity"><span dir="ltr">Unrelated comment about hiring.</span></div>
  </div>`);
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  const card = dom.window.document.querySelector('[data-id]')!;
  assert.deepEqual(extractPost(card), { text: 'Applications for the fellowship close on Friday.', author: 'Bela', repostText: '' });
});

test('extracts SDUI feed text from its stable test id', () => {
  const dom = new JSDOM('<div role="listitem"><div data-testid="expandable-text-box">We are hiring a design engineer. Apply now.</div></div>');
  (globalThis as any).HTMLElement = dom.window.HTMLElement;
  assert.deepEqual(extractPost(dom.window.document.querySelector('[role="listitem"]')!), {
    text: 'We are hiring a design engineer. Apply now.', author: '', repostText: ''
  });
});
