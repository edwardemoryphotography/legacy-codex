'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import {
  CODEX_SECTIONS,
  findSectionByEntryId,
  flattenEntries,
  serializeEntryMarkdown,
} from '@/data/codex'
import type { CodexEntry, CodexSection, SectionKey } from '@/types'
import { ActionChip, Badge, Card, HelperLine, SectionSubtitle, SectionTitle } from '@/components/ui'
import { supabase } from '@/lib/supabase/client'

const BOOKMARKS_KEY = 'codex_v39_codex_bookmarks'
const RECENTS_KEY = 'codex_v39_recent_entries'
const MAX_BOOKMARKS = 12
const MAX_RECENTS = 8

const SECTION_META: Record<SectionKey, { tone: 'teal' | 'amber' | 'success' | 'error'; emoji: string; accent: string }> = {
  root: { tone: 'teal', emoji: '◌', accent: 'var(--teal)' },
  council: { tone: 'success', emoji: '◈', accent: 'var(--success)' },
  territory: { tone: 'amber', emoji: '⌂', accent: 'var(--amber)' },
  artistic: { tone: 'amber', emoji: '✦', accent: 'var(--amber)' },
  neuro: { tone: 'teal', emoji: '◬', accent: 'var(--teal)' },
  automation: { tone: 'error', emoji: '↯', accent: 'var(--error)' },
  business: { tone: 'success', emoji: '◎', accent: 'var(--success)' },
  personalos: { tone: 'teal', emoji: '◧', accent: 'var(--teal)' },
  convergence: { tone: 'amber', emoji: '◉', accent: 'var(--amber)' },
}

function pushRecent(ids: string[], id: string, limit = MAX_RECENTS) {
  return [id, ...ids.filter(existing => existing !== id)].slice(0, limit)
}

function removeId(ids: string[], id: string) {
  return ids.filter(existing => existing !== id)
}

function makeEntryUrl(entryId: string) {
  if (typeof window === 'undefined') return '#'
  const url = new URL(window.location.href)
  url.hash = `codex=${encodeURIComponent(entryId)}`
  return url.toString()
}

function syncEntryHash(entryId: string) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.hash = `codex=${encodeURIComponent(entryId)}`
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
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

