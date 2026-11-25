'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { User } from '@supabase/supabase-js'
import type { CaptureItem } from '@/types'
import { supabase } from '@/lib/supabase/client'
import { stableHash } from '@/lib/nextAction'
import { ActionBtn, ActionChip, Badge, Card, SectionSubtitle, SectionTitle } from '@/components/ui'
import styles from './QuickCapturePanel.module.css'

const MAX_MISSION_CONTEXT_CHARS = 6_000

const markdownComponents = {
  // Never fire network requests from captured markdown images.
  img: ({ alt }: { alt?: string }) => <span>{alt || '[image]'}</span>,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className={styles.tableWrap} role="region" aria-label="Scrollable table" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
}

function hasRichStructure(text: string): boolean {
  return text.length > 200 || text.includes('\n') || /\|.*\|/.test(text) || text.includes('```')
}

interface MissionOption {
  id: string
  title: string
  state: string
}

export default function QuickCapturePanel({
  user,
  inbox,
  syncedCaptureIds,
  isSyncing,
  syncError,
  lastSyncedAt,
  onCapture,
  onUpdate,
  onRemove,
  onForceSync,
  onForceSyncItem,
  onExport,
  onClearAll,
  onStatus,
}: {
  user: User | null
  inbox: CaptureItem[]
  syncedCaptureIds: Set<string>
  isSyncing: boolean
  syncError?: string
  lastSyncedAt?: string | null
  onCapture: (text: string) => void
  onUpdate: (id: string, nextText: string) => Promise<{ ok: boolean; synced: boolean; error?: string }>
  onRemove: (id: string) => Promise<{ ok: boolean; error?: string }>
  onForceSync: () => Promise<void> | void
  onForceSyncItem: (item: CaptureItem) => Promise<void> | void
  onExport: () => void
  onClearAll: () => Promise<{ ok: boolean; error?: string }>
  onStatus: (msg: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [missions, setMissions] = useState<MissionOption[]>([])
  const [missionsLoaded, setMissionsLoaded] = useState(false)
  const [targetMissionId, setTargetMissionId] = useState('')
  const [attaching, setAttaching] = useState(false)
  const [attachMessage, setAttachMessage] = useState('')

  const composerRef = useRef<HTMLTextAreaElement>(null)
  const readerDialogRef = useRef<HTMLDialogElement>(null)

  const selectedItem = useMemo(
    () => (selectedId ? inbox.find(item => item.id === selectedId) ?? null : null),
    [inbox, selectedId],
  )

  // Auto-expanding multiline composer height.
  useEffect(() => {
    const field = composerRef.current
    if (!field) return
    field.style.height = 'auto'
    const nextHeight = Math.max(76, Math.min(field.scrollHeight || 76, 220))
    field.style.height = `${nextHeight}px`
  }, [draft])

  // Native top-layer <dialog> for full document reading & editing.
  useEffect(() => {
    const dialog = readerDialogRef.current
    if (!dialog) return
    if (selectedItem) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [selectedItem])

  function submitCapture() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onCapture(trimmed)
    setDraft('')
    onStatus('Captured to inbox')
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      submitCapture()
    }
  }

  function openReader(item: CaptureItem, startEditing = false) {
    setSelectedId(item.id)
    setEditing(startEditing)
    setEditDraft(item.text)
    setEditError('')
    setAttachMessage('')
  }

  function closeReader() {
    setSelectedId(null)
    setEditing(false)
    setEditError('')
    setAttachMessage('')
  }

  async function saveEdit() {
    if (!selectedItem || savingEdit) return
    setSavingEdit(true)
    setEditError('')
    const result = await onUpdate(selectedItem.id, editDraft)
    setSavingEdit(false)
    if (!result.ok) {
      setEditError(result.error || 'Could not update this capture.')
      return
    }
    setEditing(false)
    onStatus(result.synced ? 'Capture updated and synced.' : result.error || 'Capture updated on this device.')
  }

  async function confirmDelete(id: string) {
    const res = await onRemove(id)
    setConfirmDeleteId(null)
    if (selectedId === id) closeReader()
    onStatus(res.ok ? 'Capture deleted.' : res.error || 'Deleted locally; cloud removal unconfirmed.')
  }

  async function confirmClearAll() {
    if (clearing) return
    setClearing(true)
    const res = await onClearAll()
    setClearing(false)
    setConfirmClear(false)
    closeReader()
    onStatus(res.ok ? 'All captures cleared.' : res.error || 'Cleared locally; cloud clear unconfirmed.')
  }

  function copyRaw(item: CaptureItem) {
    navigator.clipboard?.writeText(item.text).then(() => {
      onStatus('Copied original text.')
    }).catch(() => {
      onStatus('Could not copy to clipboard.')
    })
  }

  async function loadActiveMissions() {
    if (!user?.id || missionsLoaded) return
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('id, title, state')
        .eq('user_id', user.id)
        .in('state', ['primary', 'secondary', 'blocked'])
        .order('updated_at', { ascending: false })
        .limit(20)
      if (error) throw error
      const list = (data ?? []) as MissionOption[]
      setMissions(list)
      setMissionsLoaded(true)
      const primary = list.find(m => m.state === 'primary') ?? list[0]
      if (primary) setTargetMissionId(primary.id)
    } catch {
      setAttachMessage('Could not load your saved missions right now.')
    }
  }

  async function attachToMission(item: CaptureItem) {
    if (!user?.id || !targetMissionId || attaching) return
    setAttaching(true)
    setAttachMessage('')
    try {
      const bounded = item.text.slice(0, MAX_MISSION_CONTEXT_CHARS)
      const { error } = await supabase.from('mission_events').insert({
        user_id: user.id,
        mission_id: targetMissionId,
        type: 'delta_context_added',
        idempotency_key: `capture-context:${user.id}:${targetMissionId}:${item.id}:${stableHash(bounded)}`,
        detail: bounded,
      })
      if (error && error.code !== '23505') throw error
      // Record optional link on nd_captures if synced (non-fatal if offline/local-only).
      if (syncedCaptureIds.has(item.id)) {
        await supabase.from('nd_captures').update({ promoted_mission_id: targetMissionId }).eq('id', item.id).eq('user_id', user.id)
      }
      const chosen = missions.find(m => m.id === targetMissionId)
      setAttachMessage(
        `Attached as unverified human-reported context on “${chosen?.title || 'selected mission'}”. Project Review will read it as your note; no action or confirmed lesson was created.`,
      )
    } catch {
      setAttachMessage('Could not attach this capture to the mission. Your original capture is unchanged.')
    } finally {
      setAttaching(false)
    }
  }

  const syncedCount = inbox.filter(item => syncedCaptureIds.has(item.id)).length
  const localOnlyCount = inbox.length - syncedCount

  return (
    <Card className={styles.card}>
      <SectionTitle>Quick Capture (Externalize Now)</SectionTitle>
      <SectionSubtitle>
        Capture notes, Markdown tables, code snippets, or blockers verbatim. Stored as written and isolated to your account.
      </SectionSubtitle>

      <div className={styles.composer}>
        <label htmlFor="quick-capture-input" className={styles.srOnly}>Quick capture note</label>
        <textarea
          id="quick-capture-input"
          ref={composerRef}
          rows={3}
          className={styles.textarea}
          placeholder="Write or paste a note, Markdown table, or thought… (Cmd/Ctrl + Enter to capture)"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onComposerKeyDown}
        />
        <div className={styles.composerFooter}>
          <span className={styles.composerHint}>Markdown supported · stored verbatim</span>
          <ActionBtn onClick={submitCapture} disabled={!draft.trim()}>Capture</ActionBtn>
        </div>
      </div>

      {/* Truthful sync summary + secondary administrative controls */}
      <div className={styles.statusRow}>
        <div className={styles.syncSummary} role="status">
          <span>
            {inbox.length === 0
              ? 'No captures yet'
              : `${inbox.length} capture${inbox.length === 1 ? '' : 's'}`}
          </span>
          {inbox.length > 0 && (
            <span className={styles.syncMeta}>
              {isSyncing
                ? 'Syncing…'
                : !user
                  ? 'Saved on this device only'
                  : localOnlyCount === 0
                    ? 'All synced to your account'
                    : `${syncedCount} synced · ${localOnlyCount} on this device only`}
              {lastSyncedAt && user && !isSyncing ? '' : ''}
            </span>
          )}
        </div>

        <details className={styles.manageDrawer}>
          <summary className={styles.manageSummary}>Manage inbox</summary>
          <div className={styles.manageBody}>
            <div className={styles.manageActions}>
              <ActionChip onClick={() => void onForceSync()} disabled={isSyncing || !user}>
                {isSyncing ? 'Syncing…' : 'Force full sync'}
              </ActionChip>
              <ActionChip onClick={onExport} disabled={inbox.length === 0}>Export JSON</ActionChip>
              <ActionChip
                variant="danger"
                onClick={() => setConfirmClear(true)}
                disabled={inbox.length === 0 || confirmClear}
              >
                Clear all
              </ActionChip>
            </div>
            {confirmClear && (
              <div className={styles.confirmBox} role="alert">
                <p>
                  Delete all {inbox.length} capture{inbox.length === 1 ? '' : 's'} from this device
                  {user ? ' and your signed-in account' : ''}? This cannot be undone.
                </p>
                <div className={styles.confirmActions}>
                  <ActionChip variant="ghost" onClick={() => setConfirmClear(false)} disabled={clearing}>Cancel</ActionChip>
                  <ActionChip variant="danger" onClick={() => void confirmClearAll()} disabled={clearing}>
                    {clearing ? 'Clearing…' : 'Confirm clear all'}
                  </ActionChip>
                </div>
              </div>
            )}
          </div>
        </details>
      </div>

      {syncError && (
        <p className={styles.syncError} role="alert">{syncError}</p>
      )}

      {inbox.length === 0 ? (
        <p className={styles.empty}>
          Inbox empty. Captures stay on this device and sync to your account when you are signed in.
        </p>
      ) : (
        <div className={styles.list}>
          {inbox.map(item => {
            const synced = syncedCaptureIds.has(item.id)
            const rich = hasRichStructure(item.text)
            const deletingThis = confirmDeleteId === item.id
            return (
              <article key={item.id} className={styles.itemCard}>
                <div className={styles.itemMeta}>
                  <time className={styles.itemTime}>{new Date(item.timestamp).toLocaleString()}</time>
                  <div className={styles.itemBadges}>
                    {synced ? (
                      <Badge tone="success">Synced</Badge>
                    ) : (
                      <Badge tone="muted">Local only</Badge>
                    )}
                  </div>
                </div>

                <div className={`${styles.previewBody} ${rich ? styles.previewClamped : ''}`}>
                  <div className={styles.markdown}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {item.text}
                    </ReactMarkdown>
                  </div>
                  {rich && <div className={styles.previewFade} aria-hidden="true" />}
                </div>

                <div className={styles.itemActions}>
                  <ActionChip variant="primary" onClick={() => openReader(item, false)}>
                    {rich ? 'Read full note' : 'Open'}
                  </ActionChip>
                  <ActionChip onClick={() => openReader(item, true)}>Edit</ActionChip>
                  <ActionChip onClick={() => copyRaw(item)}>Copy</ActionChip>
                  {!synced && user && (
                    <ActionChip onClick={() => void onForceSyncItem(item)} disabled={isSyncing}>Sync</ActionChip>
                  )}
                  {deletingThis ? (
                    <span className={styles.inlineConfirm}>
                      <ActionChip variant="danger" onClick={() => void confirmDelete(item.id)}>Confirm delete</ActionChip>
                      <ActionChip variant="ghost" onClick={() => setConfirmDeleteId(null)}>Cancel</ActionChip>
                    </span>
                  ) : (
                    <ActionChip variant="ghost" onClick={() => setConfirmDeleteId(item.id)}>Delete</ActionChip>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Full Document Reader & Verbatim Editor (<dialog> in browser top layer) */}
      <dialog
        ref={readerDialogRef}
        className={styles.readerDialog}
        aria-label="Captured document"
        onCancel={closeReader}
        onClose={closeReader}
        onClick={event => { if (event.target === event.currentTarget) closeReader() }}
      >
        {selectedItem && (
          <div className={styles.readerShell}>
            <header className={styles.readerHeader}>
              <div className={styles.readerTitleGroup}>
                <h3 className={styles.readerTitle}>{editing ? 'Edit capture' : 'Captured note'}</h3>
                <span className={styles.readerSubtitle}>
                  {new Date(selectedItem.timestamp).toLocaleString()} · {syncedCaptureIds.has(selectedItem.id) ? 'Synced' : 'Local only'}
                </span>
              </div>
              <button type="button" className={styles.readerClose} aria-label="Close capture" onClick={closeReader}>✕</button>
            </header>

            <div className={styles.readerContent}>
              {editing ? (
                <div className={styles.editPane}>
                  <label htmlFor="capture-edit-textarea" className={styles.editLabel}>
                    Original captured text (Markdown preserved verbatim)
                  </label>
                  <textarea
                    id="capture-edit-textarea"
                    className={styles.editTextarea}
                    rows={10}
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                  />
                  {editError && <p className={styles.syncError} role="alert">{editError}</p>}
                  <div className={styles.editActions}>
                    <ActionBtn onClick={() => void saveEdit()} disabled={savingEdit || !editDraft.trim()}>
                      {savingEdit ? 'Saving…' : 'Save changes'}
                    </ActionBtn>
                    <ActionChip variant="ghost" onClick={() => { setEditing(false); setEditDraft(selectedItem.text); setEditError('') }}>
                      Cancel
                    </ActionChip>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.markdown}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {selectedItem.text}
                    </ReactMarkdown>
                  </div>

                  {user && (
                    <details
                      className={styles.missionBridge}
                      onToggle={event => {
                        if ((event.currentTarget as HTMLDetailsElement).open) void loadActiveMissions()
                      }}
                    >
                      <summary>Use as mission context (optional)</summary>
                      <div className={styles.missionBridgeBody}>
                        <p className={styles.bridgeNote}>
                          Attaches this capture as unverified human-reported context (<code>delta_context_added</code>) for Project Review. Does not create a saved action or confirmed lesson.
                        </p>
                        {missions.length > 0 ? (
                          <div className={styles.bridgeControls}>
                            <label htmlFor="capture-target-mission" className={styles.srOnly}>Target mission</label>
                            <select
                              id="capture-target-mission"
                              className={styles.bridgeSelect}
                              value={targetMissionId}
                              onChange={e => setTargetMissionId(e.target.value)}
                            >
                              {missions.map(m => (
                                <option key={m.id} value={m.id}>{m.title} ({m.state})</option>
                              ))}
                            </select>
                            <ActionChip variant="primary" onClick={() => void attachToMission(selectedItem)} disabled={attaching || !targetMissionId}>
                              {attaching ? 'Attaching…' : 'Attach to mission context'}
                            </ActionChip>
                          </div>
                        ) : missionsLoaded ? (
                          <p className={styles.bridgeNote}>No active Primary, Secondary, or Blocked missions found yet.</p>
                        ) : (
                          <p className={styles.bridgeNote}>Loading your active missions…</p>
                        )}
                        {attachMessage && <p className={styles.bridgeResult} role="status">{attachMessage}</p>}
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>

            {!editing && (
              <footer className={styles.readerFooter}>
                <ActionChip onClick={() => { setEditDraft(selectedItem.text); setEditing(true) }}>Edit</ActionChip>
                <ActionChip onClick={() => copyRaw(selectedItem)}>Copy Markdown</ActionChip>
                <ActionChip variant="danger" onClick={() => void confirmDelete(selectedItem.id)}>Delete</ActionChip>
              </footer>
            )}
          </div>
        )}
      </dialog>
    </Card>
  )
}
