/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MissionBriefPanel from './MissionBriefPanel'
import type { BriefRunner } from '@/hooks/useBriefRunner'
import type { Mission } from '@/types'

const mission: Mission = {
  id: 'mission-1',
  title: 'The design of this',
  why: '',
  finishLine: 'It feels intuitive',
  evidenceRequirement: null,
  state: 'primary',
  blocker: null,
  capacityMismatch: false,
  createdAt: '2026-11-02T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
}

function runner(): BriefRunner {
  return {
    configured: true,
    visitor: false,
    status: 'idle',
    activeMode: null,
    output: '',
    outputLabel: '',
    providerLabel: '',
    run: vi.fn(async () => true),
    reset: vi.fn(),
  }
}

describe('MissionBriefPanel', () => {
  it('keeps an Ask question on Economy even without a visible tier control', () => {
    const brief = runner()
    render(<MissionBriefPanel mission={mission} action={null} actionsRead="ok" brief={brief} withTriageAndAsk />)

    fireEvent.change(screen.getByLabelText('Ask about this mission'), { target: { value: 'What should I do next?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    expect(brief.run).toHaveBeenCalledWith(
      'question',
      expect.objectContaining({ tier: 'routine', question: 'What should I do next?' }),
      expect.stringContaining('Ask · The design of this'),
    )
  })
})