export default function CodexTab() {
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState<SectionKey | null>(CODEX_SECTIONS[0]?.key ?? null)
  const [activeEntry, setActiveEntry] = useState<CodexEntry | null>(CODEX_SECTIONS[0]?.entries[0] ?? null)
  const [bookmarks, setBookmarks] = useLocalStorage<string[]>(BOOKMARKS_KEY, [])
  const [recents, setRecents] = useLocalStorage<string[]>(RECENTS_KEY, [])
  const [status, setStatus] = useState('')

  // Supabase hybrid for bookmarks (saved "searches"/pins) — same pattern as Controls
  const [sbUser, setSbUser] = useState<User | null>(null)
  const [sbConnected, setSbConnected] = useState(false)
  const [sbSyncing, setSbSyncing] = useState(false)
  const [sbStatus, setSbStatus] = useState('')

  const allEntries = useMemo(() => CODEX_SECTIONS.flatMap(section => flattenEntries(section.entries)), [])
  const entryMap = useMemo(() => new Map(allEntries.map(entry => [entry.id, entry])), [allEntries])
  const trimmed = search.trim().toLowerCase()

  const filteredSections = useMemo(() => {
    // Normalize once. Re-flattening a filtered parent with its matching
    // child duplicates that child and brings non-matches back into search.
    return CODEX_SECTIONS.map(section => {
      const entries = flattenEntries(section.entries).filter(entry =>
        !trimmed || entry.title.toLowerCase().includes(trimmed) || entry.content.toLowerCase().includes(trimmed)
      )
      return { ...section, entries }
    }).filter(section => section.entries.length > 0)
  }, [trimmed])

  const visibleEntries = useMemo(
    () => filteredSections.flatMap(section => section.entries),
    [filteredSections]
  )

  const sectionCount = CODEX_SECTIONS.length
  const totalEntries = allEntries.length

  const bookmarkedEntries = useMemo(
    () => bookmarks.map(id => entryMap.get(id)).filter(Boolean) as CodexEntry[],
    [bookmarks, entryMap]
  )
  const recentEntries = useMemo(
    () => recents.map(id => entryMap.get(id)).filter(Boolean) as CodexEntry[],
    [recents, entryMap]
  )

  const loadBookmarksFromSupabase = useCallback(async (userId: string) => {
    if (!userId) return
    try {
      const { data } = await supabase
        .from('nd_codex_bookmarks')
        .select('entry_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(12)
      if (data && data.length) {
        const ids = data.map((r: { entry_id: string }) => r.entry_id)
        setBookmarks(ids)
        setSbStatus('Bookmarks loaded from your account')
        setTimeout(() => setSbStatus(''), 700)
      }
    } catch {
      setSbStatus('Account bookmarks could not be loaded. Your local pins are kept.')
      setTimeout(() => setSbStatus(''), 1200)
    }
  }, [setBookmarks])

  // Auth + load bookmarks from Supabase (user scoped)
  useEffect(() => {
    async function initSb() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const u = session?.user || null
        if (u) {
          setSbUser(u)
          setSbConnected(true)
          await loadBookmarksFromSupabase(u.id)
        } else {
          const key = (supabase as unknown as { supabaseKey?: string })?.supabaseKey || ''
          if (key && !key.includes('your-anon')) {
            setSbConnected(false)
            setSbStatus('Sign in from Controls to sync bookmarks')
          }
        }
      } catch {}
    }
    initSb()
  }, [loadBookmarksFromSupabase])

  async function syncBookmarkToSupabase(entryId: string, isAdd: boolean) {
    if (!sbUser?.id) return
    setSbSyncing(true)
    try {
      if (isAdd) {
        await supabase.from('nd_codex_bookmarks').insert({ user_id: sbUser.id, entry_id: entryId })
      } else {
        await supabase.from('nd_codex_bookmarks').delete().eq('user_id', sbUser.id).eq('entry_id', entryId)
      }
      setSbStatus(isAdd ? 'Pinned to your account' : 'Unpinned from your account')
      setTimeout(() => setSbStatus(''), 600)
    } catch {
      setSbStatus('Account bookmark sync failed')
      setTimeout(() => setSbStatus(''), 1200)
    } finally {
      setSbSyncing(false)
    }
  }

  async function forceSyncBookmarks() {
    if (!sbUser?.id) {
      setSbStatus('Sign in (via Controls) first')
      setTimeout(() => setSbStatus(''), 1500)
      return
    }
    setSbSyncing(true)
    setSbStatus('Syncing bookmarks…')
    try {
      // push current local bookmarks
      if (bookmarks.length > 0) {
        const rows = bookmarks.map(id => ({ user_id: sbUser.id, entry_id: id }))
        await supabase.from('nd_codex_bookmarks').upsert(rows, { onConflict: 'user_id,entry_id' })
      }
      // pull back authoritative
      await loadBookmarksFromSupabase(sbUser.id)
      setSbStatus('Bookmarks force-synced')
    } catch {
      setSbStatus('Force bookmark sync error')
    } finally {
      setSbSyncing(false)
      setTimeout(() => setSbStatus(''), 1400)
    }
  }

  const selectEntry = (
    entry: CodexEntry,
    options?: {
      clearSearch?: boolean
      trackRecent?: boolean
    }
  ) => {
    setActiveEntry(entry)
    setActiveSection(findSectionByEntryId(entry.id)?.key ?? entry.section)

    if (options?.clearSearch) {
      setSearch('')
    }

    if (options?.trackRecent ?? true) {
      setRecents(prev => pushRecent(prev, entry.id))
    }

    syncEntryHash(entry.id)
    setStatus(`Selected ${entry.title}.`)
  }

  useEffect(() => {
    const applyHash = () => {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const entryId = params.get('codex')
      if (!entryId) return

      const entry = entryMap.get(entryId)
      if (!entry) return

      setSearch('')
      setActiveEntry(entry)
      setActiveSection(findSectionByEntryId(entry.id)?.key ?? entry.section)
      setRecents(prev => pushRecent(prev, entry.id))
    }

    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [entryMap, setRecents])

  useEffect(() => {
    if (!trimmed) return
    if (!visibleEntries.length) {
      setActiveEntry(null)
      return
    }

    const stillVisible = activeEntry && visibleEntries.some(entry => entry.id === activeEntry.id)
    if (stillVisible) return

    const next = visibleEntries[0]
    setActiveEntry(next)
    setActiveSection(findSectionByEntryId(next.id)?.key ?? next.section)
    syncEntryHash(next.id)
  }, [activeEntry, trimmed, visibleEntries])

  const toggleBookmark = (entry: CodexEntry) => {
    const isAdding = !bookmarks.includes(entry.id)
    setBookmarks(prev =>
      prev.includes(entry.id)
        ? removeId(prev, entry.id)
        : [entry.id, ...prev].slice(0, MAX_BOOKMARKS)
    )
    setStatus(bookmarks.includes(entry.id) ? `Unpinned ${entry.title}.` : `Pinned ${entry.title}.`)

    // Wire Supabase pattern (same as Controls captures/prefs)
    if (sbUser?.id) {
      syncBookmarkToSupabase(entry.id, isAdding)
    }
  }

  const copyLink = async (entry: CodexEntry) => {
    const success = await copyToClipboard(makeEntryUrl(entry.id))
    setStatus(success ? `Copied link for ${entry.title}.` : 'Clipboard access is unavailable.')
  }

  const copyMarkdown = async (entry: CodexEntry) => {
    const success = await copyToClipboard(serializeEntryMarkdown(entry))
    setStatus(success ? `Copied markdown for ${entry.title}.` : 'Clipboard access is unavailable.')
  }

  const exportMarkdown = (entry: CodexEntry) => {
    downloadText(`codex-${entry.id}.md`, serializeEntryMarkdown(entry), 'text/markdown;charset=utf-8')
    setStatus(`Exported markdown for ${entry.title}.`)
  }

  return (
    <section className="codex-library">
      <div className="space-y-2">
        <p className="library-eyebrow">Your reference library</p>
        <SectionTitle>Codex</SectionTitle>
        <SectionSubtitle>
          The ideas, principles, and decisions you can come back to.
        </SectionSubtitle>
      </div>

      <Card className="library-search">
        <p>Search your system. Keep what matters close.</p>
        <div className="library-counts">
          <span>{sectionCount} sections</span>
          <span>{totalEntries} entries</span>
          <span>{bookmarkedEntries.length} pinned</span>
          {sbSyncing && <span>syncing…</span>}
        </div>
        <div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search codex entries…"
            aria-label="Search codex entries"
            style={{
              width: '100%',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--field-bg)',
              color: 'var(--text)',
              font: 'inherit',
              padding: '12px 14px',
              minHeight: 46,
            }}
          />
        </div>
        <ActionChip onClick={forceSyncBookmarks} disabled={sbSyncing || !sbUser}>
          {sbUser ? 'Sync bookmarks' : 'Sign in from Controls to sync bookmarks'}
        </ActionChip>
        {sbStatus && <p className="library-sync-status">{sbStatus}</p>}
      </Card>

      <div className="library-layout">
        <Card className="library-sidebar">
          {(bookmarkedEntries.length > 0 || recentEntries.length > 0) && <div className="grid gap-3 mb-4">
            {bookmarkedEntries.length > 0 && <QuickAccessList
              title="Pinned"
              items={bookmarkedEntries}
              emptyMessage="Pin an entry to keep it close. Sign in to sync your pins."
              onOpen={entry => selectEntry(entry, { clearSearch: true })}
              onAction={toggleBookmark}
              actionLabel={() => 'Unpin'}
            />}
            {recentEntries.length > 0 && <QuickAccessList
              title="Recent"
              items={recentEntries}
              emptyMessage="Recent selections will appear here automatically."
              onOpen={entry => selectEntry(entry, { clearSearch: true })}
              onAction={entry => toggleBookmark(entry)}
              actionLabel={entry => (bookmarks.includes(entry.id) ? 'Unpin' : 'Pin')}
            />}
          </div>}

          <nav className="grid gap-2" aria-label="Codex sections">
            {filteredSections.map(section => (
              <SectionGroup
                key={section.key}
                section={section}
                entries={section.entries}
                activeId={activeEntry?.id ?? null}
                expanded={activeSection === section.key}
                onToggle={() => setActiveSection(v => (v === section.key ? null : section.key))}
                onSelect={entry => selectEntry(entry, { trackRecent: true })}
              />
            ))}
            {filteredSections.length === 0 && (
              <p className="px-2 py-2 text-sm" style={{ color: 'var(--text-dim)' }}>
                No entries found.
              </p>
            )}
          </nav>
        </Card>

        <Card className="library-article">
          {activeEntry ? (
            <CodexContent
              entry={activeEntry}
              bookmarked={bookmarks.includes(activeEntry.id)}
              onToggleBookmark={toggleBookmark}
              onCopyLink={copyLink}
              onCopyMarkdown={copyMarkdown}
              onExportMarkdown={exportMarkdown}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-4xl mb-4 opacity-20" style={{ color: 'var(--teal)' }}>◈</div>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                Select an entry or search to find what you need.
              </p>
            </div>
          )}
        </Card>
      </div>

      <HelperLine variant={status.includes('unavailable') ? 'error' : status ? 'success' : undefined}>
        {status || (sbConnected ? 'Your pins are kept on this device. Sync bookmarks to keep them with your account.' : 'Your pins are kept on this device. Sign in from Controls to sync them to your account.')}
      </HelperLine>
    </section>
  )
}

