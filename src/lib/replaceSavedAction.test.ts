import { describe, expect, it, vi } from 'vitest'
import { replaceSavedActionAtomic } from './replaceSavedAction'

const input = {
  actionId: 'a1',
  missionId: 'm1',
  expectedUpdatedAt: '2026-11-03T00:00:00.000Z',
  newTitle: 'New action',
  newNote: 'Previous note',
}

describe('replaceSavedActionAtomic', () => {
  it('sends the exact action, mission, source version, and replacement', async () => {
    const rpc = vi.fn(async () => ({
      data: [{
        id: 'a1', mission_id: 'm1', action_title: 'New action', status: 'TODO',
        resume_note: 'Previous note', updated_at: '2026-11-03T00:00:01.000Z', replayed: false,
      }],
      error: null,
    }))
    const result = await replaceSavedActionAtomic({ rpc }, input)

    expect(rpc).toHaveBeenCalledWith('replace_saved_action_atomic', {
      p_action_id: 'a1',
      p_mission_id: 'm1',
      p_expected_updated_at: '2026-11-03T00:00:00.000Z',
      p_new_title: 'New action',
      p_new_note: 'Previous note',
    })
    expect(result).toEqual({
      ok: true,
      action: {
        id: 'a1', missionId: 'm1', title: 'New action', status: 'TODO',
        resumeNote: 'Previous note', updatedAt: '2026-11-03T00:00:01.000Z', replayed: false,
      },
    })
  })

  it('returns an error and no action when the transaction rejects', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'Saved action changed in another tab' } }))
    await expect(replaceSavedActionAtomic({ rpc }, input)).resolves.toEqual({
      ok: false,
      error: 'Saved action changed in another tab',
    })
  })

  it('treats a malformed RPC result as a conflict', async () => {
    const rpc = vi.fn(async () => ({ data: [{ id: 'a1' }], error: null }))
    await expect(replaceSavedActionAtomic({ rpc }, input)).resolves.toEqual({
      ok: false,
      error: 'Saved action changed in another tab; reload before retrying.',
    })
  })
})
