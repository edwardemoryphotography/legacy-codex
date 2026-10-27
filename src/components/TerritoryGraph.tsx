'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { PER_KIND_LIMIT, type GraphEdge, type GraphNode, type GraphNodeKind } from '@/lib/territoryGraph'

const KIND_LABELS: Record<GraphNodeKind, string> = {
  mission: 'Mission', action: 'Unfinished action', blocker: 'Blocker', lesson: 'Confirmed lesson', correction: 'Correction', evidence: 'Evidence',
}
const short = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value)
const TAP_SLOP = 6

// Draws only what buildTerritoryGraph returns. Dragging a node moves it for
// this view only — positions are not saved anywhere. The empty canvas pans by
// native scrolling (touch) or by dragging (mouse).
export default function TerritoryGraph({ nodes, edges, width, height, blocked, onOpen }: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  blocked: Set<string>
  onOpen: (missionId: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({})
  const drag = useRef<{ id: string | null; x: number; y: number; moved: boolean; scrollX: number; scrollY: number } | null>(null)

  const pos = (n: GraphNode) => ({ x: n.x + (offsets[n.id]?.dx ?? 0), y: n.y + (offsets[n.id]?.dy ?? 0) })
  const byId = new Map(nodes.map(n => [n.id, n]))

  const start = (e: PointerEvent, id: string | null) => {
    if (id === null && e.pointerType !== 'mouse') return // touch pans natively
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    drag.current = { id, x: e.clientX, y: e.clientY, moved: false, scrollX: scrollRef.current?.scrollLeft ?? 0, scrollY: scrollRef.current?.scrollTop ?? 0 }
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > TAP_SLOP) d.moved = true
    if (!d.moved) return
    if (d.id === null) {
      scrollRef.current?.scrollTo?.({ left: d.scrollX - dx, top: d.scrollY - dy })
      return
    }
    const id = d.id
    setOffsets(prev => ({ ...prev, [id]: { dx: (prev[id]?.dx ?? 0) + dx, dy: (prev[id]?.dy ?? 0) + dy } }))
    d.x = e.clientX
    d.y = e.clientY
  }
  const end = (missionId?: string) => {
    const d = drag.current
    drag.current = null
    if (d && d.id !== null && !d.moved && missionId) onOpen(missionId)
  }
  const key = (e: KeyboardEvent, missionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(missionId)
    }
  }

  return (
    <div>
      <div
        ref={scrollRef}
        className="card"
        data-testid="territory-graph"
        style={{ overflow: 'auto', height: 'min(70vh, 560px)', padding: 0, touchAction: 'pan-x pan-y', cursor: 'grab' }}
        onPointerDown={e => start(e, null)}
        onPointerMove={move}
        onPointerUp={() => end()}
        onPointerCancel={() => { drag.current = null }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Territory graph: ${nodes.filter(n => n.kind === 'mission').length} missions, ${edges.length} saved links`}>
          {edges.map(edge => {
            const a = byId.get(edge.from)
            const b = byId.get(edge.to)
            if (!a || !b) return null
            const p = pos(a)
            const q = pos(b)
            return (
              <g key={`${edge.from}->${edge.to}`}>
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--line-strong)" strokeWidth={1.2} />
                <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 4} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
                  <title>{`${edge.label} — saved in ${edge.provenance}`}</title>
                  {edge.label}
                </text>
              </g>
            )
          })}
          {nodes.map(node => {
            const { x, y } = pos(node)
            const isMission = node.kind === 'mission'
            const stroke = node.kind === 'blocker' || (isMission && blocked.has(node.missionId)) ? 'var(--amber)' : 'var(--line-strong)'
            const w = isMission ? 150 : 112
            const h = isMission ? 44 : 34
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${KIND_LABELS[node.kind]}: ${node.label}. Open its mission.`}
                transform={`translate(${x - w / 2}, ${y - h / 2})`}
                style={{ cursor: 'pointer', touchAction: 'none' }}
                onPointerDown={e => start(e, node.id)}
                onPointerUp={e => { e.stopPropagation(); end(node.missionId) }}
                onKeyDown={e => key(e, node.missionId)}
              >
                <title>{`${KIND_LABELS[node.kind]}: ${node.label}`}</title>
                <rect width={w} height={h} rx={10} fill="var(--surface, #0a0d1d)" stroke={stroke} strokeWidth={isMission ? 1.6 : 1} />
                <text x={10} y={isMission ? 17 : 14} fontSize={9} fill="var(--text-dim)" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {KIND_LABELS[node.kind]}
                </text>
                <text x={10} y={isMission ? 34 : 27} fontSize={isMission ? 12.5 : 11} fontWeight={isMission ? 700 : 500} fill="var(--text)">
                  {short(node.label, isMission ? 20 : 16)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <details className="mt-3">
        <summary style={{ cursor: 'pointer' }}>Read the graph as a list</summary>
        <ul className="mt-2 text-sm" style={{ listStyle: 'none', padding: 0 }}>
          {nodes.filter(n => n.kind === 'mission').map(mission => {
            const links = edges.filter(e => e.from === mission.id)
            return (
              <li key={mission.id} className="mb-3">
                <button type="button" onClick={() => onOpen(mission.missionId)} style={{ fontWeight: 700, color: 'inherit', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                  {mission.label}
                </button>
                {links.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)' }}>No saved links yet.</p>
                ) : (
                  <ul style={{ paddingLeft: 14 }}>
                    {links.map(link => (
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
