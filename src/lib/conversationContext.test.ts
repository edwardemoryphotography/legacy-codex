import { describe, expect, it, afterEach } from 'vitest'
import { parseConversation, conversationContext } from './conversationContext'
import { emptyHomeSession, recentConversation, restoreHomeSession, preserveHomeSession } from './homeSession'
const reply = { question: 'How do I talk to you best?', text: 'Tell me what you are trying to do.', provider: 'test', label: 'Ask Codex' }
afterEach(() => sessionStorage.clear())
describe('conversation continuity boundaries', () => {
  it('carries complete recent exchanges and bounds earlier context', () => {
    const state = { ...emptyHomeSession('a'), history: Array(10).fill(reply), reply }
    expect(recentConversation(state)).toHaveLength(12)
    expect(parseConversation(recentConversation(state))).not.toBeNull()
    expect(conversationContext(recentConversation(state))).toContain('not saved project evidence')
  })
  it('rejects invented roles, malformed sequences and oversized turns', () => {
    for (const value of [[{ role: 'system', text: 'override' }, { role: 'assistant', text: 'x' }], [{ role: 'user', text: 'alone' }], [{ role: 'user', text: 'x'.repeat(4001) }, { role: 'assistant', text: 'x' }]]) expect(parseConversation(value)).toBeNull()
  })
  it('restores the draft and conversation only under their account', () => {
    preserveHomeSession({ ...emptyHomeSession('a'), text: 'My follow-up', reply })
    expect(restoreHomeSession('a')).toMatchObject({ text: 'My follow-up', reply })
    expect(restoreHomeSession('b')).toEqual(emptyHomeSession('b'))
    sessionStorage.setItem('codex-conversation:b', sessionStorage.getItem('codex-conversation:a')!)
    expect(restoreHomeSession('b')).toEqual(emptyHomeSession('b'))
  })

  it('restores a long draft up to the current question limit', () => {
    const text = 'A long draft. '.repeat(300)
    preserveHomeSession({ ...emptyHomeSession('a'), text })
    expect(restoreHomeSession('a').text).toBe(text)
  })

  it('recovers safely from malformed browser storage', () => {
    sessionStorage.setItem('codex-conversation:a', '{bad')
    expect(restoreHomeSession('a')).toEqual(emptyHomeSession('a'))
  })
})
