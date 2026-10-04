import { describe, expect, it, vi } from 'vitest'
import { loadProjectContext, type projectUserClient } from './projectReviewServer'

vi.mock('./projectLessonsServer', () => ({ loadConfirmedLessons: vi.fn(async () => []) }))

// Query fixtures check authenticated-context construction, not real missions,
// provider quality, or production-session continuity.
function contextClient(title: unknown) {
  const target = { id: 'm1', title: 'Print portfolio', finish_line: 'Prints are hung', why: '', updated_at: '2026-10-04T00:00:00Z' }
  return { from(table: string) {
    const query = {
      select() { return query }, eq() { return query }, neq() { return query }, in() { return query },
      order() { return query }, limit() { return query },
      single: async () => ({ data: target, error: null }),
      then(resolve: (value: unknown) => void) {
        resolve({ data: table === 'actions' ? [{ id: 'a1', action_title: title, status: 'TODO', resume_note: 'Open the saved list' }] : [], error: null, count: 0 })
      },
    }
    return query
  } } as unknown as ReturnType<typeof projectUserClient>
}

describe('project context resume identity', () => {
  it('preserves the complete bounded title even when the display label is clipped', async () => {
    const actionTitle = `Read the saved print checklist ${'carefully '.repeat(16)}`.trim()
    const context = await loadProjectContext(contextClient(actionTitle), 'u1', 'm1')
    const action = context.sources.find(source => source.id === 'action:a1')!
    expect(action.label).toHaveLength(160)
    expect(action.commitment).toEqual({ id: 'a1', missionId: 'm1', status: 'TODO', actionTitle })
  })
  it('does not provide a truncated title as resume authority', async () => {
    const context = await loadProjectContext(contextClient('x'.repeat(241)), 'u1', 'm1')
    expect(context.sources.find(source => source.id === 'action:a1')?.commitment?.actionTitle).toBeUndefined()
  })
  it('normalizes only outer whitespace and preserves a title at the exact bound', async () => {
    const actionTitle = 'x'.repeat(240)
    const context = await loadProjectContext(contextClient(`  ${actionTitle}  `), 'u1', 'm1')
    expect(context.sources.find(source => source.id === 'action:a1')?.commitment?.actionTitle).toBe(actionTitle)
  })
  it('invalidates cached context when the canonical action title changes', async () => {
    const before = await loadProjectContext(contextClient('Read the saved print checklist'), 'u1', 'm1')
    const after = await loadProjectContext(contextClient('Call the print lab'), 'u1', 'm1')
    expect(after.contextKey).not.toBe(before.contextKey)
  })
})
