import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {airmailCutoff, cutoffStatus, matches, pickRecommendation, sortByCutoff} from '../site/app.mjs';

const data = JSON.parse(readFileSync(new URL('../site/data/catalog.json', import.meta.url)));
const canada = data.offices.find(office => office.id === 'ca');
const finland = data.offices.find(office => office.id === 'fi');

test('recommendations use the selected year and avoid repeating eligible addresses', () => {
  const uncertain = {id: 'uncertain', seasons: {'2026': {address: ['Pending'], addressNote: '待確認'}}};
  assert.equal(pickRecommendation([uncertain, canada, finland], '2026', 'ca', () => 0), finland);
  assert.equal(pickRecommendation([canada], '2026', 'ca', () => 0), canada);
  assert.equal(pickRecommendation([uncertain], '2026', undefined, () => 0), undefined);
  assert.equal(pickRecommendation([canada], '2027', undefined, () => 0), undefined);
});

test('sorts upcoming cutoffs first and optionally shows expired dates after unknown dates', () => {
  const country = (id, cutoffRegion) => ({id, cutoffRegion});
  const later = country('later', 'future');
  const unknown = country('unknown', 'unknown');
  const older = country('older', 'older');
  const today = country('today', 'today');
  const recent = country('recent', 'recent');
  const tied = country('tied', 'future');
  const offices = [later, older, tied, unknown, today, recent];
  const taiwan = {rows: [['future', '11-25'], ['today', '11-23'], ['recent', '11-22'], ['older', '11-19']]};
  const now = new Date('2026-11-22T16:00:00Z');
  assert.deepEqual(sortByCutoff(offices, taiwan, '2026', false, now), [today, later, tied, unknown]);
  assert.deepEqual(sortByCutoff(offices, taiwan, '2026', true, now), [today, later, tied, unknown, recent, older]);
  assert.deepEqual(sortByCutoff(offices, undefined, '2027', false, now), offices);
});

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
