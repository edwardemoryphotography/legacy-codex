'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
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

// Everyday screens live in the primary bar so they're always one tap away,
// with no horizontal scrolling and no clipped labels at 375px — nine flat,
// equal-width tabs in a phone-width strip is what clipped "Sprint Linker" in
// production. The rest are reference/occasional-use tools, one tap behind
// "More". Adding a tab: give it an entry in TABS, then decide whether it
// belongs in PRIMARY_TAB_IDS or is left to fall through to More.
const PRIMARY_TAB_IDS: TabId[] = ['mission', 'codex', 'controls']
const PRIMARY_TABS = TABS.filter(tab => PRIMARY_TAB_IDS.includes(tab.id))
const MORE_TABS = TABS.filter(tab => !PRIMARY_TAB_IDS.includes(tab.id))

export default function CodexApp() {
  const [activeTab, setActiveTab] = useState<TabId>('mission')
  const [moreOpen, setMoreOpen] = useState(false)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)
  const moreSheetRef = useRef<HTMLDivElement>(null)

  const activeTabMeta = TABS.find(tab => tab.id === activeTab)
  const activeIsSecondary = MORE_TABS.some(tab => tab.id === activeTab)

  const closeMore = useCallback(() => {
    setMoreOpen(false)
    moreTriggerRef.current?.focus()
  }, [])

  const selectTab = useCallback((id: TabId) => {
    setActiveTab(id)
    setMoreOpen(false)
  }, [])

  // Escape closes the sheet, background scroll is locked while it's open
  // (a six-item list can still exceed a short landscape viewport), and focus
  // moves to the first item on open and back to the trigger on close.
  useEffect(() => {
    if (!moreOpen) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeMore()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    moreSheetRef.current?.querySelector<HTMLButtonElement>('[data-more-item]')?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [moreOpen, closeMore])

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % PRIMARY_TABS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + PRIMARY_TABS.length) % PRIMARY_TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = PRIMARY_TABS.length - 1
    }

    if (nextIndex === null) return

    event.preventDefault()
    const nextTab = PRIMARY_TABS[nextIndex]
    setActiveTab(nextTab.id)
    document.getElementById(`tab-${nextTab.id}`)?.focus()
  }

  return (
    <div className="codex-shell">
      <header className="codex-header">
        <h1>Legacy Codex<span className="brand-dot" aria-hidden="true" /></h1>
        <p>A little clarity. One next move.</p>
      </header>

      {/* Primary nav: the three everyday screens, always visible, plus More. */}
      <nav className="codex-tablist" aria-label="Legacy Codex navigation">
        <div role="tablist" aria-label="Primary" className="codex-tablist-primary">
          {PRIMARY_TABS.map((tab, index) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              className="codex-tab interactive-control"
              style={{
                border: activeTab === tab.id ? '1px solid var(--teal)' : '1px solid transparent',
                background: activeTab === tab.id ? 'var(--teal-soft)' : 'transparent',
                color: activeTab === tab.id ? 'var(--teal)' : 'var(--text-dim)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          ref={moreTriggerRef}
          type="button"
          id="tab-more"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-controls="more-sheet"
          onClick={() => setMoreOpen(open => !open)}
          className="codex-tab interactive-control"
          style={{
            border: moreOpen || activeIsSecondary ? '1px solid var(--teal)' : '1px solid transparent',
            background: moreOpen || activeIsSecondary ? 'var(--teal-soft)' : 'transparent',
            color: moreOpen || activeIsSecondary ? 'var(--teal)' : 'var(--text-dim)',
          }}
        >
          {activeIsSecondary ? activeTabMeta?.label ?? 'More' : 'More'}
        </button>
      </nav>

      {moreOpen && (
        <div className="more-overlay" onClick={closeMore}>
          <div
            ref={moreSheetRef}
            id="more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More"
            className="more-sheet"
            onClick={event => event.stopPropagation()}
          >
            <div className="more-sheet-header">
              <span>More</span>
              <button
                type="button"
                className="more-sheet-close interactive-control"
                onClick={closeMore}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="more-sheet-list">
              {MORE_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  data-more-item
                  aria-current={activeTab === tab.id ? 'true' : undefined}
                  onClick={() => selectTab(tab.id)}
                  className="more-sheet-item interactive-control"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab panel */}
      <main className="codex-main">
        <div
          className="panel-enter"
          key={activeTab}
          id={`panel-${activeTab}`}
          role={activeIsSecondary ? 'region' : 'tabpanel'}
          aria-label={activeIsSecondary ? activeTabMeta?.label : undefined}
          aria-labelledby={activeIsSecondary ? undefined : `tab-${activeTab}`}
          tabIndex={-1}
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
