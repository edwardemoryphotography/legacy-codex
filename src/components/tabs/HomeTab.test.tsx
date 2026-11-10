import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { getAllEntries } from '@/data/codex'
import { emptyHomeSession, type HomeSession } from '@/lib/homeSession'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import HomeTab, { promptHelpQuestion } from './HomeTab'
import { QUESTION_LIMIT } from '@/lib/homeRequest'

const run = vi.fn(async () => true)
let voiceWrite: (value: string) => void = () => {}
let voiceActive = false
let missions: { id: string; title: string; state: string }[] | null = [{ id: 'm1', title: 'Real mission', state: 'primary' }]
let loadError: string | null = null
let voiceStatus = ''
let visitor = false
let accessState: 'checking' | 'owner' | 'signed-out' | 'no-access' | 'unconfigured' | 'error' = 'owner'
let accessName = 'Eddie'
let briefStatus = 'idle'
let briefOutput = ''
let orbState = 'idle'
let actionInsertError: { message: string } | null = null
const actionRows: Record<string, unknown>[] = []
const reset = vi.fn()

// jsdom has no native dialog lifecycle; real focus trapping and Escape are
// verified in the browser. Keep component tests faithful to open/close state.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          in: () => ({
            order: () => ({
              limit: () => Promise.resolve({
                data: table === 'actions' ? actionRows.filter(r => r.mission_id === val) : [],
                error: null,
              }),
            }),
          }),
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        if (actionInsertError) return Promise.resolve({ error: actionInsertError })
        const created = { id: `act-${actionRows.length + 1}`, ...row }
        actionRows.push(created)
        return Promise.resolve({ data: created, error: null })
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, val: string) => {
          if (actionInsertError) return Promise.resolve({ error: actionInsertError })
          const idx = actionRows.findIndex(r => r.id === val)
          if (idx >= 0) actionRows[idx] = { ...actionRows[idx], ...patch }
          return Promise.resolve({ error: null })
        },
      }),
    }),
  },
}))
vi.mock('@/lib/supabase/missionSession', () => ({ connectMissionSession: async () => ({ id: 'user-1' }) }))
vi.mock('@/hooks/useMissionTerritory', () => ({ useMissionTerritory: () => ({ missions, loadError, actions: actionRows, actionsRead: 'ok' }) }))
vi.mock('@/hooks/useBriefRunner', () => ({ useBriefRunner: () => ({ configured: true, visitor, status: briefStatus, activeMode: null, output: briefOutput, outputLabel: '', providerLabel: '', run, reset }) }))
vi.mock('@/hooks/useHomeAccess', () => ({ useHomeAccess: () => ({ state: accessState, configured: accessState === 'owner', name: accessName }) }))
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
  useOrbPresentation: () => ({ state: orbState, label: orbState === 'thinking' ? 'Thinking' : '' }),
}))

afterEach(() => { cleanup(); briefStatus = 'idle'; briefOutput = ''; orbState = 'idle'; actionInsertError = null; actionRows.length = 0; reset.mockClear(); run.mockReset(); run.mockResolvedValue(true); voiceActive = false; voiceStatus = ''; visitor = false; loadError = null; accessState = 'owner'; accessName = 'Eddie'; missions = [{ id: 'm1', title: 'Real mission', state: 'primary' }] })

describe('promptHelpQuestion', () => {
  it('stays within the shared question limit /api/brief enforces', () => {
    expect(promptHelpQuestion('x'.repeat(QUESTION_LIMIT + 100)).length).toBe(QUESTION_LIMIT)
  })

  it('keeps the person’s words after the instruction', () => {
    expect(promptHelpQuestion('plan a night shoot')).toMatch(/plan a night shoot$/)
  })
})

describe('Home account capability', () => {

  it('shows the access gate instead of a blank Mission conversation for a non-owner', () => {
    accessState = 'no-access'
    accessName = ''
    render(<HomeTab variant="mission" onNavigate={() => {}} />)
    expect(screen.getByRole('heading', { name: /This browser account cannot use AI yet/ })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Ask Codex' })).toBeNull()
  })

  it('does not present AI as ready for a non-owner account, and routes directly to sign-in', async () => {
    accessState = 'no-access'
    accessName = ''
    const onSignIn = vi.fn()
    render(<HomeTab onNavigate={() => {}} onSignIn={onSignIn} />)
    expect(await screen.findByText(/This browser account cannot use AI yet/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Ask Codex' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to your existing account' }))
    expect(onSignIn).toHaveBeenCalledOnce()
  })
})

