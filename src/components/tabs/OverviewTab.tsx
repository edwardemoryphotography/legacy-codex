'use client'

import { CANONICAL_PRINCIPLES, VALIDATION_METRICS } from '@/data/principles'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { MetricValue } from '@/types'
import { Card, SectionTitle, SectionSubtitle } from '@/components/ui'

type MetricsState = Record<string, MetricValue>

const DEFAULT_METRICS: MetricsState = {
  artifact_existence: 'PASS',
  stateless_resumption: 'PASS',
  subtraction_check: 'PASS',
}

export default function OverviewTab() {
  const [metrics, setMetrics] = useLocalStorage<MetricsState>(
    'codex_v27_metrics',
    DEFAULT_METRICS
  )

  const setMetric = (id: string, value: MetricValue) => {
    setMetrics(prev => ({ ...prev, [id]: value }))
  }

  return (
    <section>
      {/* Canonical Principles */}
      <SectionTitle>Canonical Principles</SectionTitle>
      <SectionSubtitle>
        Core authority constraints that govern execution quality.
      </SectionSubtitle>

      <div
        className="grid gap-3 mb-6"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
      >
        {CANONICAL_PRINCIPLES.map(p => (
          <Card key={p.id}>
            <h3
              className="mb-1.5 font-semibold"
              style={{ color: 'var(--teal)', fontSize: '0.97rem', letterSpacing: '0.01em' }}
            >
              {p.number}. {p.name}
            </h3>
            <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem' }}>
              {p.description}
            </p>
          </Card>
        ))}
      </div>

      {/* Validation Metrics */}
      <SectionTitle>Validation Metrics</SectionTitle>
      <SectionSubtitle>
        Mark each metric PASS or FAIL. Values persist locally on this device.
      </SectionSubtitle>

      <div className="grid gap-3 mb-6">
        {VALIDATION_METRICS.map(metric => {
          const current = metrics[metric.id]
          return (
            <div
              key={metric.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-codex"
              style={{
                border: '1px solid var(--line)',
                background: 'var(--surface)',
              }}
            >
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  {metric.label}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                  {metric.sublabel}
                </div>
              </div>

              <div className="flex gap-2">
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
            </div>
          )
        })}
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
        border: active
          ? `1px solid ${colors.active}`
          : '1px solid var(--line-strong)',
        background: active ? colors.activeBg : 'var(--surface-soft)',
        color: active ? colors.active : 'var(--text-soft)',
        borderRadius: 10,
        padding: '8px 12px',
        minWidth: 72,
        fontSize: '0.82rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  )
}
