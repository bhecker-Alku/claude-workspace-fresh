import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cleanBrand, importBrand, pickColors, readBrand, removeBrand, saveBrand } from '../src/brand.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('only safe brand fields are kept', () => {
  assert.deepEqual(cleanBrand({ name: '  Acme  ', accent: '#ff6600', ink: 'red', logo: 'javascript:alert(1)', extra: 1 }), { name: 'Acme', accent: '#FF6600' });
  assert.deepEqual(cleanBrand({ logo: PNG }), { logo: PNG });
  assert.deepEqual(cleanBrand({ logo: 'data:text/html;base64,PHNjcmlwdD4=' }), {});
});

test('save, read, then remove branding brings back the default', async () => {
  const d = await mkdtemp(path.join(os.tmpdir(), 'ws-brand-'));
  assert.deepEqual(await readBrand(d), {});
  await saveBrand(d, { name: 'Acme', accent: '#FF6600' });
  assert.deepEqual(await readBrand(d), { name: 'Acme', accent: '#FF6600' });
  await removeBrand(d);
  assert.deepEqual(await readBrand(d), {});
  await removeBrand(d); // removing twice is fine
});

test('colors: theme-color wins; otherwise the most used strong color; ink is the most used near-black', () => {
  assert.deepEqual(pickColors('a{color:#ff6600}', '#0055aa').accent, '#0055AA');
  const css = '.a{color:#eeeeee}.b{color:#eeeeee}.c{background:#ff6600}.d{color:#ff6600}.e{color:#111111}.f{color:#111111}.g{color:#00aa55}';
  assert.deepEqual(pickColors(css), { accent: '#FF6600', ink: '#111111' });
  assert.equal(pickColors(':root{--brand-primary: rgb(10, 120, 200)} .x{color:#ff0000}').accent, '#0A78C8');
});

test('importing a site reads its name, logo and colors without saving', async () => {
  const pages: Record<string, () => Response> = {
    'https://acme.test/': () => new Response(`<html><head><title>Acme Rockets | Home</title><meta name="theme-color" content="#0055aa">
      <link rel="stylesheet" href="/s.css"><link rel="icon" href="/fav.png"></head><body><img class="site-logo" src="/logo.png"></body></html>`),
    'https://acme.test/s.css': () => new Response('body{color:#111111}h1{color:#111111}'),
    'https://acme.test/logo.png': () => new Response(Buffer.from('iVBO', 'base64'), { headers: { 'content-type': 'image/png' } }),
  };
  const fake: any = async (u: string) => (pages[u] ?? (() => new Response('nope', { status: 404 })))();
  const b = await importBrand('acme.test', fake);
  assert.equal(b.name, 'Acme Rockets');
  assert.equal(b.accent, '#0055AA');
  assert.equal(b.ink, '#111111');
  assert.match(b.logo ?? '', /^data:image\/png;base64,/);
  assert.equal(b.source, 'https://acme.test/');
  await assert.rejects(importBrand('ftp://acme.test', fake), /http/);
  pages['https://home.test/'] = () => new Response('<title>Home \\ Acme</title>');
  assert.equal((await importBrand('home.test', fake)).name, 'Acme');
});
