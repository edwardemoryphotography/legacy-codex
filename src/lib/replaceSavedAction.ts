export interface ReplaceSavedActionInput {
  actionId: string
  missionId: string
  expectedUpdatedAt: string
  newTitle: string
  newNote: string | null
}

export interface ReplacedSavedAction {
  id: string
  missionId: string
  title: string
  status: 'TODO' | 'IN_PROGRESS'
  resumeNote: string | null
  updatedAt: string
  replayed: boolean
}

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

/** The replacement and its history row are committed by one database function. */
export async function replaceSavedActionAtomic(
  client: RpcClient,
  input: ReplaceSavedActionInput,
): Promise<{ ok: true; action: ReplacedSavedAction } | { ok: false; error: string }> {
  const { data, error } = await client.rpc('replace_saved_action_atomic', {
    p_action_id: input.actionId,
    p_mission_id: input.missionId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_new_title: input.newTitle,
    p_new_note: input.newNote,
  })
  if (error) return { ok: false, error: error.message || 'Saved action changed in another tab; reload before retrying.' }
  const row = (Array.isArray(data) ? data[0] : data) as {
    id?: unknown
    mission_id?: unknown
    action_title?: unknown
    status?: unknown
    resume_note?: unknown
    updated_at?: unknown
    replayed?: unknown
  } | null
  if (!row || typeof row.id !== 'string' || typeof row.mission_id !== 'string'
    || typeof row.action_title !== 'string' || (row.status !== 'TODO' && row.status !== 'IN_PROGRESS')
    || typeof row.updated_at !== 'string') {
    return { ok: false, error: 'Saved action changed in another tab; reload before retrying.' }
  }
  return {
    ok: true,
    action: {
      id: row.id,
      missionId: row.mission_id,
      title: row.action_title,
      status: row.status,
      resumeNote: typeof row.resume_note === 'string' ? row.resume_note : null,
      updatedAt: row.updated_at,
      replayed: row.replayed === true,
    },
  }
}
