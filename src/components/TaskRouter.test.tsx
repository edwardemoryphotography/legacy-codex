import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import TaskRouter from './TaskRouter'
import type { NextMoveContext } from '@/types'

const context: NextMoveContext = { mission: null, missionStatus: 'unavailable', evidence: [], evidenceStatus: 'unavailable' }
const intent = 'Implement the Codex Control Panel design and task-routing experience into Legacy Codex Strategic Delta, preserving project context, evidence, corrections, and pause/reload/resume continuity.'
const props = { context, accountId: null, seed: null, canSave: false, onPrepare: () => {} }
afterEach(cleanup)

describe('TaskRouter with real supplied intent and unavailable account context', () => {
  it('engages the spectrum immediately on focus and settles when focus leaves', () => {
    render(<TaskRouter {...props} />)
    const input = screen.getByRole('textbox', { name: 'Task to route' })
    fireEvent.focus(input)
    expect(input.closest('.route-composer')?.getAttribute('data-engaged')).toBe('true')
    fireEvent.blur(input)
    expect(input.closest('.route-composer')?.getAttribute('data-engaged')).toBeNull()
  })

  it('keeps actual typed intent when speech recognition is unavailable', () => {
    render(<TaskRouter {...props} />)
    const input = screen.getByRole('textbox', { name: 'Task to route' })
    fireEvent.change(input, { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }))
    expect(screen.getByText(/Voice input is not available in this browser/)).not.toBeNull()
    expect((input as HTMLTextAreaElement).value).toBe(intent)
    expect(screen.getByRole('button', { name: 'Start voice input' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
  })
  it('prepares a handoff without pretending an unavailable mission or tool has run', () => {
    render(<TaskRouter {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Task to route' }), { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain('Status: not started')
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain('Mission read: unavailable')
    expect(screen.queryByRole('button', { name: 'Prepare saved action' })).toBeNull()
  })

  it('never revives an invalidated route after editing the task back', () => {
    render(<TaskRouter {...props} />)
    const input = screen.getByRole('textbox', { name: 'Task to route' })
    fireEvent.change(input, { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    fireEvent.change(input, { target: { value: 'Proceed' } })
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
    fireEvent.change(input, { target: { value: intent } })
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
  })

  it('invalidates on changed context and keeps the human draft intact', () => {
    const { rerender } = render(<TaskRouter {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Task to route' }), { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    rerender(<TaskRouter {...props} context={{ ...context, missionStatus: 'loading' }} />)
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
    expect((screen.getByRole('textbox', { name: 'Task to route' }) as HTMLTextAreaElement).value).toBe(intent)
    rerender(<TaskRouter {...props} />)
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
  })

  it('applies the chosen correction and explicitly describes session-only learning', () => {
    render(<TaskRouter {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Task to route' }), { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Correct routing lane' }), { target: { value: 'architecture' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use this lane' }))
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain('Plan & architecture')
    expect(screen.getByRole('status', { name: 'Routing status' }).textContent).toContain('Correction applied for this session')
  })

  it('invalidates a handoff when human project context or a Delta correction changes', () => {
    const { rerender } = render(<TaskRouter {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Task to route' }), { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    // Eddie's actual correction of the product direction in this session.
    const note = 'I feel like we’ve gotten too far away from this.'
    rerender(<TaskRouter {...props} context={{ ...context, contextNotes: [note] }} />)
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain(note)
    rerender(<TaskRouter {...props} context={{ ...context, contextNotes: [note], corrections: [{ correctedMove: intent, reason: note }] }} />)
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
  })
})
