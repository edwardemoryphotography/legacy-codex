'use client'

import { CANONICAL_PRINCIPLES, VALIDATION_METRICS } from '@/data/principles'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { MetricValue } from '@/types'
import { Badge, Card, SectionSubtitle, SectionTitle } from '@/components/ui'

type MetricsState = Record<string, MetricValue>

const STORAGE_KEY = 'codex_v38_metrics'

const DEFAULT_METRICS: MetricsState = {
  artifact_existence: 'PASS',
  stateless_resumption: 'PASS',
  subtraction_check: 'PASS',
}

export default function OverviewTab() {
  const [metrics, setMetrics] = useLocalStorage<MetricsState>(STORAGE_KEY, DEFAULT_METRICS)

  const rows = VALIDATION_METRICS.map(metric => ({
    ...metric,
    value: metrics[metric.id],
  }))

  const counts = rows.reduce(
    (acc, row) => {
      if (row.value === 'PASS') acc.pass += 1
      else if (row.value === 'FAIL') acc.fail += 1
      else acc.unset += 1
      return acc
    },
    { pass: 0, fail: 0, unset: 0 }
  )

  const overallTone = counts.fail > 0 ? 'error' : counts.unset > 0 ? 'amber' : 'success'
  const overallLabel = counts.fail > 0 ? 'Blocked' : counts.unset > 0 ? 'In progress' : 'Ready'

  const setMetric = (id: string, value: MetricValue) => {
    setMetrics(prev => ({ ...prev, [id]: value }))
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <SectionTitle>Overview</SectionTitle>
        <SectionSubtitle>
          Canonical principles, local validation state, and the current posture of the Codex.
        </SectionSubtitle>
      </div>

      <Card highlight="teal" style={{ padding: '18px' }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge tone="teal">v38 metrics</Badge>
              <Badge tone={overallTone}>{overallLabel}</Badge>
              <Badge tone="muted">local state</Badge>
            </div>
            <h3 className="text-2xl font-black tracking-tight" style={{ letterSpacing: '-0.04em' }}>
              The system is only as strong as the constraints you can see.
            </h3>
            <p className="mt-2 text-sm sm:text-[0.95rem]" style={{ color: 'var(--text-soft)', lineHeight: 1.65 }}>
              Mark each metric PASS or FAIL. Values persist locally on this device, and the summary updates instantly.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full lg:w-auto">
            {[
              { label: 'Pass', value: String(counts.pass), tone: 'success' as const },
              { label: 'Fail', value: String(counts.fail), tone: 'error' as const },
              { label: 'Unset', value: String(counts.unset), tone: 'amber' as const },
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
                <div className="mt-1 text-sm font-semibold" style={{ color: `var(--${stat.tone})` }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div>
        <SectionTitle>Canonical Principles</SectionTitle>
        <SectionSubtitle>
          The load-bearing rules that govern execution quality.
        </SectionSubtitle>

        <div className="grid gap-3 lg:grid-cols-2">
          {CANONICAL_PRINCIPLES.map(principle => (
            <Card key={principle.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] mb-2" style={{ color: 'var(--text-dim)' }}>
                    Principle {principle.number}
                  </div>
                  <h4 className="font-semibold" style={{ color: 'var(--text)' }}>
                    {principle.name}
                  </h4>
                </div>
                <Badge tone="teal">load-bearing</Badge>
              </div>
              <p className="mt-3 text-sm" style={{ color: 'var(--text-soft)', lineHeight: 1.6 }}>
                {principle.description}
              </p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Validation Metrics</SectionTitle>
        <SectionSubtitle>
          Mark each metric PASS or FAIL. The current state lives in localStorage on this machine.
        </SectionSubtitle>

        <div className="grid gap-3">
          {rows.map(metric => {
            const current = metric.value
            const tone = current === 'PASS' ? 'success' : current === 'FAIL' ? 'error' : 'amber'
            const label = current ?? 'UNSET'

            return (
              <Card key={metric.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      {metric.label}
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                      {metric.sublabel}
                    </div>
                  </div>

                  <Badge tone={tone}>{label}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ToggleBtn
                    label="PASS"
                    active={current === 'PASS'}
                    variant="pass"
                    onClick={() => setMetric(metric.id, 'PASS')}
                  />
                  <ToggleBtn
                    label="FAIL"
                    active={current === 'FAIL'}
                    variant="fail"
                    onClick={() => setMetric(metric.id, 'FAIL')}
                  />
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ToggleBtn({
  label,
  active,
  variant,
  onClick,
}: {
  label: string
  active: boolean
  variant: 'pass' | 'fail'
  onClick: () => void
}) {
  const colors =
    variant === 'pass'
      ? { active: 'var(--success)', activeBg: 'var(--success-soft)' }
      : { active: 'var(--error)', activeBg: 'var(--error-soft)' }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? `1px solid ${colors.active}` : '1px solid var(--line-strong)',
        background: active ? colors.activeBg : 'var(--surface-soft)',
        color: active ? colors.active : 'var(--text-soft)',
        borderRadius: 12,
        padding: '8px 12px',
        minWidth: 84,
        fontSize: '0.82rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  )
}
