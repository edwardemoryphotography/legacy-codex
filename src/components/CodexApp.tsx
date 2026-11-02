'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
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
import BriefTab from './tabs/BriefTab'
import OriginTab from './tabs/OriginTab'
import TerritoryTab from './tabs/TerritoryTab'
import HomeTab from './tabs/HomeTab'
import { OrbHostProvider, PersistentOrb } from './OrbHost'
import ThemeReview from './ThemeReview'
import { supabase } from '@/lib/supabase/client'
import { emptyHomeSession, restoreHomeSession, preserveHomeSession } from '@/lib/homeSession'

interface Tab {
  id: TabId
  label: string
}

const TABS: Tab[] = [
  { id: 'home',                   label: 'Home' },
  { id: 'mission',                label: 'Mission' },
  { id: 'overview',              label: 'Overview' },
  { id: 'protocols',             label: 'Protocols' },
  { id: 'sprint-linker',         label: 'Sprint Linker' },
  { id: 'resumption-log',        label: 'Resumption Log' },
  { id: 'biometrics',            label: 'Biometrics' },
  { id: 'constraint-validator',  label: 'Constraint Validator' },
  { id: 'codex',                 label: 'Codex' },
  { id: 'controls',             label: 'Controls' },
  { id: 'brief',                 label: 'Brief' },
  { id: 'territory',             label: 'Territory' },
  { id: 'origin',                label: 'Origin Atlas' },
]

// One menu, opened from the top-left button, holds every screen; Home is the
// Codex Glass screen and the default (Eddie, 2026-10-30). Nothing else sits in
// fixed chrome, so the home stays as simple as the board.
export default function CodexApp() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [missionRevision, setMissionRevision] = useState(0)
  const refreshConversationProject = useCallback(() => setMissionRevision(value => value + 1), [])
  const [menuOpen, setMenuOpen] = useState(false)
  const [homeSession, setHomeSession] = useState(emptyHomeSession)
  useEffect(() => {
    if (typeof supabase.auth.onAuthStateChange !== 'function') return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      const id = session?.user.id ?? null
      setHomeSession(current => current.accountId === id ? current : id ? restoreHomeSession(id) : emptyHomeSession())
    })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => { preserveHomeSession(homeSession) }, [homeSession])
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const menuSheetRef = useRef<HTMLDivElement>(null)
  const activeTabMeta = TABS.find(tab => tab.id === activeTab)

  // A shared lesson opens the existing Mission workflow, never a new app or
  // an automatic save. The recipient must inspect and accept it explicitly.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('relay')) setActiveTab('mission')
  }, [])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    menuTriggerRef.current?.focus()
  }, [])

  const selectTab = useCallback((id: TabId) => {
    setActiveTab(id)
    setMenuOpen(false)
  }, [])

  // Escape closes the menu, background scroll is locked while it is open,
  // and focus moves to the current item on open and back to the button on close.
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const sheet = menuSheetRef.current
    ;(sheet?.querySelector<HTMLButtonElement>('[aria-current="page"]') ?? sheet?.querySelector<HTMLButtonElement>('[data-menu-item]'))?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen, closeMenu])

  return (
    <OrbHostProvider placed={activeTab === 'home' || activeTab === 'mission'}>
    <div className="codex-shell" data-screen={activeTab}>
      <div className="glass-aurora" aria-hidden="true">
        <div className="glass-blob glass-b1" /><div className="glass-blob glass-b2" /><div className="glass-blob glass-b3" />
      </div>
      <header className="glass-top">
        <button
          ref={menuTriggerRef}
          type="button"
          className="glass-round glass"
          aria-label="Menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls="codex-menu"
          onClick={() => setMenuOpen(open => !open)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 9h14M5 15h9" /></svg>
        </button>
        <h1 className="glass-wordmark">Codex</h1>
        <span className="glass-top-spacer" aria-hidden="true" />
      </header>
      {/* Rendered once, as a direct child of the shell, so no screen change
          ever re-parents or remounts it. It positions itself. */}
      <PersistentOrb />

      {menuOpen && (
        <div className="glass-menu-overlay" onClick={closeMenu}>
          <div
            ref={menuSheetRef}
            id="codex-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="glass-menu glass"
            onClick={event => event.stopPropagation()}
          >
            <nav aria-label="Legacy Codex">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  data-menu-item
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  onClick={() => selectTab(tab.id)}
                  className="glass-menu-item"
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <ThemeReview />
          </div>
        </div>
      )}

      <main className="codex-main">
        <div
          className="panel-enter"
          key={activeTab}
          id={`panel-${activeTab}`}
          role="region"
          aria-label={activeTabMeta?.label}
          tabIndex={-1}
        >
          {activeTab === 'home'                  && <HomeTab key={homeSession.accountId} onNavigate={selectTab} session={homeSession} onSessionChange={setHomeSession} />}
          {activeTab === 'mission' && <><HomeTab key={`${homeSession.accountId}:${missionRevision}`} variant="mission" onNavigate={selectTab} session={homeSession} onSessionChange={setHomeSession} /><MissionTab onMissionChange={refreshConversationProject} /></>}
          {activeTab === 'overview'             && <OverviewTab />}
          {activeTab === 'protocols'            && <ProtocolsTab />}
          {activeTab === 'sprint-linker'        && <SprintLinkerTab />}
          {activeTab === 'resumption-log'       && <ResumptionLogTab />}
          {activeTab === 'biometrics'           && <BiometricsTab />}
          {activeTab === 'constraint-validator' && <ConstraintValidatorTab />}
          {activeTab === 'codex'                && <CodexTab />}
          {activeTab === 'controls'             && <ControlsTab />}
          {activeTab === 'brief'                 && <BriefTab />}
          {activeTab === 'territory'             && <TerritoryTab />}
          {activeTab === 'origin'                && <OriginTab />}
        </div>
      </main>
    </div>
    </OrbHostProvider>
  )
}
