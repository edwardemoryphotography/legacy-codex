'use client'

import { useState } from 'react'
import type { TabId } from '@/types'
import OverviewTab from './tabs/OverviewTab'
import ProtocolsTab from './tabs/ProtocolsTab'
import SprintLinkerTab from './tabs/SprintLinkerTab'
import ResumptionLogTab from './tabs/ResumptionLogTab'
import BiometricsTab from './tabs/BiometricsTab'
import ConstraintValidatorTab from './tabs/ConstraintValidatorTab'
import CodexTab from './tabs/CodexTab'
import ControlsTab from './tabs/ControlsTab'

interface Tab {
  id: TabId
  label: string
}

const TABS: Tab[] = [
  { id: 'overview',              label: 'Overview' },
  { id: 'protocols',             label: 'Protocols' },
  { id: 'sprint-linker',         label: 'Sprint Linker' },
  { id: 'resumption-log',        label: 'Resumption Log' },
  { id: 'biometrics',            label: 'Biometrics' },
  { id: 'constraint-validator',  label: 'Constraint Validator' },
  { id: 'codex',                 label: 'Codex' },
  { id: 'controls',             label: 'Controls' },
]

export default function CodexApp() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  return (
    <div
      style={{
        width: 'min(1120px, 100%)',
        margin: '0 auto',
        padding: '16px',
        paddingBottom: 'calc(98px + var(--safe-bottom))',
      }}
    >
      {/* Desktop label */}
      <p className="hidden lg:block mb-4 text-tx-soft text-sm">
        Legacy Codex operational dashboard. Single-file mode active.
      </p>

      {/* Header */}
      <div className="flex flex-wrap justify-between gap-3 items-center mb-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ letterSpacing: '0.01em' }}>
          Legacy Codex
        </h1>
        <span
          className="font-bold rounded-full px-3 py-1.5 text-xs tracking-widest uppercase"
          style={{
            border: '1px solid var(--teal)',
            background: 'var(--teal-soft)',
            color: 'var(--teal)',
          }}
        >
          v27 — OPERATIONAL
        </span>
      </div>

      {/* Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['Reality Filter Active', 'No mock data'].map(pill => (
          <div
            key={pill}
            className="text-xs rounded-full px-2.5 py-1.5"
            style={{
              border: '1px solid var(--line-strong)',
              background: 'var(--surface-soft)',
              color: 'var(--text-soft)',
            }}
          >
            {pill}
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <nav
        className="fixed lg:sticky bottom-0 lg:top-0 left-0 right-0 z-50 grid gap-1 mb-4"
        style={{
          gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))`,
          background: 'rgba(10, 10, 15, 0.96)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderTop: '1px solid var(--line-strong)',
          padding: '8px',
          paddingBottom: 'calc(8px + var(--safe-bottom))',
        }}
        role="tablist"
        aria-label="Legacy Codex navigation"
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="rounded-lg text-xs font-semibold leading-tight transition-colors duration-150"
            style={{
              minHeight: '52px',
              padding: '8px 6px',
              cursor: 'pointer',
              border: activeTab === tab.id
                ? '1px solid var(--teal)'
                : '1px solid transparent',
              background: activeTab === tab.id ? 'var(--teal-soft)' : 'transparent',
              color: activeTab === tab.id ? 'var(--teal)' : 'var(--text-dim)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab panels */}
      <main>
        <div className="panel-enter" key={activeTab}>
          {activeTab === 'overview'             && <OverviewTab />}
          {activeTab === 'protocols'            && <ProtocolsTab />}
          {activeTab === 'sprint-linker'        && <SprintLinkerTab />}
          {activeTab === 'resumption-log'       && <ResumptionLogTab />}
          {activeTab === 'biometrics'           && <BiometricsTab />}
          {activeTab === 'constraint-validator' && <ConstraintValidatorTab />}
          {activeTab === 'codex'                && <CodexTab />}
          {activeTab === 'controls'             && <ControlsTab />}
        </div>
      </main>

      <footer className="mt-10 pt-3 text-tx-dim text-xs" style={{ borderTop: '1px solid var(--line)' }}>
        Legacy Codex v27 | Reality Filter Active | No mock data.
      </footer>
    </div>
  )
}
