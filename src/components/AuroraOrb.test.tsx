import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import AuroraOrb, { aiOrbState } from './AuroraOrb'

describe('aiOrbState', () => {
  it('only shows listening and thinking when Codex is actually in those states', () => {
    expect(aiOrbState('listening')).toBe('listening')
    expect(aiOrbState('thinking')).toBe('thinking')
  })

  it('never claims speaking: Codex has no real spoken reply', () => {
    for (const state of ['idle', 'ready', 'blocked', 'completed'] as const) {
      expect(aiOrbState(state)).toBe('idle')
    }
  })
})

describe('AuroraOrb', () => {
  it('is decorative, so the host status text stays the only announcement', () => {
    const { container } = render(<AuroraOrb state="idle" />)
    const stage = container.querySelector('.ai-orb-stage')
    expect(stage?.getAttribute('aria-hidden')).toBe('true')
  })
})
