// Security/attribution checks use the actual canonical source URLs and Codex
// corpus. No fabricated projects, provider responses, or auth/data doubles.
import { describe, expect, it } from 'vitest'
import { GOOSE_COOKBOOK_SOURCE } from './cognitiveDoctrine'
import { findEntryById } from '@/data/codex'
import { githubFileReference, sourceLinks, boundSourceText } from './projectReview'

describe('project source boundary', () => {
  it('resolves the actual pinned Cookbook to a fixed GitHub file request', () => {
    expect(githubFileReference(GOOSE_COOKBOOK_SOURCE.revisionUrl)).toEqual({
      owner: 'edwardemoryphotography', repository: 'codex-system-architecture',
      ref: 'df5c24c04856bdd31338ab62713d236f7c4542e7', path: 'notion-wiki/docs/GOOSE-COOKBOOK.md',
    })
  })

  it('rejects credential-bearing and non-GitHub variants of the real source', () => {
    const credential = new URL(GOOSE_COOKBOOK_SOURCE.url)
    credential.username = 'edwardemoryphotography'
    expect(githubFileReference(credential.toString())).toBeNull()
    const outside = new URL(GOOSE_COOKBOOK_SOURCE.url)
    outside.hostname = 'supabase.com'
    expect(githubFileReference(outside.toString())).toBeNull()
  })

  it('extracts the real reference links once, including the pinned revision', () => {
    const entry = findEntryById('root.north-star')!
    expect(sourceLinks(`${entry.content}\n${entry.content}`)).toEqual([
      GOOSE_COOKBOOK_SOURCE.url, GOOSE_COOKBOOK_SOURCE.revisionUrl,
    ])
  })

  it('marks bounded source text as truncated instead of silently claiming completeness', () => {
    const entry = findEntryById('root.north-star')!
    const result = boundSourceText(entry.content, 100)
    expect(result.text.length).toBeLessThanOrEqual(100)
    expect(result.truncated).toBe(true)
    expect(result.text).toBe(entry.content.slice(0, 100))
    expect(boundSourceText(entry.content, entry.content.length).truncated).toBe(false)
  })
})
