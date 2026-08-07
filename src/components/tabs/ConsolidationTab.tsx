'use client'

import { SectionTitle, SectionSubtitle } from '@/components/ui'

interface ChecklistItem {
  name: string
  action: 'keep' | 'rename' | 'delete'
  note?: string
}

const KEEP: ChecklistItem[] = [
  { name: 'legacy-codex', action: 'keep', note: 'Primary front door (legacy-codex.vercel.app)' },
  { name: 'codex-control-panel', action: 'keep' },
  { name: 'codex-system-architecture', action: 'keep' },
  { name: 'neuroviz-eeg-3d-mvp / Artful-Intelligence', action: 'keep', note: 'Only if you still actively use them' },
  { name: 'camera-and-object-detection-app (ArchiLens)', action: 'keep' },
  { name: 'PocketForge / phone-app builder', action: 'keep', note: 'Keep only one clean version' },
]

const RENAME: ChecklistItem[] = [
  { name: '"frontend"', action: 'rename', note: 'Rename to legacy-codex (or delete the duplicate "legacy-codex" kappa project)' },
  { name: 'legacy-codex (kappa / legacy-codex-kappa.vercel.app)', action: 'delete', note: 'Duplicate — delete after the main one is correctly named' },
]

const DELETE_GENERIC = [
  'nextjs', 'create-react-app', 'portfolio', 'test', 'v0-', 'untitled',
  'Any project with only a date in the name',
  'Old GitHub Pages experiments',
  'Anything with no deployment in 90+ days that is not in the KEEP list',
]

export default function ConsolidationTab() {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // no toast needed — keep it silent and fast
    })
  }

  return (
    <section>
      <SectionTitle>Consolidation Checklist</SectionTitle>
      <SectionSubtitle>
        29 Vercel projects → clean single front door. Delete duplicates and dead experiments. Code stays safe on GitHub.
      </SectionSubtitle>

      <div className="mb-6 p-4 rounded-codex" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
        <p className="text-sm" style={{ color: 'var(--text-soft)', lineHeight: 1.55 }}>
          <strong>Rule:</strong> If it’s not one of the 6 core projects below and hasn’t been touched in 90+ days, delete it.
          Deleting a Vercel project does <em>not</em> delete your code on GitHub.
        </p>
      </div>

      {/* KEEP */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold tracking-widest uppercase px-2 py-1 rounded" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
            KEEP
          </span>
          <span className="text-sm text-tx-dim">6 projects — actively used or foundational</span>
        </div>
        <div className="space-y-2">
          {KEEP.map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-codex" style={{ border: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
              <div className="mt-0.5 text-success">✓</div>
              <div className="flex-1 text-sm">
                <div className="font-mono text-sm">{item.name}</div>
                {item.note && <div className="text-xs text-tx-dim mt-0.5">{item.note}</div>}
              </div>
              <button onClick={() => copy(item.name)} className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--line)' }}>
                Copy
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* RENAME / CONSOLIDATE */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold tracking-widest uppercase px-2 py-1 rounded" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
            RENAME / DELETE DUPLICATE
          </span>
          <span className="text-sm text-tx-dim">2 projects causing the “different URLs” problem</span>
        </div>
        <div className="space-y-2">
          {RENAME.map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-codex" style={{ border: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
              <div className="mt-0.5 text-amber">⚠</div>
              <div className="flex-1 text-sm">
                <div className="font-mono text-sm">{item.name}</div>
                {item.note && <div className="text-xs text-tx-dim mt-0.5">{item.note}</div>}
              </div>
              <button onClick={() => copy(item.name)} className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--line)' }}>
                Copy
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* DELETE */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold tracking-widest uppercase px-2 py-1 rounded" style={{ background: 'var(--error-soft)', color: 'var(--error)' }}>
            DELETE (~21 projects)
          </span>
          <span className="text-sm text-tx-dim">Dead experiments, v0 prototypes, generic tests</span>
        </div>
        <div className="p-4 rounded-codex text-sm" style={{ border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <p className="mb-3 text-tx-dim">Search these patterns in your Vercel dashboard and delete any matches that are not in the KEEP list:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {DELETE_GENERIC.map((p, i) => (
              <div key={i} className="px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>{p}</div>
            ))}
          </div>
          <p className="mt-4 text-xs text-tx-dim">Anything with no deployment in the last 90 days that isn’t one of the 6 core projects above.</p>
        </div>
      </div>

      <div className="mt-8 text-xs text-tx-dim">
        After cleanup you will have one canonical URL: <span className="font-mono text-teal">legacy-codex.vercel.app</span>
      </div>
    </section>
  )
}
