'use client'

import { useState } from 'react'
import { CODEX_SECTIONS, flattenEntries } from '@/data/codex'
import type { CodexEntry, CodexSection } from '@/types'
import { SectionTitle, SectionSubtitle } from '@/components/ui'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function CodexTab() {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [activeEntry, setActiveEntry] = useState<CodexEntry | null>(null)
  const [search, setSearch] = useState('')

  const filteredSections = search.trim()
    ? CODEX_SECTIONS.map(s => ({
        ...s,
        entries: flattenEntries(s.entries).filter(e =>
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.content.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(s => s.entries.length > 0)
    : CODEX_SECTIONS

  return (
    <section>
      <SectionTitle>Codex</SectionTitle>
      <SectionSubtitle>
        Knowledge graph — the systematic record of Edward Emory Photography's operating principles, creative frameworks, and strategic decisions.
      </SectionSubtitle>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search codex entries…"
          style={{
            width: '100%',
            border: '1px solid var(--line-strong)',
            borderRadius: 10,
            background: '#0f0f18',
            color: 'var(--text)',
            font: 'inherit',
            padding: '11px 12px',
            minHeight: 44,
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <nav
          className="rounded-codex overflow-hidden"
          style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}
        >
          {filteredSections.map(section => (
            <SectionGroup
              key={section.key}
              section={section}
              entries={flattenEntries(section.entries)}
              activeId={activeEntry?.id ?? null}
              expanded={activeSection === section.key}
              onToggle={() => setActiveSection(v => v === section.key ? null : section.key)}
              onSelect={entry => {
                setActiveEntry(entry)
                setActiveSection(section.key)
              }}
            />
          ))}
          {filteredSections.length === 0 && (
            <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-dim)' }}>
              No entries found.
            </p>
          )}
        </nav>

        {/* Content */}
        <div
          className="rounded-codex p-5"
          style={{
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            minHeight: 400,
          }}
        >
          {activeEntry ? (
            <CodexContent entry={activeEntry} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-4xl mb-4 opacity-20" style={{ color: 'var(--teal)' }}>◈</div>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                Select an entry from the sidebar
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
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
  onSelect: (e: CodexEntry) => void
}) {
  const sectionColors: Record<string, string> = {
    root:       'var(--teal)',
    council:    '#a855f7',
    territory:  'var(--success)',
    artistic:   'var(--amber)',
    neuro:      '#06b6d4',
    automation: '#f97316',
    business:   '#ec4899',
    personalos: '#8b5cf6',
    convergence:'#14b8a6',
  }
  const color = sectionColors[section.key] ?? 'var(--text-soft)'

  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <span className="text-xs font-bold" style={{ color }}>
          {expanded ? '▾' : '▸'}
        </span>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-soft)' }}>
          {section.label}
        </span>
      </button>
      {expanded && (
        <div>
          {entries.map(entry => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry)}
              className="w-full text-left px-5 py-1.5 text-xs transition-colors"
              style={{
                background: activeId === entry.id ? 'var(--teal-soft)' : 'transparent',
                color: activeId === entry.id ? 'var(--teal)' : 'var(--text-soft)',
                border: 'none',
                cursor: 'pointer',
                borderLeft: activeId === entry.id ? '2px solid var(--teal)' : '2px solid transparent',
              }}
            >
              {entry.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CodexContent({ entry }: { entry: CodexEntry }) {
  return (
    <div>
      <div className="mb-4 pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
        <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-dim)' }}>
          {entry.path}
        </p>
        {entry.tags && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {entry.tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ border: '1px solid var(--line-strong)', color: 'var(--text-dim)', background: 'var(--surface-soft)' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
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
    </div>
  )
}
