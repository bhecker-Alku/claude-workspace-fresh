import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanEnv } from '../src/auth.ts';

test('cleanEnv removes API key variables', () => {
  const out = cleanEnv({
    ANTHROPIC_API_KEY: 'a', ANTHROPIC_AUTH_TOKEN: 'b', CLAUDE_CODE_USE_BEDROCK: '1', CLAUDE_CODE_USE_VERTEX: '1', PATH: '/bin',
  });
  assert.deepEqual(out, { PATH: '/bin' });
});
