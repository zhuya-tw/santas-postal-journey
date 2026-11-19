import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matches} from '../site/app.mjs';

const data = JSON.parse(readFileSync(new URL('../site/data/catalog.json', import.meta.url)));
const canada = data.offices.find(office => office.id === 'ca');
const finland = data.offices.find(office => office.id === 'fi');

test('search by multilingual names, postcodes and multiple terms', () => {
  assert(matches(canada, canada.seasons['2026'], '加拿大 Ｈ０Ｈ', 'program'));
  assert(matches(finland, finland.seasons['2026'], 'POSTI 96930', 'occasional'));
  assert(!matches(finland, finland.seasons['2026'], 'POSTI 96930', 'program'));
});

test('missing seasons never expose an older address through search', () => {
  assert(matches(canada, undefined, '加拿大', ''));
  assert(!matches(canada, undefined, 'H0H', ''));
  assert(!matches(canada, undefined, '加拿大', 'program'));
});
