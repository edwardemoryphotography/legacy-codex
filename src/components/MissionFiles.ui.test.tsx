/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MissionFiles, { FILES_VISITOR_COPY } from './MissionFiles'

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'token' } }, error: null }) } },
}))

const mission = { id: '00000000-0000-4000-8000-0000000000aa', title: 'Finish research paper', finishLine: '3 pages submitted' }
const attach = (file: File) => fireEvent.change(screen.getByLabelText('Attach project files'), { target: { files: [file] } })

describe('MissionFiles', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('sends the files, mission scope and instruction once, and labels the reading as unverified', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: 'Requirement: 3 pages.' }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<MissionFiles mission={mission} />)
    expect((screen.getByRole('button', { name: 'Read with Claude' }) as HTMLButtonElement).disabled).toBe(true)
    attach(new File(['Write 3 pages.'], 'assignment.txt', { type: 'text/plain' }))
    fireEvent.click(screen.getByRole('button', { name: 'Read with Claude' }))
    expect(await screen.findByText(/Requirement: 3 pages\./)).toBeTruthy()
    expect(screen.getByText(/not verified · not saved/)).toBeTruthy()
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData
    expect(body.get('missionId')).toBe(mission.id)
    expect(String(body.get('instruction'))).toContain('3 pages submitted')
    expect((body.get('files') as File).name).toBe('assignment.txt')
  })

  it('shows plain visitor copy on 403', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: 'nope' }) })))
    render(<MissionFiles mission={mission} />)
    attach(new File(['x'], 'a.txt', { type: 'text/plain' }))
    fireEvent.click(screen.getByRole('button', { name: 'Read with Claude' }))
    expect(await screen.findByText(FILES_VISITOR_COPY)).toBeTruthy()
    expect(screen.queryByText('nope')).toBeNull()
  })

  it('refuses files over the upload limit before any request', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<MissionFiles mission={mission} />)
    attach(new File([new Uint8Array(5 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' }))
    expect(screen.getByText(/Too large/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Read with Claude' }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
