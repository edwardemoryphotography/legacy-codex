'use client'

import { useEffect, useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { ActionBtn, ActionChip, Badge, Card, HelperLine, Input, SectionSubtitle, SectionTitle } from '@/components/ui'

interface ResumptionDraft {
  artifact: string
  action: string
  blocker: string
}

interface ResumptionPacket extends ResumptionDraft {
  id: string
  createdAt: string
  markdown: string
}


  const [ndInbox] = useLocalStorage<any[]>("nd_inbox_v1", [])

const DRAFT_KEY = 'codex_v39_resumption_draft'
const HISTORY_KEY = 'codex_v39_resumption_history'
const MAX_HISTORY = 12

const DEFAULT_DRAFT: ResumptionDraft = {
  artifact: '',
  action: '',
  blocker: '',
}

function createPacket(draft: ResumptionDraft): ResumptionPacket {
  const createdAt = new Date()
  const safeArtifact = draft.artifact.trim() || 'not specified'
  const safeAction = draft.action.trim() || 'not specified'
  const safeBlocker = draft.blocker.trim() || 'not specified'
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${createdAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    createdAt: createdAt.toISOString(),
    artifact: draft.artifact,
    action: draft.action,
    blocker: draft.blocker,
    markdown: [
      `## Resumption Packet — ${createdAt.toLocaleString()}`,
      `- Last artifact: ${safeArtifact}`,
      `- Next action: ${safeAction}`,
      `- Blocker: ${safeBlocker}`,
      '',
    ].join('\n'),
  }
}

function formatPacketDate(packet: ResumptionPacket) {
  return new Date(packet.createdAt).toLocaleString()
}

function packetFilename(packet: ResumptionPacket) {
  return `resumption-${packet.createdAt.slice(0, 10)}.md`
}

async function copyToClipboard(text: string) {
  if (!navigator.clipboard) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function ResumptionLogTab() {
  const [draft, setDraft] = useLocalStorage<ResumptionDraft>(DRAFT_KEY, DEFAULT_DRAFT)
  const [history, setHistory] = useLocalStorage<ResumptionPacket[]>(HISTORY_KEY, [])
  const [currentPacket, setCurrentPacket] = useState<ResumptionPacket | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!currentPacket && history[0]) {
      setCurrentPacket(history[0])
    }
  }, [currentPacket, history])

  const savePacket = () => {
    const packet = createPacket(draft)
    const nextHistory = [packet, ...history.filter(item => item.id !== packet.id)].slice(0, MAX_HISTORY)
    setHistory(nextHistory)
    setCurrentPacket(packet)
    setStatus(`Saved packet ${formatPacketDate(packet)}.`)
  }

  const loadPacket = (packet: ResumptionPacket) => {
    setDraft({
      artifact: packet.artifact,
      action: packet.action,
      blocker: packet.blocker,
    })
    setCurrentPacket(packet)
    setStatus(`Loaded packet ${formatPacketDate(packet)}.`)
  }

  const deletePacket = (packetId: string) => {
    const nextHistory = history.filter(packet => packet.id !== packetId)
    setHistory(nextHistory)
    setCurrentPacket(prev => {
      if (prev?.id !== packetId) return prev
      return nextHistory[0] ?? null
    })
    setStatus('Removed packet from local history.')
  }

  const clearHistory = () => {
    setHistory([])
    setCurrentPacket(null)
    setStatus('Cleared resumption history.')
  }

  const copyCurrentPacket = async () => {
    if (!currentPacket) {
      setStatus('Generate a packet before copying it.')
      return
    }

    const success = await copyToClipboard(currentPacket.markdown)
    setStatus(success ? 'Copied current packet.' : 'Clipboard access is unavailable.')
  }

  const exportCurrentPacket = () => {
    if (!currentPacket) {
      setStatus('Generate a packet before exporting it.')
      return
    }

    const filename = packetFilename(currentPacket)
    downloadText(filename, currentPacket.markdown, 'text/markdown;charset=utf-8')
    setStatus(`Exported ${filename}.`)
  }

  const exportHistory = () => {
    if (!history.length) {
      setStatus('No history to export yet.')
      return
    }

    downloadText('resumption-history.json', JSON.stringify(history, null, 2), 'application/json;charset=utf-8')
    setStatus('Exported resumption history JSON.')
  }

  const copyHistoryPacket = async (packet: ResumptionPacket) => {
    const success = await copyToClipboard(packet.markdown)
    setStatus(success ? `Copied packet ${formatPacketDate(packet)}.` : 'Clipboard access is unavailable.')
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <SectionTitle>Resumption Log</SectionTitle>
        <SectionSubtitle>
          Capture interruption-safe continuity data, keep a local packet history, and export what you need without a backend.
        </SectionSubtitle>
      </div>

      <Card highlight="amber" style={{ padding: '18px' }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge tone="amber">draft persisted</Badge>
              <Badge tone="teal">{history.length} saved</Badge>
              <Badge tone="success">clipboard-ready</Badge>
            </div>
            <h3 className="text-2xl font-black tracking-tight" style={{ letterSpacing: '-0.04em' }}>
              Keep the restart packet close enough to copy, export, or load.
            </h3>
            <p className="mt-2 text-sm sm:text-[0.95rem]" style={{ color: 'var(--text-soft)', lineHeight: 1.65 }}>
              Draft fields persist locally. When the state is worth keeping, generate a packet and it becomes part of the recent history on this device.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full lg:w-auto">
            {[
              { label: 'Draft', value: draft.artifact.trim() ? 'set' : 'empty' },
              { label: 'History', value: String(history.length) },
              { label: 'Current', value: currentPacket ? formatPacketDate(currentPacket) : 'unset' },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-[14px] px-3 py-2.5"
                style={{
                  border: '1px solid var(--line)',
                  background: 'rgba(10, 12, 19, 0.38)',
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--text-dim)' }}>
                  {stat.label}
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card style={{ padding: '18px' }}>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="field-label" htmlFor="resumeArtifact">What was the last artifact produced?</label>
            <Input
              id="resumeArtifact"
              value={draft.artifact}
              onChange={value => setDraft(prev => ({ ...prev, artifact: value }))}
              placeholder="index.html update, deployment commit, transcript link"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="resumeAction">What is the next single action?</label>
            <Input
              id="resumeAction"
              value={draft.action}
              onChange={value => setDraft(prev => ({ ...prev, action: value }))}
              placeholder="Run local smoke check and push main"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="resumeBlocker">What is the blocker, if any?</label>
            <Input
              id="resumeBlocker"
              value={draft.blocker}
              onChange={value => setDraft(prev => ({ ...prev, blocker: value }))}
              placeholder="If none, write none"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <ActionBtn onClick={savePacket}>Generate &amp; save packet</ActionBtn>
          <ActionChip variant="primary" onClick={() => void copyCurrentPacket()} disabled={!currentPacket}>
            Copy packet
          </ActionChip>
          <ActionChip variant="secondary" onClick={exportCurrentPacket} disabled={!currentPacket}>
            Export .md
          </ActionChip>
          <ActionChip variant="secondary" onClick={exportHistory} disabled={!history.length}>
            Export history JSON
          </ActionChip>
          <ActionChip variant="danger" onClick={clearHistory} disabled={!history.length}>
            Clear history
          </ActionChip>
        </div>

        <HelperLine variant={status.includes('unavailable') ? 'error' : status ? 'success' : undefined}>
          {status || 'Draft changes persist locally. Generate a packet to snapshot the current restart state.'}
        </HelperLine>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card style={{ padding: '18px', minHeight: 260 }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--text-dim)' }}>
                Current packet
              </div>
              <h3 className="font-bold" style={{ color: 'var(--text)' }}>
                {currentPacket ? formatPacketDate(currentPacket) : 'No packet generated yet'}
              </h3>
            </div>
            {currentPacket ? <Badge tone="amber">saved locally</Badge> : <Badge tone="muted">unsaved</Badge>}
          </div>

          {currentPacket ? (
            <>
              <pre
                className="p-3 rounded-codex text-sm whitespace-pre-wrap break-words"
                style={{
                  border: '1px solid var(--line)',
                  background: '#0f0f18',
                  color: 'var(--text)',
                  minHeight: 160,
                }}
              >
                {currentPacket.markdown}
              </pre>
              <HelperLine>
                The preview reflects the last generated packet. Load a prior entry to restore the draft fields or regenerate after editing.
              </HelperLine>
            </>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-codex text-center" style={{ border: '1px dashed var(--line)', background: 'rgba(10, 12, 19, 0.28)' }}>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                Generate a packet to capture the current artifact, next action, and blocker into local history.
              </p>
            </div>
          )}
        </Card>

        <Card style={{ padding: '18px' }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--text-dim)' }}>
                Recent packets
              </div>
              <h3 className="font-bold" style={{ color: 'var(--text)' }}>
                Local history
              </h3>
            </div>
            <Badge tone="muted">{history.length}</Badge>
          </div>

          <div className="grid gap-3">
            {history.length > 0 ? (
              history.map(packet => (
                <div
                  key={packet.id}
                  className="rounded-[16px] p-3"
                  style={{
                    border: '1px solid var(--line)',
                    background: 'rgba(10, 12, 19, 0.3)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--text-dim)' }}>
                        Saved {formatPacketDate(packet)}
                      </div>
                      <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {packet.artifact.trim() || 'No artifact specified'}
                      </div>
                    </div>
                    {currentPacket?.id === packet.id ? <Badge tone="success">current</Badge> : <Badge tone="muted">saved</Badge>}
                  </div>

                  <div className="mt-3 grid gap-2 text-sm" style={{ color: 'var(--text-soft)' }}>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Next: </span>
                      {packet.action.trim() || 'not specified'}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim)' }}>Blocker: </span>
                      {packet.blocker.trim() || 'not specified'}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionChip variant="primary" onClick={() => loadPacket(packet)}>
                      Load
                    </ActionChip>
                    <ActionChip variant="secondary" onClick={() => void copyHistoryPacket(packet)}>
                      Copy
                    </ActionChip>
                    <ActionChip variant="danger" onClick={() => deletePacket(packet.id)}>
                      Delete
                    </ActionChip>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-[14px] px-3 py-2.5 text-sm" style={{ border: '1px solid var(--line)', color: 'var(--text-dim)' }}>
                No packets saved yet. Use the generator above to capture your first restart snapshot.
              </p>
            )}
          </div>
        </Card>
      </div>
    </section>
  )
}
