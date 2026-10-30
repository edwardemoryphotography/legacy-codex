import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HomeTab, { promptHelpQuestion } from './HomeTab'

const run = vi.fn(async () => {})
let voiceWrite: (value: string) => void = () => {}
let voiceActive = false

vi.mock('@/lib/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))
vi.mock('@/hooks/useMissionTerritory', () => ({ useMissionTerritory: () => ({ missions: [{ id: 'm1', title: 'Real mission', state: 'primary' }], loadError: null }) }))
vi.mock('@/hooks/useBriefRunner', () => ({ useBriefRunner: () => ({ configured: true, visitor: false, status: 'idle', activeMode: null, output: '', outputLabel: '', providerLabel: '', run, reset: () => {} }) }))
vi.mock('@/hooks/useTaskVoice', () => ({
  useTaskVoice: (_value: string, onChange: (value: string) => void) => {
    voiceWrite = onChange
    return { phase: voiceActive ? 'listening' : 'idle', status: '', toggle: () => {}, cancel: () => {}, active: voiceActive }
  },
}))
vi.mock('@/components/OrbHost', () => ({
  OrbSlot: () => null,
  useOrbCognition: () => {},
  useOrbInteraction: () => {},
  useOrbPresentation: () => ({ state: 'idle', label: '' }),
}))

afterEach(() => { cleanup(); run.mockClear(); voiceActive = false })

describe('promptHelpQuestion', () => {
  it('stays within the 400-character question limit /api/brief enforces', () => {
    expect(promptHelpQuestion('x'.repeat(1000)).length).toBe(400)
  })

  it('keeps the person’s words after the instruction', () => {
    expect(promptHelpQuestion('plan a night shoot')).toMatch(/plan a night shoot$/)
  })
})

describe('HomeTab never cuts a question silently', () => {
  it('clamps a long voice transcript to what can be sent', () => {
    render(<HomeTab onNavigate={() => {}} />)
    act(() => voiceWrite('y'.repeat(600)))
    expect(screen.getByLabelText('Ask Codex')).toHaveValue('y'.repeat(400))
    expect(screen.getByText('Character limit reached (400).')).toBeInTheDocument()
  })

  it('blocks Prompt help when the text no longer fits, and says why', () => {
    render(<HomeTab onNavigate={() => {}} />)
    act(() => voiceWrite('z'.repeat(400)))
    fireEvent.click(screen.getByRole('button', { name: 'Help me write a prompt' }))
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
    expect(screen.getByText(/Too long to send: shorten it to \d+ characters \(now 400\)\./)).toBeInTheDocument()
    expect(run).not.toHaveBeenCalled()
  })

  it('sends the whole question as written', () => {
    render(<HomeTab onNavigate={() => {}} />)
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'What is my next move?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(run).toHaveBeenCalledWith('question', expect.objectContaining({ question: 'What is my next move?' }), 'Ask Claude')
  })

  it('keeps Stop available while dictating, even once words arrive', () => {
    voiceActive = true
    render(<HomeTab onNavigate={() => {}} />)
    act(() => voiceWrite('half a thought'))
    expect(screen.getByRole('button', { name: 'Stop voice input' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
  })
})
