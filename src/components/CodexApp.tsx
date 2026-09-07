'use client'

import { useState, type KeyboardEvent } from 'react'
import type { TabId } from '@/types'
import MissionTab from './tabs/MissionTab'
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
  { id: 'mission',                label: 'Mission' },
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
  const [activeTab, setActiveTab] = useState<TabId>('mission')

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % TABS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + TABS.length) % TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = TABS.length - 1
    }

    if (nextIndex === null) return

    event.preventDefault()
    const nextTab = TABS[nextIndex]
    setActiveTab(nextTab.id)
    document.getElementById(`tab-${nextTab.id}`)?.focus()
  }

  return (
    <div className="codex-shell">
      <header className="codex-header">
        <h1>Legacy Codex<span className="brand-dot" aria-hidden="true" /></h1>
        <p>A little clarity. One next move.</p>
      </header>

      {/* Tab bar */}
      <nav
        className="codex-tablist"
        role="tablist"
        aria-label="Legacy Codex navigation"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={event => handleTabKeyDown(event, index)}
            className="codex-tab interactive-control"
            style={{
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
      <main className="codex-main">
        <div
          className="panel-enter"
          key={activeTab}
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'mission'               && <MissionTab />}
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

      <footer className="codex-footer">
        Your context. Your pace.
      </footer>
    </div>
  )
}
