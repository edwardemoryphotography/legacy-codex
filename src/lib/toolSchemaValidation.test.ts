import { describe, expect, it } from 'vitest'
import { validateToolInput } from './toolSchemaValidation'

const schema = {
  type: 'object', additionalProperties: false,
  required: ['decision', 'operation', 'workDraft'],
  properties: {
    decision: { type: 'string', enum: ['act', 'resume', 'clarify'] },
    operation: { anyOf: [{ type: 'string', maxLength: 10 }, { type: 'null' }] },
    workDraft: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    alternatives: { type: 'array', maxItems: 2, items: {
      type: 'object', additionalProperties: false, required: ['operation'],
      properties: { operation: { type: 'string' } },
    } },
  },
}

describe('validateToolInput', () => {
  it('accepts a complete value', () => {
    expect(validateToolInput({ decision: 'act', operation: null, workDraft: 'draft' }, schema)).toBeNull()
  })

  it('rejects a missing required key', () => {
    expect(validateToolInput({ decision: 'act', workDraft: null }, schema)).toContain('required')
  })

  it('rejects an unknown top-level key', () => {
    expect(validateToolInput({ decision: 'act', operation: 'x', workDraft: null, extra: 1 }, schema)).toContain('not allowed')
  })

  it('rejects a wrong primitive type', () => {
    expect(validateToolInput({ decision: 3, operation: 'x', workDraft: null }, schema)).toContain('string')
  })

  it('enforces enum membership', () => {
    expect(validateToolInput({ decision: 'invent', operation: 'x', workDraft: null }, schema)).toContain('allowed value')
  })

  it('enforces length bounds inside anyOf', () => {
    expect(validateToolInput({ decision: 'act', operation: 'this is far too long', workDraft: null }, schema)).toContain('too long')
  })

  it('validates nested array items', () => {
    const bad = { decision: 'act', operation: null, workDraft: null, alternatives: [{ whyNot: 'no operation' }] }
    expect(validateToolInput(bad, schema)).toContain('required')
  })

  it('enforces maxItems', () => {
    const bad = { decision: 'act', operation: null, workDraft: null,
      alternatives: [{ operation: 'a' }, { operation: 'b' }, { operation: 'c' }] }
    expect(validateToolInput(bad, schema)).toContain('too many items')
  })

  it('names paths only, never values', () => {
    const error = validateToolInput({ decision: 'secret-value', operation: null, workDraft: null }, schema)
    expect(error).not.toContain('secret-value')
  })
})
