/** @vitest-environment jsdom */
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Mission, MissionState } from '@/types'
import StrategicDelta from './StrategicDelta'

function mission(over: Partial<Mission> & { id: string; state: MissionState }): Mission {
  return {
    title: `Mission ${over.id}`,
    why: '',
    finishLine: null,
    evidenceRequirement: null,
    blocker: null,
    capacityMismatch: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  }
}

function renderDelta(missions: Mission[], overrides: Partial<React.ComponentProps<typeof StrategicDelta>> = {}) {
  const props = {
    missions,
    evidence: [],
    corrections: [],
    phase: 'resolved' as const,
    acceptedMove: null,
    persistError: null,
    onAccept: vi.fn(),
    onCorrect: vi.fn(),
    onContextAdded: vi.fn(),
    onRecheck: vi.fn(),
    ...overrides,
  }
  render(<StrategicDelta {...props} />)
  return props
}

// A compound finish line, because that is the shape the engine aims at:
// one part at a time rather than the whole outcome restated.
const PRIMARY = mission({
  id: 'm1',
  state: 'primary',
  title: 'Ship the Strategic Delta',
  finishLine: 'lands on main, deploys to Vercel, and answers without prompting',
})
const PRIMARY_FIRST_MOVE = 'Verify this part of your finish line: “lands on main”'

