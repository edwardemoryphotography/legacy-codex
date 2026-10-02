'use client'

import { useState } from 'react'

const VIEWS = {
  architecture: {
    src: '/origin/architecture/index.html#lens=frontend~database',
    title: 'Current human-intent loop',
    label: 'Architecture',
  },
  history: {
    src: '/origin/index.html',
    title: 'Legacy Codex origin atlas',
    label: 'History',
  },
} as const

type ViewId = keyof typeof VIEWS

// In-app door to the standalone origin artifacts in public/origin.
// Architecture is the default: the interactive node map of the current
// Mission loop. History is the cinematic build story beside it.
export default function OriginTab() {
  const [view, setView] = useState<ViewId>('architecture')
  const current = VIEWS[view]

  return (
    <div className="origin-atlas">
      <div className="origin-atlas-switch" role="tablist" aria-label="Origin views">
        {(Object.keys(VIEWS) as ViewId[]).map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className="origin-atlas-switch-btn interactive-control"
            onClick={() => setView(id)}
          >
            {VIEWS[id].label}
          </button>
        ))}
      </div>
      <iframe
        key={view}
        className="origin-atlas-frame"
        title={current.title}
        src={current.src}
      />
    </div>
  )
}
