import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { interpretGeminiAuthStatus } from '../lib/geminiAuthStatus.ts';

describe('interpretGeminiAuthStatus', () => {
  it('treats authenticated:true as a live login regardless of live flag', () => {
    assert.equal(interpretGeminiAuthStatus({ authenticated: true, live: true }), 'authenticated');
    assert.equal(interpretGeminiAuthStatus({ authenticated: true, live: false }), 'authenticated');
    assert.equal(interpretGeminiAuthStatus({ authenticated: true }), 'authenticated');
  });

  it('clears cache only for a live unauthenticated response', () => {
    assert.equal(
      interpretGeminiAuthStatus({ authenticated: false, live: true, available: true }),
      'unauthenticated'
    );
  });

  it('does not treat static-export or failed probes as logout', () => {
    assert.equal(
      interpretGeminiAuthStatus({ authenticated: false, live: false, available: false }),
      'unknown'
    );
    assert.equal(interpretGeminiAuthStatus({ authenticated: false, available: false }), 'unknown');
    assert.equal(interpretGeminiAuthStatus({ available: false }), 'unknown');
    assert.equal(interpretGeminiAuthStatus(null), 'unknown');
    assert.equal(interpretGeminiAuthStatus(undefined), 'unknown');
  });
});
