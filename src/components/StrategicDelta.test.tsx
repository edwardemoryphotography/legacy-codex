/** @vitest-environment jsdom */
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

const PRIMARY = mission({
  id: 'm1',
  state: 'primary',
  title: 'Ship the Strategic Delta',
  finishLine: 'Live on legacy-codex.vercel.app',
})

describe('StrategicDelta', () => {
  it('shows a reasoning state, not a prediction, while the read is still pending', () => {
    renderDelta([PRIMARY], { phase: 'orienting' })

    const region = screen.getByLabelText('Strategic Delta')
    expect(region.getAttribute('aria-busy')).toBe('true')
    expect(region.getAttribute('data-state')).toBe('reasoning')
    // Nothing may be asserted as a prediction before the state is read.
    expect(screen.queryByText(/Ship the Strategic Delta/)).toBeNull()
  })

  it('resolves to one move, marked as predicted from real state', async () => {
    renderDelta([PRIMARY])

    expect(await screen.findByText(/Move “Ship the Strategic Delta” toward/)).toBeTruthy()
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
  })

  // §23 — provenance, not a hidden reasoning trace.
  it('shows structured provenance and the inhibited alternatives behind Why?', async () => {
    renderDelta([
      mission({ id: 'm1', state: 'primary', title: 'Ship it', finishLine: 'Live', blocker: 'Waiting on Vaughn' }),
      mission({ id: 'm2', state: 'secondary', title: 'Write the docs', finishLine: 'Merged' }),
    ])

    fireEvent.click(await screen.findByRole('button', { name: 'Why?' }))

    expect(screen.getByText('Current reality')).toBeTruthy()
    expect(screen.getByText('Blocking gap')).toBeTruthy()
    expect(screen.getByText('Alternatives inhibited')).toBeTruthy()
    expect(screen.getByText('What would change this')).toBeTruthy()
    // The alternative that lost is named, with the reason it lost.
    expect(screen.getByText(/Move “Write the docs” toward/)).toBeTruthy()
    expect(screen.getByText(/Lower leverage/)).toBeTruthy()
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
    renderDelta([PRIMARY], { acceptedMove: 'Move “Ship the Strategic Delta” toward: Live on legacy-codex.vercel.app' })

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
