import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import CodexOrb, { codexOrbState } from './CodexOrb'

describe('codexOrbState', () => {
  it('only shows listening and thinking when Codex is actually in those states', () => {
    expect(codexOrbState('listening')).toBe('listening')
    expect(codexOrbState('thinking')).toBe('thinking')
  })

  it('rests every other state in idle; there is no speaking mode', () => {
    for (const state of ['idle', 'ready', 'blocked', 'completed'] as const) {
      expect(codexOrbState(state)).toBe('idle')
    }
  })
})

describe('CodexOrb', () => {
  it('is decorative, so the host status text stays the only announcement', () => {
    const { container } = render(<CodexOrb state="idle" />)
    expect(container.querySelector('.codex-orb-stage')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('falls back to a static sphere when WebGL is unavailable', () => {
    const { container } = render(<CodexOrb state="thinking" />)
    expect(container.querySelector('.codex-orb-fallback')).not.toBeNull()
  })
})
