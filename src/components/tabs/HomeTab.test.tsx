import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HomeTab, { promptHelpQuestion } from './HomeTab'

const run = vi.fn(async () => true)
let voiceWrite: (value: string) => void = () => {}
let voiceActive = false
let missions: { id: string; title: string; state: string }[] | null = [{ id: 'm1', title: 'Real mission', state: 'primary' }]
let loadError: string | null = null
let voiceStatus = ''
let visitor = false

vi.mock('@/lib/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))
vi.mock('@/hooks/useMissionTerritory', () => ({ useMissionTerritory: () => ({ missions, loadError }) }))
vi.mock('@/hooks/useBriefRunner', () => ({ useBriefRunner: () => ({ configured: true, visitor, status: 'idle', activeMode: null, output: '', outputLabel: '', providerLabel: '', run, reset: () => {} }) }))
vi.mock('@/hooks/useTaskVoice', () => ({
  useTaskVoice: (_value: string, onChange: (value: string) => void) => {
    voiceWrite = onChange
    return { phase: voiceActive ? 'listening' : 'idle', status: voiceStatus, toggle: () => {}, cancel: () => {}, active: voiceActive }
  },
}))
vi.mock('@/components/OrbHost', () => ({
  OrbSlot: () => null,
  useOrbCognition: () => {},
  useOrbInteraction: () => {},
  useOrbPresentation: () => ({ state: 'idle', label: '' }),
}))

afterEach(() => { cleanup(); run.mockReset(); run.mockResolvedValue(true); voiceActive = false; voiceStatus = ''; visitor = false; loadError = null; missions = [{ id: 'm1', title: 'Real mission', state: 'primary' }] })

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
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
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
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('does not send when Enter only confirms an IME composition', () => {
    render(<HomeTab onNavigate={() => {}} />)
    const input = screen.getByLabelText('Ask Codex')
    fireEvent.change(input, { target: { value: '次の一歩' } })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    expect(run).not.toHaveBeenCalled()
    expect(input).toHaveValue('次の一歩')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('HomeTab send arrow', () => {
  it('sends a question with Enter even when there are no saved missions', () => {
    missions = []
    render(<HomeTab onNavigate={() => {}} />)
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'Hey' } })
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    fireEvent.keyDown(screen.getByLabelText('Ask Codex'), { key: 'Enter' })
    expect(run).toHaveBeenCalledWith('question', { mode: 'question', missions: [], missionIds: [], question: 'Hey' }, 'Ask Claude')
  })

  it('keeps failed text and the chosen tool instead of erasing them on submission', async () => {
    run.mockResolvedValue(false)
    render(<HomeTab onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Help me write a prompt' }))
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'this text box doesnt even let me send it anywhere' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })))
    expect(screen.getByLabelText('Ask Codex')).toHaveValue('this text box doesnt even let me send it anywhere')
    expect(screen.getByRole('button', { name: 'Remove Prompt help' })).toBeInTheDocument()
  })

  it('does not issue duplicate sends or erase words typed while a request is pending', async () => {
    let finish: (value: boolean) => void = () => {}
    run.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve }))
    render(<HomeTab onNavigate={() => {}} />)
    const input = screen.getByLabelText('Ask Codex')
    fireEvent.change(input, { target: { value: 'this text box doesnt even let me send it anywhere' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(run).toHaveBeenCalledTimes(1)
    fireEvent.change(input, { target: { value: 'also the microphone logo is there' } })
    await act(async () => finish(true))
    expect(input).toHaveValue('also the microphone logo is there')
  })

  it('keeps the microphone available beside Send after text is entered', () => {
    render(<HomeTab onNavigate={() => {}} />)
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'this text box doesnt even let me send it anywhere' } })
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Voice input' })).toBeInTheDocument()
  })

  it('shows voice failures even when the account has no missions', () => {
    missions = []
    voiceStatus = 'Voice input stopped. No words were added.'
    render(<HomeTab onNavigate={() => {}} />)
    expect(screen.getByText(voiceStatus)).toBeInTheDocument()
  })

  it('explains denied AI access at the composer and retains the question', () => {
    missions = []
    visitor = true
    const navigate = vi.fn()
    render(<HomeTab onNavigate={navigate} />)
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'this text box doesnt even let me send it anywhere' } })
    fireEvent.keyDown(screen.getByLabelText('Ask Codex'), { key: 'Enter' })
    expect(run).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Ask Codex')).toHaveValue('this text box doesnt even let me send it anywhere')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to your existing account' }))
    expect(navigate).toHaveBeenCalledWith('controls')
  })
})

describe('Home mission entry', () => {
  it('takes a confirmed empty account straight to the existing Mission screen without an AI call', () => {
    missions = []
    const navigate = vi.fn()
    render(<HomeTab onNavigate={navigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start a mission' }))
    expect(navigate).toHaveBeenCalledWith('mission')
    expect(run).not.toHaveBeenCalled()
  })

  it('offers the same route back to saved missions', () => {
    const navigate = vi.fn()
    render(<HomeTab onNavigate={navigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open your missions' }))
    expect(navigate).toHaveBeenCalledWith('mission')
  })

  it.each(['loading', 'failed'])('does not turn a %s read into a first-run invitation', state => {
    missions = state === 'loading' ? null : []
    loadError = state === 'failed' ? 'Missions could not be read.' : null
    render(<HomeTab onNavigate={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Start a mission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open your missions' })).not.toBeInTheDocument()
    expect(screen.getByText(loadError ?? 'Loading your missions…')).toBeInTheDocument()
  })
})
