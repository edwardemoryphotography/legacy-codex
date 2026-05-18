'use client'

import { useState } from 'react'
import {
  SectionTitle, SectionSubtitle,
  FieldLabel, Input, ActionBtn, HelperLine,
} from '@/components/ui'

function formatLog(artifact: string, action: string, blocker: string): string {
  const timestamp = new Date().toLocaleString()
  return `## Resumption Log — ${timestamp}
- Last artifact: ${artifact || 'not specified'}
- Next action: ${action || 'not specified'}
- Blocker: ${blocker || 'not specified'}`
}

export default function ResumptionLogTab() {
  const [artifact, setArtifact] = useState('')
  const [action, setAction] = useState('')
  const [blocker, setBlocker] = useState('')
  const [log, setLog] = useState('')
  const [copyStatus, setCopyStatus] = useState<string>('idle')

  const generate = () => {
    setLog(formatLog(artifact, action, blocker))
    setCopyStatus('idle')
  }

  const copy = async () => {
    if (!log.trim()) {
      setCopyStatus('fail')
      return
    }
    if (!navigator.clipboard) {
      setCopyStatus('Clipboard status: clipboard API not available.')
      return
    }
    try {
      await navigator.clipboard.writeText(log)
      setCopyStatus('success')
    } catch {
      setCopyStatus('fail')
    }
  }

  return (
    <section>
      <SectionTitle>Resumption Log</SectionTitle>
      <SectionSubtitle>
        Capture immediate continuity data for interruption-safe restart.
      </SectionSubtitle>

      <div className="grid gap-3 mb-3">
        <div>
          <FieldLabel htmlFor="resumeArtifact">What was the last artifact produced?</FieldLabel>
          <Input
            id="resumeArtifact"
            value={artifact}
            onChange={setArtifact}
            placeholder="index.html update, deployment commit, transcript link"
          />
        </div>
        <div>
          <FieldLabel htmlFor="resumeAction">What is the next single action?</FieldLabel>
          <Input
            id="resumeAction"
            value={action}
            onChange={setAction}
            placeholder="Run local smoke check and push main"
          />
        </div>
        <div>
          <FieldLabel htmlFor="resumeBlocker">What is the blocker, if any?</FieldLabel>
          <Input
            id="resumeBlocker"
            value={blocker}
            onChange={setBlocker}
            placeholder="If none, write none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-1">
        <ActionBtn onClick={generate}>Generate Log Entry</ActionBtn>
        <ActionBtn onClick={copy} variant="secondary">Copy to Clipboard</ActionBtn>
      </div>

      <HelperLine variant={copyStatus === 'success' ? 'success' : copyStatus !== 'idle' ? 'error' : undefined}>
        {copyStatus === 'success'
          ? 'Clipboard status: copied successfully.'
          : copyStatus === 'idle'
          ? 'Clipboard status: not copied yet.'
          : copyStatus === 'fail'
          ? 'Clipboard status: copy failed.'
          : copyStatus}
      </HelperLine>

      {log && (
        <pre
          className="mt-3 p-3 rounded-codex text-sm whitespace-pre-wrap break-words"
          style={{
            border: '1px solid var(--line)',
            background: '#0f0f18',
            color: 'var(--text)',
            minHeight: 140,
          }}
        >
          {log}
        </pre>
      )}
    </section>
  )
}
