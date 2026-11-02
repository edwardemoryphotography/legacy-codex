import { test } from 'node:test'
import assert from 'node:assert/strict'
import { briefModelTier } from '../src/lib/modelPreference.ts'

test('ordinary questions default to Economy, regardless of their wording', () => {
  assert.equal(briefModelTier('question', undefined), 'routine')
  assert.equal(briefModelTier('question', 'routine'), 'routine')
})
test('Deep requires an explicit choice for questions', () => {
  assert.equal(briefModelTier('question', 'deep'), 'deep')
  for (const value of [null, '', 'auto', 'opus', true, {}, ['deep']]) assert.equal(briefModelTier('question', value), null)
})
test('existing explicit specialist tools retain their default tier', () => {
  assert.equal(briefModelTier('daily_brief', undefined), 'routine')
  assert.equal(briefModelTier('triage', undefined), 'routine')
  assert.equal(briefModelTier('architect', undefined), 'deep')
  assert.equal(briefModelTier('unblock', undefined), 'deep')
  assert.equal(briefModelTier('architect', 'routine'), 'routine')
})
