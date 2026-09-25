import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { makeHttpServer } from '../src/server/http.js';
import type { Classifier } from '../src/server/classifier.js';

const classify: Classifier = async () => ({
  label: 'hiring', confidence: 0.84, model: 'jev-test',
  probabilities: { hiring: 0.9, opportunity: 0.1, career_update: 0, advice_learning: 0, news_announcement: 0, promotion: 0, conversation: 0, other: 0 }
});

test('helper checks its token and post input before returning a typed result', async () => {
  const server = makeHttpServer(classify, 'test-token');
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const url = `http://127.0.0.1:${address.port}/classify`;
  try {
    const health = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(health.status, 200);
    const rejectedToken = await fetch(`http://127.0.0.1:${address.port}/auth`, { headers: { Authorization: 'Bearer stale-token' } });
    assert.equal(rejectedToken.status, 401);
    const acceptedToken = await fetch(`http://127.0.0.1:${address.port}/auth`, { headers: { Authorization: 'Bearer test-token' } });
    assert.equal(acceptedToken.status, 200);

    const unauthorized = await fetch(url, { method: 'POST', body: '{}' });
    assert.equal(unauthorized.status, 401);

    const invalid = await fetch(url, {
      method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: JSON.stringify({ text: 'Too short' })
    });
    assert.equal(invalid.status, 400);

    const valid = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', Origin: 'chrome-extension://example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'We are hiring a backend engineer. Apply here.' })
    });
    assert.equal(valid.status, 200);
    assert.equal(valid.headers.get('access-control-allow-origin'), 'chrome-extension://example');
    assert.deepEqual(await valid.json(), await classify({ text: '' }));
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  }
});
