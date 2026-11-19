import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {airmailCutoff, cutoffStatus, matches} from '../site/app.mjs';

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

test('cards use the selected year and Christmas letter column', () => {
  assert.equal(airmailCutoff(canada, data.taiwan['2026'], '2026'), '2026-11-20');
  assert.equal(airmailCutoff(canada, data.taiwan['2025'], '2025'), '2025-11-21');
  assert.equal(airmailCutoff(finland, data.taiwan['2026'], '2026'), '2026-11-24');
  assert.equal(airmailCutoff(data.offices.find(office => office.id === 'at'), data.taiwan['2026'], '2026'), null);
  assert.equal(airmailCutoff(canada, undefined, '2027'), null);
});

test('countdown rolls over at midnight in Taiwan and labels past seasons', () => {
  const deadline = '2026-11-20';
  assert.equal(cutoffStatus(deadline, new Date('2026-11-19T15:59:59Z')), '還有 1 天');
  assert.equal(cutoffStatus(deadline, new Date('2026-11-19T16:00:00Z')), '今天截郵');
  assert.equal(cutoffStatus(deadline, new Date('2026-11-20T16:00:00Z')), '已過 1 天');
  assert.equal(cutoffStatus('2025-11-21', new Date('2026-11-19T16:00:00Z')), '歷年資料');
});
