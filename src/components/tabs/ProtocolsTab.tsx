'use client'

import { useState } from 'react'
import { PROTOCOLS } from '@/data/principles'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { ActionBtn, Badge, Card, HelperLine, Input, SectionSubtitle, SectionTitle, Tag } from '@/components/ui'

interface DeployStatus {
  localFile: string
  repo: string
  url: string
  exported: string
  savedAt: string | null
}

const STORAGE_KEY = 'codex_v38_deploy'

const DEFAULT_DEPLOY: DeployStatus = {
  localFile: 'YES — index.html committed to GitHub',
  repo: 'https://github.com/edwardemoryphotography/legacy-codex',
  url: 'https://legacy-codex.vercel.app',
  exported: new Date().toISOString().slice(0, 10),
  savedAt: null,
}

export default function ProtocolsTab() {
  const [deploy, setDeploy] = useLocalStorage<DeployStatus>(STORAGE_KEY, DEFAULT_DEPLOY)
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
    <section className="space-y-6">
      <div className="space-y-2">
        <SectionTitle>Protocols</SectionTitle>
        <SectionSubtitle>
          Operational cards, deployment state, and the convergence event that made the system explicit.
        </SectionSubtitle>
      </div>

      <Card highlight="amber" style={{ padding: '18px' }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge tone="amber">5 protocols</Badge>
              <Badge tone="teal">deployment</Badge>
              <Badge tone="success">convergence</Badge>
            </div>
            <h3 className="text-2xl font-black tracking-tight" style={{ letterSpacing: '-0.04em' }}>
              Keep the operating system honest.
            </h3>
            <p className="mt-2 text-sm sm:text-[0.95rem]" style={{ color: 'var(--text-soft)', lineHeight: 1.65 }}>
              Expand a protocol when you need the trigger/output pair, or update the deployment card to reflect the actual public state.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
            {[
              { label: 'Local file', value: deploy.localFile, tone: 'success' as const },
              { label: 'Repo', value: deploy.repo.includes('github') ? 'github' : 'set', tone: 'teal' as const },
              { label: 'URL', value: deploy.url.includes('http') ? 'live' : 'set', tone: 'amber' as const },
              { label: 'Exported', value: deploy.exported, tone: 'muted' as const },
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
                <div className="mt-1 text-sm font-semibold" style={{ color: `var(--${stat.tone === 'muted' ? 'text-soft' : stat.tone})` }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        {PROTOCOLS.map(protocol => (
          <Card key={protocol.id}>
            <details>
              <summary
                className="cursor-pointer list-none"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] mb-1" style={{ color: 'var(--text-dim)' }}>
                    Protocol {protocol.number}
                  </div>
                  <h4 className="font-semibold" style={{ color: 'var(--text)' }}>
                    {protocol.title}
                  </h4>
                </div>
                <Badge tone={protocol.steps ? 'success' : 'muted'}>{protocol.steps ? 'step list' : 'card'}</Badge>
              </summary>

              <div className="mt-4 grid gap-3 text-sm" style={{ color: 'var(--text-soft)' }}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[14px] px-3 py-2.5" style={{ border: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
                    <div className="text-[10px] uppercase tracking-[0.24em] mb-1" style={{ color: 'var(--text-dim)' }}>
                      Trigger
                    </div>
                    <div>{protocol.trigger}</div>
                  </div>
                  <div className="rounded-[14px] px-3 py-2.5" style={{ border: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
                    <div className="text-[10px] uppercase tracking-[0.24em] mb-1" style={{ color: 'var(--text-dim)' }}>
                      Output
                    </div>
                    <div>{protocol.output}</div>
                  </div>
                </div>

                {protocol.steps && (
                  <div className="rounded-[14px] px-3 py-2.5" style={{ border: '1px solid var(--line)', background: 'rgba(10, 12, 19, 0.32)' }}>
                    <div className="text-[10px] uppercase tracking-[0.24em] mb-2" style={{ color: 'var(--text-dim)' }}>
                      Steps
                    </div>
                    <div className="grid gap-1.5">
                      {protocol.steps.map((step, index) => (
                        <div key={step} className="flex items-start gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          </Card>
        ))}
      </div>

      <Card highlight="amber">
        <h3 className="font-bold mb-1" style={{ fontSize: '1.02rem' }}>
          Convergence Event
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
          <strong style={{ color: 'var(--text)' }}>Map→Territory Collapse — 2025-11-30</strong>
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-soft)', lineHeight: 1.65 }}>
          The irreversible shift from planning how to work to the work being the system.
        </p>
      </Card>

      <Card highlight="amber">
        <h3 className="font-bold mb-1" style={{ fontSize: '1.02rem' }}>
          Deployment Status
        </h3>
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
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
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <ActionBtn onClick={save}>Save</ActionBtn>
          <Badge tone="muted">Last saved: {deploy.savedAt ?? 'never'}</Badge>
        </div>
        <HelperLine>
          Status fields reflect user-declared state. The tab never invents deployment truth.
        </HelperLine>
      </Card>

      <Card highlight="amber">
        <h3 className="font-bold mb-1" style={{ fontSize: '1.02rem' }}>
          Open Deficits
        </h3>
        <div className="grid gap-2 mt-3">
          <DeficitRow tag="resolved">System persistence → public URL live</DeficitRow>
          <DeficitRow tag="fail">Version history → v1–v16 unrecovered</DeficitRow>
          <DeficitRow tag="open">Tab count discrepancy → under investigation</DeficitRow>
        </div>
      </Card>
    </section>
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
      className="flex gap-2 flex-wrap items-center px-3 py-2.5 rounded-[12px] text-sm"
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
