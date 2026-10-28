'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { buildTerritoryGraph, CHILD_BOX, MISSION_BOX, PER_KIND_LIMIT, type EvidenceLite, type GraphNode, type GraphNodeKind } from '@/lib/territoryGraph'
import { GROUP_OF_STATE, type MissionEventLite, type OpenAction } from '@/lib/territory'
import type { Mission } from '@/types'

const KIND_LABELS: Record<GraphNodeKind, string> = {
  mission: 'Mission', action: 'Unfinished action', blocker: 'Blocker', lesson: 'Confirmed lesson', correction: 'Correction', evidence: 'Evidence',
}
// One hue per kind of saved record. Colour names the record type only; it
// never signals progress or certainty.
const KIND_COLORS: Record<GraphNodeKind, string> = {
  mission: '#8b7bff', action: '#38bdf8', blocker: '#fbbf24', lesson: '#c084fc', correction: '#fb7185', evidence: '#94a3b8',
}
const short = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value)
const TAP_SLOP = 6

// Splits a title into at most two lines for the mission card.
function twoLines(text: string, perLine: number): [string, string] {
  if (text.length <= perLine) return [text, '']
  const cut = text.lastIndexOf(' ', perLine)
  const first = text.slice(0, cut > perLine / 2 ? cut : perLine)
  return [first, short(text.slice(first.length).trim(), perLine)]
}

