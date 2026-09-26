import test from 'node:test';
import assert from 'node:assert/strict';
import { openMatterRoom, pickMatterTransition } from '../src/matter_workflow.js';

test('signed document delivery schedules a confirmation step in the matter room', () => {
  const result = pickMatterTransition({
    matterId: 'MAT-204',
    accountId: 'acct-9',
    clientId: 'client-22',
    sessionId: 'sess-1',
    matterType: 'signed-document',
    clientDisplayName: 'A. Rivera',
    summary: 'Settlement packet signed',
    signedDocumentId: 'doc-77'
  });

  assert.deepEqual(result, {
    channel: 'matter-MAT-204',
    event: 'matter.document.signed',
    nextAction: 'confirm-signed-document',
    tokenIssuedFor: 'client-22'
  });
});

test('channel creation failure stops publication and token issuance', async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.includes('/channel/create')) {
      return new Response(JSON.stringify({ ok: false, error: { code: 'CHANNEL_FAILED', message: 'channel creation failed' } }), { status: 422 });
    }
    return new Response(JSON.stringify({ ok: true, data: { valid: true } }), { status: 200 });
  };

  try {
    await assert.rejects(openMatterRoom({
      matterId: 'MAT-204',
      accountId: 'acct-9',
      clientId: 'client-22',
      sessionId: 'sess-1',
      matterType: 'signed-document',
      clientDisplayName: 'A. Rivera',
      summary: 'Settlement packet signed'
    }), { message: 'channel creation failed' });
    assert.equal(requests.length, 2);
    assert.match(requests[1], /\/channel\/create$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
