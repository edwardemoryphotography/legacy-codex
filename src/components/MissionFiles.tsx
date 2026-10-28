'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ATTACH_ACCEPT, MAX_ATTACH_BYTES, missionFileInstruction } from '@/lib/missionFiles'
import type { Mission } from '@/types'
import { ActionBtn, Badge, Card, FieldLabel, HelperLine } from '@/components/ui'

// /api/analyze is owner-only; a visitor's 403 is an expected boundary.
export const FILES_VISITOR_COPY = 'Reading files with Claude is only on Eddie’s account. Your mission is still saved.'
const asMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

// Lets the person attach their actual assignment or draft so Claude reads
// the work itself instead of only the mission text. Files go to /api/analyze
// for this one read and are not stored; the answer is display-only.
export default function MissionFiles({ mission }: { mission: Pick<Mission, 'id' | 'title' | 'finishLine'> }) {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error' | 'visitor'>('idle')
  const [output, setOutput] = useState('')
  const total = files.reduce((sum, f) => sum + f.size, 0)
  const tooBig = total > MAX_ATTACH_BYTES

  const read = async () => {
    if (!files.length || tooBig) return
    setStatus('running')
    setOutput('')
    try {
      const formData = new FormData()
      formData.append('instruction', missionFileInstruction(mission))
      formData.append('missionId', mission.id)
      for (const file of files) formData.append('files', file)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/analyze', { method: 'POST', body: formData, headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} })
      if (res.status === 403) {
        setStatus('visitor')
        return
      }
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setOutput(data.text || 'No reading returned.')
      setStatus('done')
    } catch (err) {
      setOutput(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  return (
    <Card className="mb-4">
      <FieldLabel htmlFor={`mission-files-${mission.id}`}>Attach project files</FieldLabel>
      <p className="text-sm mb-2" style={{ color: 'var(--text-soft)' }}>
        Add your assignment or draft so Claude reads the actual work. Files are read once and not saved.
      </p>
      <input
        id={`mission-files-${mission.id}`}
        type="file"
        multiple
        accept={ATTACH_ACCEPT}
        onChange={e => { setFiles(Array.from(e.target.files ?? [])); setStatus('idle'); setOutput('') }}
        style={{ maxWidth: '100%' }}
      />
      {files.length > 0 && (
        <p className="text-sm mt-2" style={{ overflowWrap: 'anywhere' }}>
          {files.map(f => f.name).join(', ')} · {asMb(total)}
        </p>
      )}
      {tooBig && <HelperLine variant="error">{`Too large: ${asMb(total)}. Max ${asMb(MAX_ATTACH_BYTES)} at once.`}</HelperLine>}
      <div className="mt-2">
        <ActionBtn variant="secondary" onClick={() => void read()} disabled={!files.length || tooBig || status === 'running' || status === 'visitor'}>
          {status === 'running' ? 'Reading…' : 'Read with Claude'}
        </ActionBtn>
      </div>
      {status === 'visitor' && <HelperLine>{FILES_VISITOR_COPY}</HelperLine>}
      {output && (
        <div className="mt-3" style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.6 }}>
          <Badge tone="muted">From your files · read by Claude · not verified · not saved</Badge>
          {`\n${output}`}
        </div>
      )}
    </Card>
  )
}
