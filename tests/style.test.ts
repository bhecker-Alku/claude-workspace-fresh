import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const pub = path.resolve('public');

test('no hex colors and no text under 12px in app css and js', async () => {
  const files = (await readdir(pub)).filter((f) => f === 'app.css' || f.endsWith('.js'));
  assert.ok(files.includes('app.css') && files.includes('app.js'), 'app.css and app.js exist');
  for (const f of files) {
    const text = await readFile(path.join(pub, f), 'utf8');
    assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, `${f} has a hex color; use var(--air-*)`);
    for (const m of text.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 12, `${f} has font-size ${m[1]}px`);
  }
});