describe('StrategicDelta', () => {
  it('shows a reasoning state, not a prediction, while the read is still pending', () => {
    renderDelta([PRIMARY], { phase: 'orienting' })

    const region = screen.getByLabelText('Strategic Delta')
    expect(region.getAttribute('aria-busy')).toBe('true')
    expect(region.getAttribute('data-state')).toBe('reasoning')
    // Nothing may be asserted as a prediction before the state is read.
    expect(screen.queryByText(/Verify this part of your finish line/)).toBeNull()
  })

  it('resolves to one move, marked as predicted from real state', async () => {
    renderDelta([PRIMARY])

    expect(await screen.findByText(/Verify this part of your finish line/)).toBeTruthy()
    const region = screen.getByLabelText('Strategic Delta')
    expect(region.getAttribute('data-state')).toBe('resolved')
    expect(region.getAttribute('data-provenance')).toBe('deterministic')
    expect(screen.getByText('Predicted from your mission state')).toBeTruthy()
  })

  // §30 — the UI must never let insufficient context read as intelligence.
  it('marks an empty state as insufficient context and offers nothing to accept', async () => {
    renderDelta([])

    expect(await screen.findByText(/Name the one outcome that matters most/)).toBeTruthy()
    expect(screen.getByLabelText('Strategic Delta').getAttribute('data-provenance')).toBe('insufficient_context')
    expect(screen.getByText('Not enough state to predict from')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Do this' })).toBeNull()
    // Nothing to correct when nothing was predicted.
    expect((screen.getByRole('button', { name: 'Not right' }) as HTMLButtonElement).disabled).toBe(true)
    // Live region stays on the move copy, never on the section — wrapping
    // inputs in aria-live intercepts focus/typing on Safari/iOS.
    expect(screen.getByLabelText('Strategic Delta').getAttribute('aria-live')).toBeNull()
    expect(screen.getByText(/Name the one outcome that matters most/).getAttribute('aria-live')).toBe('polite')
  })

  it('renders insufficient-context children as editable labeled fields that accept typing', async () => {
    function Invite() {
      const [outcome, setOutcome] = useState('')
      const [finish, setFinish] = useState('')
      return (
        <form>
          <label htmlFor="mission-outcome">The outcome that matters most</label>
          <input
            id="mission-outcome"
            value={outcome}
            onChange={event => setOutcome(event.target.value)}
          />
          <label htmlFor="mission-finish">The finish line that ends it</label>
          <input
            id="mission-finish"
            value={finish}
            onChange={event => setFinish(event.target.value)}
          />
          <button type="submit" disabled={!outcome.trim() || !finish.trim()}>
            This is what matters
          </button>
        </form>
      )
    }

    renderDelta([], { children: <Invite /> })

    const outcome = await screen.findByLabelText('The outcome that matters most')
    const finish = screen.getByLabelText('The finish line that ends it')
    expect(outcome.tagName).toBe('INPUT')
    expect(finish.tagName).toBe('INPUT')
    expect((outcome as HTMLInputElement).disabled).toBe(false)
    expect((finish as HTMLInputElement).disabled).toBe(false)

    fireEvent.change(outcome, { target: { value: 'Runtime interaction check' } })
    fireEvent.change(finish, { target: { value: 'Both fields accept real input' } })

    expect((outcome as HTMLInputElement).value).toBe('Runtime interaction check')
    expect((finish as HTMLInputElement).value).toBe('Both fields accept real input')
    expect((screen.getByRole('button', { name: 'This is what matters' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not render missing-input children once a mission exists to predict from', async () => {
    renderDelta([PRIMARY], {
      children: <input aria-label="The outcome that matters most" />,
    })

    expect(await screen.findByText(/Verify this part of your finish line/)).toBeTruthy()
    expect(screen.queryByLabelText('The outcome that matters most')).toBeNull()
  })

  // §23 — provenance, not a hidden reasoning trace.
  it('shows structured provenance and the inhibited alternatives behind Why?', async () => {
    renderDelta([
      mission({ id: 'm1', state: 'primary', title: 'Ship it', finishLine: 'Live', blocker: 'Waiting on Vaughn' }),
      mission({ id: 'm2', state: 'secondary', title: 'Write the docs', finishLine: 'drafts the page, and gets a review' }),
    ])

    fireEvent.click(await screen.findByRole('button', { name: 'Why?' }))

    expect(screen.getByText('Current reality')).toBeTruthy()
    expect(screen.getByText('Blocking gap')).toBeTruthy()
    expect(screen.getByText('Alternatives inhibited')).toBeTruthy()
    expect(screen.getByText('What would change this')).toBeTruthy()
    // Every alternative that lost is named, each with the reason it lost —
    // including the paraphrase the engine rejects on quality.
    const trace = document.querySelectorAll('.sd-trace li')
    const traceText = [...trace].map(li => li.textContent ?? '')
    expect(traceText.some(t => /drafts the page/.test(t) && /Lower leverage/.test(t))).toBe(true)
    expect(traceText.some(t => /restates the mission/.test(t))).toBe(true)
  })

  it('shows which part of the finish line it is aiming at, and which parts were ruled out', async () => {
    renderDelta([PRIMARY])

    fireEvent.click(await screen.findByRole('button', { name: 'Why?' }))

    expect(screen.getByText('What your finish line asks you to prove')).toBeTruthy()
    const steps = [...document.querySelectorAll('.sd-steps li')].map(li => li.textContent ?? '')
    expect(steps).toHaveLength(3)
    expect(steps[0]).toContain('lands on main')
    expect(steps[0]).toContain('aiming here')
    // The parts it is not aiming at are listed without being recommended.
    expect(steps[2]).toContain('answers without prompting')
    expect(steps[2]).not.toContain('aiming here')
  })

  // §15 — correction is a first-class interaction, and it re-predicts.
  it('records a correction and immediately predicts something else', async () => {
    const props = renderDelta([
      mission({ id: 'm1', state: 'primary', title: 'Ship it', finishLine: 'Live', blocker: 'Waiting on Vaughn' }),
      mission({ id: 'm2', state: 'secondary', title: 'Write the docs', finishLine: 'Merged' }),
    ])

    const firstMove = (await screen.findByText(/Clear what's blocking/)).textContent ?? ''

    fireEvent.click(screen.getByRole('button', { name: 'Not right' }))
    fireEvent.change(screen.getByLabelText(/isn't right/i), { target: { value: 'Vaughn is out; Beau is available' } })
    fireEvent.click(screen.getByRole('button', { name: 'Teach it this' }))

    expect(props.onCorrect).toHaveBeenCalledWith(
      expect.objectContaining({ move: firstMove, missionId: 'm1' }),
      'Vaughn is out; Beau is available',
    )
  })

  it('accepting records agreement without claiming the work is done', async () => {
    const props = renderDelta([PRIMARY])

    fireEvent.click(await screen.findByRole('button', { name: 'Do this' }))
    expect(props.onAccept).toHaveBeenCalledWith(expect.objectContaining({ missionId: 'm1' }))
  })

  it('shows an accepted move as still unproven', async () => {
    renderDelta([PRIMARY], { acceptedMove: PRIMARY_FIRST_MOVE })

    expect(await screen.findByText(/still a prediction until there's evidence/i)).toBeTruthy()
  })

  it('says plainly that a note alone will not move the prediction', async () => {
    renderDelta([PRIMARY])

    fireEvent.click(await screen.findByRole('button', { name: 'Something changed' }))
    expect(screen.getByText(/won't move the\s+prediction/)).toBeTruthy()
  })

  it('presents a persistence failure as a failure, not a recording', async () => {
    renderDelta([PRIMARY], {
      persistError: 'Could not record that against your history — it was not saved.',
    })

    expect((await screen.findByRole('alert')).textContent).toMatch(/not saved/)
    expect(screen.getByLabelText('Strategic Delta').getAttribute('data-cognition')).toBe('failed')
  })

  it('keeps a recorded correction visible as something the system learned', async () => {
    renderDelta([PRIMARY], {
      corrections: [{
        id: 'c1',
        missionId: 'm1',
        correctedMove: 'A previous move',
        reason: 'Vaughn is out; Beau is available',
        createdAt: '2026-09-01T00:00:00.000Z',
      }],
    })

    expect(await screen.findByText(/You taught it: Vaughn is out; Beau is available/)).toBeTruthy()
  })
})