// Draws only what buildTerritoryGraph returns, scaled to fit the screen width:
// one column on a phone, more on wider screens. Dragging a node moves it for
// this view only — positions are not saved. Nodes allow vertical page scroll
// on touch, so the graph never traps a scrolling finger.
export default function TerritoryGraph({ missions, actions, links, evidence, onOpen }: {
  missions: Mission[]
  actions: OpenAction[]
  links: (MissionEventLite & { id?: string })[]
  evidence: EvidenceLite[]
  onOpen: (missionId: string) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [maxColumns, setMaxColumns] = useState(1)
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({})
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      setMaxColumns(w >= 1000 ? 3 : w >= 640 ? 2 : 1)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { nodes, edges, width, height } = buildTerritoryGraph(missions, actions, links, evidence, maxColumns)
  const byId = new Map(nodes.map(n => [n.id, n]))
  const pos = (n: GraphNode) => ({ x: n.x + (offsets[n.id]?.dx ?? 0), y: n.y + (offsets[n.id]?.dy ?? 0) })
  const missionCount = nodes.filter(n => n.kind === 'mission').length

  const start = (e: PointerEvent, id: string) => {
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    drag.current = { id, x: e.clientX, y: e.clientY, moved: false }
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const scale = (svgRef.current?.getBoundingClientRect().width || width) / width
    const dx = (e.clientX - d.x) / scale
    const dy = (e.clientY - d.y) / scale
    if (!d.moved && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) <= TAP_SLOP) return
    d.moved = true
    setOffsets(prev => ({ ...prev, [d.id]: { dx: (prev[d.id]?.dx ?? 0) + dx, dy: (prev[d.id]?.dy ?? 0) + dy } }))
    d.x = e.clientX
    d.y = e.clientY
  }
  const end = (missionId: string) => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) onOpen(missionId)
  }
  const key = (e: KeyboardEvent, missionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(missionId)
    }
  }

  return (
    <div ref={wrapRef}>
      <p className="text-sm mb-2" style={{ color: 'var(--text-soft)' }}>
        {missionCount} mission{missionCount === 1 ? '' : 's'} · {edges.length} saved link{edges.length === 1 ? '' : 's'} · no links between missions yet (none saved)
      </p>
      <div className="flex flex-wrap gap-3 mb-3 text-xs" aria-hidden="true">
        {(Object.keys(KIND_LABELS) as GraphNodeKind[]).map(kind => (
          <span key={kind} className="flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: KIND_COLORS[kind], boxShadow: `0 0 6px ${KIND_COLORS[kind]}` }} />
            {KIND_LABELS[kind]}
          </span>
        ))}
      </div>

      <div className="card" data-testid="territory-graph" style={{ padding: 8, overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', maxWidth: width * 1.5, height: 'auto', display: 'block', margin: '0 auto' }}
          role="group"
          aria-label={`Territory graph: ${missionCount} missions, ${edges.length} saved links`}
          onPointerMove={move}
          onPointerCancel={() => { drag.current = null }}
        >
          <defs>
            <pattern id="tg-dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="rgba(148,163,184,0.18)" />
            </pattern>
            <filter id="tg-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="tg-mission" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(139,123,255,0.22)" />
              <stop offset="100%" stopColor="rgba(56,189,248,0.10)" />
            </linearGradient>
          </defs>
          <rect width={width} height={height} fill="url(#tg-dots)" />

          {edges.map(edge => {
            const a = byId.get(edge.from)
            const b = byId.get(edge.to)
            if (!a || !b) return null
            const p = pos(a)
            const q = pos(b)
            const mx = (p.x + q.x) / 2
            const my = (p.y + q.y) / 2
            const bend = { x: mx + (q.y - p.y) * 0.15, y: my - (q.x - p.x) * 0.15 }
            const color = KIND_COLORS[b.kind]
            const labelWidth = Math.max(56, edge.label.length * 6.2 + 14)
            return (
              <g key={`${edge.from}->${edge.to}`}>
                <path d={`M ${p.x} ${p.y} Q ${bend.x} ${bend.y} ${q.x} ${q.y}`} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={1.6} />
                <g transform={`translate(${(p.x + 2 * bend.x + q.x) / 4}, ${(p.y + 2 * bend.y + q.y) / 4})`}>
                  <title>{`${edge.label} — saved in ${edge.provenance}`}</title>
                  <rect x={-labelWidth / 2} y={-9} width={labelWidth} height={18} rx={9} fill="rgba(6,10,22,0.92)" stroke={color} strokeOpacity={0.4} />
                  <text textAnchor="middle" y={4} fontSize={10} fill="var(--text-soft)">{edge.label}</text>
                </g>
              </g>
            )
          })}

          {nodes.map(node => {
            const { x, y } = pos(node)
            const isMission = node.kind === 'mission'
            const box = isMission ? MISSION_BOX : CHILD_BOX
            const color = node.kind === 'mission' && node.state === 'blocked' ? KIND_COLORS.blocker : KIND_COLORS[node.kind]
            const quiet = isMission && node.state && GROUP_OF_STATE[node.state] !== 'active'
            const [line1, line2] = twoLines(node.label, 26)
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${KIND_LABELS[node.kind]}: ${node.label}. Open its mission.`}
                transform={`translate(${x - box.w / 2}, ${y - box.h / 2})`}
                opacity={quiet ? 0.62 : 1}
                style={{ cursor: 'pointer', touchAction: 'pan-y' }}
                onPointerDown={e => start(e, node.id)}
                onPointerUp={() => end(node.missionId)}
                onKeyDown={e => key(e, node.missionId)}
              >
                <title>{`${KIND_LABELS[node.kind]}: ${node.label}`}</title>
                <rect width={box.w} height={box.h} rx={isMission ? 16 : 11} fill={isMission ? 'url(#tg-mission)' : 'rgba(10,16,32,0.94)'} stroke={color} strokeOpacity={0.9} strokeWidth={isMission ? 1.6 : 1.2} filter="url(#tg-glow)" />
                {isMission ? (
                  <>
                    <text x={14} y={20} fontSize={9.5} fill={color} style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>{node.state}</text>
                    <text x={14} y={38} fontSize={13} fontWeight={700} fill="var(--text)">{line1}</text>
                    {line2 ? (
                      <text x={14} y={54} fontSize={13} fontWeight={700} fill="var(--text)">{line2}</text>
                    ) : null}
                    <text x={14} y={line2 ? 67 : 58} fontSize={10} fill="var(--text-dim)">
                      {short(`Done when: ${node.detail || 'Unknown: nothing saved yet'}`, 34)}
                    </text>
                  </>
                ) : (
                  <>
                    <circle cx={12} cy={12} r={3} fill={color} />
                    <text x={20} y={15} fontSize={8.5} fill="var(--text-dim)" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{KIND_LABELS[node.kind]}</text>
                    <text x={10} y={28} fontSize={11} fontWeight={500} fill="var(--text)">{short(node.label, 16)}</text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <details className="mt-3">
        <summary style={{ cursor: 'pointer' }}>Read the graph as a list</summary>
        <ul className="mt-2 text-sm" style={{ listStyle: 'none', padding: 0 }}>
          {nodes.filter(n => n.kind === 'mission').map(mission => {
            const own = edges.filter(e => e.from === mission.id)
            return (
              <li key={mission.id} className="mb-3">
                <button type="button" onClick={() => onOpen(mission.missionId)} style={{ fontWeight: 700, color: 'inherit', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                  {mission.label}
                </button>
                {own.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)' }}>No saved links yet.</p>
                ) : (
                  <ul style={{ paddingLeft: 14 }}>
                    {own.map(link => (
                      <li key={link.to} style={{ overflowWrap: 'anywhere' }}>
                        {link.label}: {byId.get(link.to)?.label} <span style={{ color: 'var(--text-dim)' }}>({link.provenance})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
          Shows up to {PER_KIND_LIMIT} recent lessons, corrections and evidence items per mission. Missions are not linked to each other: nothing saved records such a link yet.
        </p>
      </details>
    </div>
  )
}