describe('HomeTab never cuts a question silently', () => {
  it('clamps a long voice transcript to what can be sent', () => {
    render(<HomeTab onNavigate={() => {}} />)
    act(() => voiceWrite('y'.repeat(QUESTION_LIMIT + 100)))
    expect(screen.getByLabelText('Ask Codex')).toHaveValue('y'.repeat(QUESTION_LIMIT))
    expect(screen.getByText(`Character limit reached (${QUESTION_LIMIT}).`)).toBeInTheDocument()
  })

  it('blocks Prompt help when the text no longer fits, and says why', () => {
    render(<HomeTab onNavigate={() => {}} />)
    act(() => voiceWrite('z'.repeat(QUESTION_LIMIT)))
    fireEvent.click(screen.getByRole('button', { name: 'Open tools' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Help me write a prompt' }))
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByText(new RegExp(`Too long to send: shorten it to \\d+ characters \\(now ${QUESTION_LIMIT}\\)\\.`))).toBeInTheDocument()
    expect(run).not.toHaveBeenCalled()
  })

  it('sends the whole question as written', () => {
    render(<HomeTab onNavigate={() => {}} />)
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'What is my next move?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(run).toHaveBeenCalledWith('question', expect.objectContaining({ question: 'What is my next move?' }), 'Ask Codex')
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

it('opens all five Codex tools in a native top-layer dialog and closes cleanly', () => {
  render(<HomeTab onNavigate={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open tools' }))
  const dialog = screen.getByRole('dialog', { name: 'Codex tools' })
  expect(dialog.tagName).toBe('DIALOG')
  expect(dialog).toHaveAttribute('open')
  const menu = within(dialog).getByRole('menu', { name: 'Tools' })
  expect(within(menu).getAllByRole('menuitem').map(item => item.textContent?.trim())).toEqual([
    'Ask Codex',
    'Daily Brief',
    'Triage',
    'Upload a file',
    'Help me write a prompt',
  ])
  expect(screen.getByRole('button', { name: 'Open tools' })).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close tools' }))
  expect(screen.queryByRole('dialog', { name: 'Codex tools' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Open tools' })).toHaveAttribute('aria-expanded', 'false')
})

it('closes the native tools dialog before restoring composer focus on selection', () => {
  render(<HomeTab onNavigate={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open tools' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Daily Brief' }))
  expect(screen.queryByRole('dialog', { name: 'Codex tools' })).toBeNull()
  expect(screen.getByRole('textbox', { name: 'Ask Codex' })).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Remove Daily Brief' })).toBeInTheDocument()
})

describe('HomeTab send arrow', () => {
  it('sends a question with Enter even when there are no saved missions', () => {
    missions = []
    render(<HomeTab onNavigate={() => {}} />)
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'Hey' } })
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    fireEvent.keyDown(screen.getByLabelText('Ask Codex'), { key: 'Enter' })
    expect(run).toHaveBeenCalledWith('question', { mode: 'question', tier: 'routine', missions: [], missionIds: [], conversation: [], question: 'Hey' }, 'Ask Codex')
  })

  it('keeps failed text and the chosen tool instead of erasing them on submission', async () => {
    run.mockResolvedValue(false)
    render(<HomeTab onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open tools' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Help me write a prompt' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Missions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start a mission' }))
    expect(navigate).toHaveBeenCalledWith('mission')
    expect(run).not.toHaveBeenCalled()
  })

  it('offers the same route back to saved missions', () => {
    const navigate = vi.fn()
    render(<HomeTab onNavigate={navigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Missions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open this mission' }))
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

  it.each(['loading', 'failed'])('explains a %s read inside the Missions sheet and keeps navigation available', state => {
    missions = state === 'loading' ? null : []
    loadError = state === 'failed' ? 'Missions could not be read.' : null
    const navigate = vi.fn()
    render(<HomeTab onNavigate={navigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Missions' }))
    const sheet = screen.getByRole('dialog', { name: 'Your missions' })
    expect(within(sheet).getByText(loadError ?? 'Loading your missions…')).toBeInTheDocument()
    expect(within(sheet).queryByText('Start a mission')).not.toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Open Mission' }))
    expect(navigate).toHaveBeenCalledWith('mission')
  })
})

// Deterministic UI contracts over existing infrastructure. This authentic answer
// was supplied by Eddie in the Oct 31 fallback report; it is not provider proof.
const observedReply = 'There are no blocked missions to triage at this time. If you have a specific issue or topic you’d like to address, feel free to reach out with more details.'

describe('immersive Home contracts', () => {
  it.each(['Daily Brief', 'Triage'])('preserves typed intent when %s is selected', label => {
    missions = []
    render(<HomeTab onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open tools' }))
    fireEvent.click(screen.getByRole('menuitem', { name: label }))
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'What the fuck is this thing actually doing?' } })
    expect(screen.getByText('Your typed text will be sent to Ask Codex instead.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(run).toHaveBeenCalledWith('question', { mode: 'question', tier: 'routine', question: 'What the fuck is this thing actually doing?', missions: [], missionIds: [], conversation: [] }, 'Ask Codex')
  })
  it('names the text-free operation and allows reversing selection', () => {
    render(<HomeTab onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open tools' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Daily Brief' }))
    expect(screen.getByText('Daily Brief uses saved missions. No question is needed.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(run).toHaveBeenCalledWith('daily_brief', expect.objectContaining({ mode: 'daily_brief' }), 'Daily Brief')
  })
  it('keeps the orb stage outside the independently scrolling response', () => {
    briefStatus = 'done'; briefOutput = observedReply; orbState = 'ready'
    const { container } = render(<HomeTab onNavigate={() => {}} />)
    expect(screen.getByRole('heading', { name: observedReply })).toBeInTheDocument()
    expect(container.querySelector('.glass-orb-wrap')?.closest('.glass-results')).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Read full answer' }))
    expect(within(screen.getByRole('region', { name: 'Codex response' })).getByText(observedReply)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('conceals responses during processing and offers cancellation without erasing input', () => {
    briefStatus = 'running'; orbState = 'thinking'
    const { container } = render(<HomeTab onNavigate={() => {}} />)
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'What the fuck is this thing actually doing?' } })
    expect(container.querySelector('.glass-home')).toHaveAttribute('data-immersive', 'true')
    expect(container.querySelector('.glass-results')).toHaveAttribute('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    expect(reset).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Ask Codex')).toHaveValue('What the fuck is this thing actually doing?')
  })
  it('shows a genuine failure with a retry and retained draft', () => {
    briefStatus = 'error'; briefOutput = 'Daily Brief unavailable'; orbState = 'blocked'
    render(<HomeTab onNavigate={() => {}} />)
    expect(screen.getByText('Daily Brief unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

it('retains the draft and actual displayed response across Home navigation within one account session', () => {
  missions = []
  briefStatus = 'done'; briefOutput = observedReply
  function SessionHarness() {
    const [home, setHome] = useState(emptyHomeSession)
    const [visible, setVisible] = useState(true)
    return <><button onClick={() => setVisible(value => !value)}>Toggle Home</button>{visible && <HomeTab onNavigate={() => {}} session={home} onSessionChange={setHome} />}</>
  }
  render(<SessionHarness />)
  fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'What the fuck is this thing actually doing?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Toggle Home' }))
  briefStatus = 'idle'; briefOutput = ''
  fireEvent.click(screen.getByRole('button', { name: 'Toggle Home' }))
  expect(screen.getByLabelText('Ask Codex')).toHaveValue('What the fuck is this thing actually doing?')
  expect(screen.getByRole('heading', { name: observedReply })).toBeInTheDocument()
})

it('allows a new submission after cancelling a still-pending client run', async () => {
  missions = []
  let finish: (value: boolean) => void = () => {}
  run.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve }))
  const { rerender } = render(<HomeTab onNavigate={() => {}} />)
  fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'What the fuck is this thing actually doing?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(run).toHaveBeenCalledTimes(1)
  briefStatus = 'running'; orbState = 'thinking'
  rerender(<HomeTab onNavigate={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
  briefStatus = 'idle'; orbState = 'idle'
  rerender(<HomeTab onNavigate={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(run).toHaveBeenCalledTimes(2)
  await act(async () => finish(false))
})

it('keeps complete long source text in the response region without truncation', () => {
  // Existing canonical reference text is a layout input, not an invented AI answer.
  const source = getAllEntries().reduce((longest, entry) => entry.content.length > longest.content.length ? entry : longest)
  expect(source.content.length).toBeGreaterThan(1000)
  const home = { ...emptyHomeSession(), reply: { question: '', text: source.content, label: source.title, provider: '' } }
  render(<HomeTab onNavigate={() => {}} session={home} />)
  expect(screen.queryByRole('region', { name: 'Codex response' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Read full answer' }))
  const region = screen.getByRole('region', { name: 'Codex response' })
  expect(region.querySelector('.glass-output-text')?.textContent).toContain('The Cookbook remains the doctrine owner.')
  expect(region.querySelector('.glass-output-text a')).toBeTruthy()
  expect(screen.getByRole('textbox', { name: 'Ask Codex' })).toBeInTheDocument()
})

it('tracks a small iPhone visual viewport and keyboard resizing without moving the composer into the response scroller', () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport')
  const viewport = Object.assign(new EventTarget(), { height: 664, offsetTop: 0 })
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  const { unmount, container } = render(<HomeTab onNavigate={() => {}} />)
  try {
    expect(document.documentElement.style.getPropertyValue('--codex-viewport-height')).toBe('664px')
    const field = screen.getByRole('textbox', { name: 'Ask Codex' })
    act(() => field.focus())
    expect(document.documentElement.dataset.homeComposing).toBe('true')
    viewport.height = 340; viewport.offsetTop = 18
    act(() => viewport.dispatchEvent(new Event('resize')))
    expect(document.documentElement.dataset.homeKeyboard).toBe('true')
    expect(document.documentElement.style.getPropertyValue('--codex-viewport-height')).toBe('340px')
    expect(document.documentElement.style.getPropertyValue('--codex-viewport-top')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--codex-composer-bottom')).toBe(
      String(Math.max(0, window.innerHeight - 340 - 18)) + 'px'
    )
    expect(container.querySelector('.glass-dock')?.closest('.glass-results')).toBeNull()
    unmount()
    expect(document.documentElement.style.getPropertyValue('--codex-viewport-height')).toBe('')
  } finally {
    if (previous) Object.defineProperty(window, 'visualViewport', previous)
    else Reflect.deleteProperty(window, 'visualViewport')
  }
})

it('keeps the composer attached when iOS shrinks both innerHeight and visualViewport', () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport')
  const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
  const viewport = Object.assign(new EventTarget(), { height: 740, offsetTop: 0 })
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 740 })
  const { unmount } = render(<HomeTab onNavigate={() => {}} />)
  try {
    const field = screen.getByRole('textbox', { name: 'Ask Codex' })
    fireEvent.click(screen.getByRole('button', { name: 'Open tools' }))
    expect(screen.getByRole('menu', { name: 'Tools' })).toBeInTheDocument()
    act(() => field.focus())
    expect(document.documentElement.dataset.homeComposing).toBe('true')
    expect(screen.queryByRole('menu', { name: 'Tools' })).toBeNull()
    viewport.height = 362
    viewport.offsetTop = 46
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 362 })
    act(() => viewport.dispatchEvent(new Event('resize')))
    expect(document.documentElement.dataset.homeKeyboard).toBe('true')
    expect(document.documentElement.style.getPropertyValue('--codex-viewport-height')).toBe('362px')
    expect(document.documentElement.style.getPropertyValue('--codex-viewport-top')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--codex-composer-bottom')).toBe('0px')
    viewport.offsetTop = 54
    act(() => viewport.dispatchEvent(new Event('scroll')))
    expect(document.documentElement.style.getPropertyValue('--codex-viewport-top')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--codex-composer-bottom')).toBe('0px')
    expect(field).toBeInTheDocument()
    act(() => field.blur())
    expect(document.documentElement.dataset.homeComposing).toBeUndefined()
    expect(document.documentElement.dataset.homeKeyboard).toBeUndefined()
    unmount()
    expect(document.documentElement.dataset.homeViewport).toBeUndefined()
  } finally {
    if (previous) Object.defineProperty(window, 'visualViewport', previous)
    else Reflect.deleteProperty(window, 'visualViewport')
    if (previousInnerHeight) Object.defineProperty(window, 'innerHeight', previousInnerHeight)
    else Reflect.deleteProperty(window, 'innerHeight')
  }
})

it('reanchors the dock for an embedded iOS browser whose layout viewport stays tall', () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport')
  const previousInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
  const viewport = Object.assign(new EventTarget(), { height: 820, offsetTop: 0 })
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 820 })
  const { unmount } = render(<HomeTab onNavigate={() => {}} />)
  try {
    const field = screen.getByRole('textbox', { name: 'Ask Codex' })
    act(() => field.focus())
    viewport.height = 400
    viewport.offsetTop = 205
    act(() => viewport.dispatchEvent(new Event('resize')))
    expect(document.documentElement.style.getPropertyValue('--codex-composer-bottom')).toBe('215px')
    expect(document.documentElement.style.getPropertyValue('--codex-viewport-top')).toBe('0px')
    viewport.offsetTop = 245
    act(() => viewport.dispatchEvent(new Event('scroll')))
    expect(document.documentElement.style.getPropertyValue('--codex-composer-bottom')).toBe('175px')
    act(() => field.blur())
    expect(document.documentElement.style.getPropertyValue('--codex-composer-bottom')).toBe('0px')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--codex-composer-bottom')).toBe('')
  } finally {
    if (previous) Object.defineProperty(window, 'visualViewport', previous)
    else Reflect.deleteProperty(window, 'visualViewport')
    if (previousInnerHeight) Object.defineProperty(window, 'innerHeight', previousInnerHeight)
    else Reflect.deleteProperty(window, 'innerHeight')
  }
})

it('continues the same draft and exchange from Home into Mission', async () => {
  function SharedConversation() {
    const [session, setSession] = useState<HomeSession>({ ...emptyHomeSession(), reply: { question: 'How do I talk to you best?', text: '**Tell me what you want to accomplish.**', label: 'Ask Codex', provider: 'test' } })
    const [view, setView] = useState<'home' | 'mission'>('home')
    return <HomeTab key={view} variant={view} session={session} onSessionChange={setSession} onNavigate={id => setView(id === 'mission' ? 'mission' : 'home')} />
  }
  render(<SharedConversation />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask Codex' }), { target: { value: 'Can we continue here?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Open project workspace' }))
  expect(screen.getByRole('region', { name: 'Project conversation' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Ask Codex' })).toHaveValue('Can we continue here?')
  fireEvent.click(screen.getByRole('button', { name: /^History/ }))
  expect(within(screen.getByRole('region', { name: 'Session history' })).getByText('Tell me what you want to accomplish.').tagName).toBe('STRONG')
  fireEvent.click(screen.getByRole('button', { name: 'Continue conversation' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })))
  expect(run).toHaveBeenCalledWith('question', expect.objectContaining({ question: 'Can we continue here?', conversationMissionId: 'm1', conversation: [{ role: 'user', text: 'How do I talk to you best?' }, { role: 'assistant', text: '**Tell me what you want to accomplish.**' }] }), 'Ask Codex')
})

it('keeps a Primary beyond the first forty projects aligned with its request context', async () => {
  missions = Array.from({ length: 45 }, (_, index) => ({ id: `m${index}`, title: `Project ${index}`, state: index === 44 ? 'primary' : 'parked' }))
  render(<HomeTab onNavigate={() => {}} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask Codex' }), { target: { value: 'What next?' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })))
  const payload = (run.mock.calls as unknown as unknown[][])[0][1] as { missionIds: string[]; missions: { title: string }[]; conversationMissionId: string }
  expect(payload.missionIds).toHaveLength(40)
  expect(payload.conversationMissionId).toBe('m44')
  expect(payload.missionIds[0]).toBe('m44')
  expect(payload.missions[0].title).toBe('Project 44')
})

it('renders model image markup as text without requesting an external image', () => {
  render(<HomeTab onNavigate={() => {}} session={{ ...emptyHomeSession(), reply: { question: '', text: '![Project illustration](https://example.test/image)', label: 'Answer', provider: '' } }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Read full answer' }))
  const region = screen.getByRole('region', { name: 'Codex response' })
  expect(within(region).getByText('Project illustration')).toBeInTheDocument()
  expect(region.querySelector('img')).toBeNull()
})

it('keeps a completed answer visibly reachable in the Mission conversation', () => {
  render(<HomeTab variant="mission" onNavigate={() => {}} session={{ ...emptyHomeSession(), reply: { question: 'Continue?', text: 'We can continue with your saved project.', label: 'Ask Codex', provider: 'test' } }} />)
  expect(screen.getByRole('heading', { name: 'We can continue with your saved project.' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Read full answer' })).toBeInTheDocument()
})

describe('explicit conversation intelligence choice', () => {
  it('defaults to Economy and sends the selected tier without changing the question', () => {
    missions = []
    render(<HomeTab onNavigate={() => {}} />)
    expect(screen.getByRole('button', { name: 'Economy' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'What the fuck is this thing actually doing?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Deep' }))
    expect(screen.getByRole('button', { name: 'Deep' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(run).toHaveBeenCalledWith('question', expect.objectContaining({ tier: 'deep', question: 'What the fuck is this thing actually doing?' }), 'Ask Codex')
  })
  it('can return to Economy before sending', () => {
    missions = []
    render(<HomeTab onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deep' }))
    fireEvent.click(screen.getByRole('button', { name: 'Economy' }))
    fireEvent.change(screen.getByLabelText('Ask Codex'), { target: { value: 'How do I talk to you best?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(run).toHaveBeenCalledWith('question', expect.objectContaining({ tier: 'routine' }), 'Ask Codex')
  })


  it('saves the structured proposed action instead of the answer excerpt', async () => {
    const session = {
      ...emptyHomeSession(),
      reply: {
        question: 'What is next?',
        text: 'The export is the blocker. Finish that before anything else.',
        label: 'Live Codex',
        provider: 'Economy · Claude · test',
        actionTitle: 'Open the export and run one missing test.',
      },
    }
    render(<HomeTab onNavigate={() => {}} session={session} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save as my next action' }))
    })
    expect(actionRows).toHaveLength(1)
    expect(actionRows[0]).toMatchObject({
      mission_id: 'm1',
      action_title: 'Open the export and run one missing test.',
      status: 'TODO',
    })
  })

  it('saves a conversation reply as the next action for the Primary mission with failure recovery and no duplicate rows', async () => {
    const navigate = vi.fn()
    const onProjectChange = vi.fn()
    const session = {
      ...emptyHomeSession(),
      reply: {
        question: 'What is my next move?',
        text: 'Save the recommended move as your next action and verify it on your phone.',
        label: 'Ask Codex',
        provider: 'test',
      },
    }
    render(<HomeTab onNavigate={navigate} onProjectChange={onProjectChange} session={session} />)

    actionInsertError = { message: 'Temporary network glitch' }
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save as my next action' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save this response as your next action. Your conversation is still here — retry when ready.')
    expect(actionRows).toHaveLength(0)

    actionInsertError = null
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry saving next action' }))
      fireEvent.click(screen.getByRole('button', { name: 'Retry saving next action' }))
    })
    expect(actionRows).toHaveLength(1)
    expect(actionRows[0]).toMatchObject({
      mission_id: 'm1',
      action_title: 'Save the recommended move as your next action and verify it on your phone.',
      status: 'TODO',
      is_next_action: true,
    })
    expect(onProjectChange).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Saved as your next action for/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open in Mission' }))
    expect(navigate).toHaveBeenCalledWith('mission')
  })
})