function QuickAccessList({
  title,
  items,
  emptyMessage,
  onOpen,
  onAction,
  actionLabel,
}: {
  title: string
  items: CodexEntry[]
  emptyMessage: string
  onOpen: (entry: CodexEntry) => void
  onAction: (entry: CodexEntry) => void
  actionLabel: string | ((entry: CodexEntry) => string)
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'var(--text-dim)' }}>
          {title}
        </div>
        <Badge tone="muted">{items.length}</Badge>
      </div>

      <div className="grid gap-2">
        {items.length > 0 ? (
          items.map(entry => (
            <div key={entry.id} className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => onOpen(entry)}
                className="flex-1 text-left"
                style={{
                  border: '1px solid var(--line-strong)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '10px 12px',
                  background: 'var(--field-bg)',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  {entry.title}
                </div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                  {entry.path}
                </div>
              </button>
              <ActionChip variant="ghost" onClick={() => onAction(entry)}>
                {typeof actionLabel === 'function' ? actionLabel(entry) : actionLabel}
              </ActionChip>
            </div>
          ))
        ) : (
          <p className="rounded-[14px] px-3 py-2.5 text-sm" style={{ border: '1px solid var(--line)', color: 'var(--text-dim)' }}>
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  )
}

function SectionGroup({
  section,
  entries,
  activeId,
  expanded,
  onToggle,
  onSelect,
}: {
  section: CodexSection
  entries: CodexEntry[]
  activeId: string | null
  expanded: boolean
  onToggle: () => void
  onSelect: (entry: CodexEntry) => void
}) {
  const meta = SECTION_META[section.key]

  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'var(--card-bg)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        style={{
          cursor: 'pointer',
          border: 'none',
          background: expanded ? `linear-gradient(180deg, ${meta.accent}18, var(--surface))` : 'transparent',
          padding: '12px',
          color: 'inherit',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-sm font-black"
              style={{ background: `${meta.accent}18`, color: meta.accent }}
            >
              {meta.emoji}
            </span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.24em] mb-1" style={{ color: 'var(--text-dim)' }}>
                {section.label}
              </div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                {section.description}
              </div>
            </div>
          </div>
          <Badge tone={meta.tone}>{entries.length}</Badge>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {entries.map(entry => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry)}
              className="w-full text-left"
              style={{
                background: activeId === entry.id ? 'var(--teal-soft)' : 'transparent',
                color: activeId === entry.id ? 'var(--teal)' : 'var(--text-soft)',
                border: 'none',
                cursor: 'pointer',
                padding: '10px 12px 10px 58px',
                borderLeft: activeId === entry.id ? '2px solid var(--teal)' : '2px solid transparent',
              }}
            >
              <div className="text-sm font-medium">{entry.title}</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                {entry.path}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CodexContent({
  entry,
  bookmarked,
  onToggleBookmark,
  onCopyLink,
  onCopyMarkdown,
  onExportMarkdown,
}: {
  entry: CodexEntry
  bookmarked: boolean
  onToggleBookmark: (entry: CodexEntry) => void
  onCopyLink: (entry: CodexEntry) => Promise<void>
  onCopyMarkdown: (entry: CodexEntry) => Promise<void>
  onExportMarkdown: (entry: CodexEntry) => void
}) {
  return (
    <div>
      <div className="mb-4 pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge tone="teal">{entry.section}</Badge>
          {entry.category && <Badge tone="muted">{entry.category}</Badge>}
          {entry.tags?.slice(0, 3).map(tag => (
            <Badge key={tag} tone="muted">#{tag}</Badge>
          ))}
          {bookmarked && <Badge tone="amber">pinned</Badge>}
        </div>
        <p className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
          {entry.path}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <ActionChip variant="primary" onClick={() => void onCopyLink(entry)}>
          Copy link
        </ActionChip>
        <ActionChip variant="secondary" onClick={() => void onCopyMarkdown(entry)}>
          Copy markdown
        </ActionChip>
        <ActionChip variant="secondary" onClick={() => onExportMarkdown(entry)}>
          Export .md
        </ActionChip>
        <ActionChip variant={bookmarked ? 'danger' : 'ghost'} onClick={() => onToggleBookmark(entry)}>
          {bookmarked ? 'Unpin' : 'Pin'}
        </ActionChip>
      </div>

      <div className="codex-markdown text-sm" style={{ color: 'var(--text-soft)', lineHeight: 1.7 }}>
        <style>{`
          .codex-markdown h1 { font-size: 1.25rem; font-weight: 700; color: var(--text); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
          .codex-markdown h2 { font-size: 1rem; font-weight: 700; color: var(--text); margin-top: 24px; margin-bottom: 8px; }
          .codex-markdown h3 { font-size: 0.9rem; font-weight: 600; color: var(--text-soft); margin-top: 16px; margin-bottom: 6px; }
          .codex-markdown p { margin-bottom: 12px; }
          .codex-markdown ul { margin-left: 16px; margin-bottom: 12px; list-style: none; }
          .codex-markdown ul li::before { content: "—"; margin-right: 8px; color: var(--text-dim); }
          .codex-markdown ol { margin-left: 16px; margin-bottom: 12px; }
          .codex-markdown code { color: var(--amber); font-size: 0.85em; background: var(--surface-strong); padding: 2px 5px; border-radius: 4px; }
          .codex-markdown pre { background: var(--surface-strong); border: 1px solid var(--line); border-radius: 8px; padding: 12px; margin-bottom: 12px; overflow-x: auto; }
          .codex-markdown pre code { background: transparent; padding: 0; color: var(--text-soft); }
          .codex-markdown blockquote { border-left: 2px solid var(--teal); padding-left: 12px; color: var(--text-dim); font-style: italic; margin-bottom: 12px; }
          .codex-markdown table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 0.85rem; }
          .codex-markdown th { text-align: left; color: var(--text-dim); border-bottom: 1px solid var(--line); padding-bottom: 6px; padding-right: 12px; }
          .codex-markdown td { border-bottom: 1px solid var(--line); padding: 6px 12px 6px 0; }
          .codex-markdown strong { color: var(--text); font-weight: 600; }
          .codex-markdown hr { border-color: var(--line); margin: 20px 0; }
          .codex-markdown a { color: var(--teal); }
        `}</style>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {entry.content}
        </ReactMarkdown>
      </div>

      <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
        <HelperLine>
          Pins stay on this device. Sign in to sync them with your account.
        </HelperLine>
      </div>
    </div>
  )
}
