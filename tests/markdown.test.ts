import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain browser module
import { markdown } from '../public/markdown.js';

test('escapes html before formatting', () => {
  assert.equal(markdown('<img src=x onerror=alert(1)> **hi**'), '<p>&lt;img src=x onerror=alert(1)&gt; <strong>hi</strong></p>');
});
test('lists and links', () => {
  assert.equal(markdown('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
  assert.match(markdown('[x](javascript:alert(1))'), /^<p>\[x\]/);
});
