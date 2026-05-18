'use client'

import { useState } from 'react'
import { PROTOCOLS } from '@/data/principles'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { SectionTitle, SectionSubtitle, Tag, HelperLine, Input, ActionBtn } from '@/components/ui'

interface DeployStatus {
  localFile: string
  repo: string
  url: string
  exported: string
  savedAt: string | null
}

const DEFAULT_DEPLOY: DeployStatus = {
  localFile: 'YES — index.html committed to GitHub',
  repo: 'https://github.com/edwardemoryphotography/legacy-codex',
  url: 'https://legacy-codex.vercel.app',
  exported: new Date().toISOString().slice(0, 10),
  savedAt: null,
}

export default function ProtocolsTab() {
  const [deploy, setDeploy] = useLocalStorage<DeployStatus>('codex_v27_deploy', DEFAULT_DEPLOY)
  const [localFile, setLocalFile] = useState(DEFAULT_DEPLOY.localFile)
  const [repo, setRepo] = useState(DEFAULT_DEPLOY.repo)
  const [url, setUrl] = useState(DEFAULT_DEPLOY.url)
  const [exported, setExported] = useState(DEFAULT_DEPLOY.exported)

  const save = () => {
    const next: DeployStatus = {
      localFile: localFile || DEFAULT_DEPLOY.localFile,
      repo: repo || DEFAULT_DEPLOY.repo,
      url: url || DEFAULT_DEPLOY.url,
      exported: exported || DEFAULT_DEPLOY.exported,
      savedAt: new Date().toLocaleString(),
    }
    setDeploy(next)
  }

  return (
    <section>
      <SectionTitle>Protocols</SectionTitle>
      <SectionSubtitle>
        Operational cards are collapsed by default. Expand to inspect trigger/output pairs.
      </SectionSubtitle>

      {PROTOCOLS.map(p => (
        <details
          key={p.id}
          className="mb-2 overflow-hidden"
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
          }}
        >
          <summary
            className="cursor-pointer px-4 py-3 font-bold list-none"
            style={{
              color: 'var(--amber)',
              background: 'linear-gradient(180deg, #1b1b29, #161623)',
            }}
          >
            {p.number}. {p.title}
          </summary>
          <div
            className="px-4 py-3 grid gap-1.5 text-sm"
            style={{ color: 'var(--text-soft)' }}
          >
            <div>
              <span className="font-bold" style={{ color: 'var(--text)' }}>Trigger:</span>{' '}
              {p.trigger}
            </div>
            <div>
              <span className="font-bold" style={{ color: 'var(--text)' }}>Output:</span>{' '}
              {p.output}
            </div>
            {p.steps && (
              <div className="mt-1 grid gap-1">
                {p.steps.map((step, i) => (
                  <div key={i} style={{ color: 'var(--text-dim)' }}>
                    ({i + 1}) {step}
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      ))}

      {/* Convergence Event */}
      <StaticCard accent="amber">
        <h3>Convergence Event</h3>
        <p>
          <strong>Map→Territory Collapse — 2025-11-30</strong>
        </p>
        <p>
          &ldquo;The irreversible shift from planning how to work to the work being the system.&rdquo;
        </p>
      </StaticCard>

      {/* Deployment Status */}
      <StaticCard accent="amber" className="mt-3">
        <h3>Deployment Status</h3>
        <div
          className="grid gap-3 mt-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
        >
          <div>
            <label className="field-label" htmlFor="localFile">Local file saved</label>
            <Input id="localFile" value={localFile} onChange={setLocalFile} />
          </div>
          <div>
            <label className="field-label" htmlFor="repo">GitHub repo</label>
            <Input id="repo" type="url" value={repo} onChange={setRepo} />
          </div>
          <div>
            <label className="field-label" htmlFor="url">Public URL</label>
            <Input id="url" type="url" value={url} onChange={setUrl} />
          </div>
          <div>
            <label className="field-label" htmlFor="exported">Last exported</label>
            <Input id="exported" type="date" value={exported} onChange={setExported} />
          </div>
        </div>
        <div className="mt-3">
          <ActionBtn onClick={save}>Save</ActionBtn>
          <HelperLine>
            Status fields reflect user-declared state. Last saved:{' '}
            {deploy.savedAt ?? 'never saved'}
          </HelperLine>
        </div>
      </StaticCard>

      {/* Open Deficits */}
      <StaticCard accent="amber" className="mt-3">
        <h3>Open Deficits</h3>
        <div className="grid gap-2 mt-3">
          <DeficitRow tag="resolved">System Persistence → Public URL live</DeficitRow>
          <DeficitRow tag="fail">Version History → v1–v16 unrecovered</DeficitRow>
          <DeficitRow tag="open">Tab count discrepancy → under investigation</DeficitRow>
        </div>
      </StaticCard>
    </section>
  )
}

function StaticCard({
  children,
  accent = 'amber',
  className = '',
}: {
  children: React.ReactNode
  accent?: 'teal' | 'amber'
  className?: string
}) {
  return (
    <div
      className={`p-4 mb-2 ${className}`}
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
      }}
    >
      <style>{`
        .static-card-inner h3 {
          font-size: 0.95rem;
          margin-bottom: 8px;
          color: var(--${accent});
        }
        .static-card-inner p, .static-card-inner li {
          color: var(--text-soft);
          font-size: 0.9rem;
        }
        .field-label {
          display: block;
          font-size: 0.8rem;
          color: var(--text-dim);
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
      `}</style>
      <div className="static-card-inner">{children}</div>
    </div>
  )
}

function DeficitRow({
  tag,
  children,
}: {
  tag: 'resolved' | 'fail' | 'open'
  children: React.ReactNode
}) {
  return (
    <div
      className="flex gap-2 flex-wrap items-center px-3 py-2.5 rounded-[10px] text-sm"
      style={{
        border: '1px solid var(--line)',
        background: 'var(--surface-soft)',
        color: 'var(--text-soft)',
      }}
    >
      <Tag variant={tag}>{tag === 'resolved' ? 'Resolved' : tag === 'fail' ? 'Fail' : 'Open'}</Tag>
      {children}
    </div>
  )
}
