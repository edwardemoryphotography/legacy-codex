import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import TerritoryWorkspacePanel from './TerritoryWorkspacePanel'
import type { TerritoryWorkspace } from '@/hooks/useTerritoryWorkspace'
import type { TerritoryEntity } from '@/lib/territoryEntities'
import type { Mission } from '@/types'

vi.mock('@/components/MissionBriefPanel', () => ({ BriefOutput: () => null }))

const mission = { id: 'm1', title: 'Ship the demo', state: 'active' } as unknown as Mission
const entity = { id: 'p1', kind: 'project', label: 'Launch', description: '', signal: null, cluster: null, createdAt: '2026-11-04T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z' } as TerritoryEntity

function workspace(overrides: Partial<TerritoryWorkspace> = {}): TerritoryWorkspace {
  return {
    links: [], linksRead: 'ok', state: null, stateRead: 'ok', events: [], eventsRead: 'ok', error: '',
    createLink: vi.fn().mockResolvedValue({ ok: true }),
    removeLink: vi.fn().mockResolvedValue({ ok: true }),
    saveState: vi.fn().mockResolvedValue({ ok: true }),
    addLog: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  } as TerritoryWorkspace
}

const brief = { status: 'idle', configured: true, visitor: false, run: vi.fn() } as unknown as React.ComponentProps<typeof TerritoryWorkspacePanel>['brief']

describe('TerritoryWorkspacePanel', () => {
  it('renders the real active state and saves it without inventing data', async () => {
    const saveState = vi.fn().mockResolvedValue({ ok: true })
    render(<TerritoryWorkspacePanel missions={[mission]} entities={[entity]} workspace={workspace({ saveState })} brief={brief} />)
    expect(screen.getByText('Active state')).toBeTruthy()
    expect(screen.getByText('Connections')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Current project'), { target: { value: 'Launch' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save state' }))
    await waitFor(() => expect(saveState).toHaveBeenCalledWith({ activeProject: 'Launch', energy: null, nextAction: '' }))
    expect(await screen.findByText('Saved.')).toBeTruthy()
  })

  it('shows a read failure instead of an empty successful workspace', () => {
    render(<TerritoryWorkspacePanel missions={[mission]} entities={[entity]} workspace={workspace({ stateRead: 'failed', error: 'Could not read.' })} brief={brief} />)
    expect(screen.getByText('Could not read.')).toBeTruthy()
    expect(screen.queryByText('Active state')).toBeNull()
  })
})
