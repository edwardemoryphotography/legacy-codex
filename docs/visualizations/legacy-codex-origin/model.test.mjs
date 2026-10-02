import test from 'node:test';
import assert from 'node:assert/strict';
import { clampIndex, visibleDomains, findMilestones, nextIndex, parseChapter } from './model.mjs';

// Synthetic test records, never shipped as historical content.
const milestones = [
  { id: 'origin', title: 'An original idea', summary: 'A documented framework', meaning: 'Continuity', domains: ['codex', 'doctrine'] },
  { id: 'build', title: 'Foundry', summary: 'An execution interface', meaning: 'Translate intent', domains: ['foundry', 'agents'] },
  { id: 'learn', title: 'Learning', summary: 'Human confirmation', meaning: 'Evidence informs action', domains: ['codex', 'evidence'] },
];

test('timeline clamps invalid and out-of-range positions', () => {
  assert.equal(clampIndex(-9, 3), 0);
  assert.equal(clampIndex(99, 3), 2);
  assert.equal(clampIndex(NaN, 3), 0);
  assert.equal(clampIndex(1.7, 3), 1);
});

test('a historical frame never reveals domains from future chapters', () => {
  assert.deepEqual(visibleDomains(milestones, 0), ['codex', 'doctrine']);
  assert.deepEqual(visibleDomains(milestones, 1), ['codex', 'doctrine', 'foundry', 'agents']);
});

test('search is case insensitive and can narrow by domain', () => {
  assert.deepEqual(findMilestones(milestones, 'HUMAN').map(m => m.id), ['learn']);
  assert.deepEqual(findMilestones(milestones, '', 'codex').map(m => m.id), ['origin', 'learn']);
  assert.deepEqual(findMilestones(milestones, 'unrecorded'), []);
});

test('playback stops at the last chapter instead of inventing a future', () => {
  assert.deepEqual(nextIndex(1, 3), { index: 2, ended: false });
  assert.deepEqual(nextIndex(2, 3), { index: 2, ended: true });
});

test('deep links resolve stable chapter IDs and tolerate unknown links', () => {
  assert.equal(parseChapter('#chapter=build', milestones), 1);
  assert.equal(parseChapter('#chapter=not-real', milestones), 2);
  assert.equal(parseChapter('#chapter=%E0%A4%A', milestones), 2);
});
