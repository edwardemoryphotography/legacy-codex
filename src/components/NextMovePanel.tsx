'use client'

import { useState } from 'react'
import { recommendNextMove, type NextMoveRecommendation } from '@/lib/nextMove'
import { ActionBtn, ActionChip, Badge, Card, SectionSubtitle, SectionTitle, Textarea } from '@/components/ui'

type Props = {
  mission?: { title: string; finishLine: string | null } | null
}

export default function NextMovePanel({ mission = null }: Props) {
  const [intent, setIntent] = useState('')
  const [recommendation, setRecommendation] = useState<NextMoveRecommendation | null>(null)
  const [copied, setCopied] = useState(false)

  function chooseNextMove() {
    const value = intent.trim()
    if (!value) return
    setRecommendation(recommendNextMove(value, mission))
    setCopied(false)
  }

  function copyHandoff() {
    if (!recommendation) return
    navigator.clipboard?.writeText(recommendation.handoff).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  return (
    <Card>
      <SectionTitle>Choose the Next Move</SectionTitle>
      <SectionSubtitle>
        When the path is unclear, describe the friction in ordinary language. Legacy Codex will choose one lane and one concrete move.
      </SectionSubtitle>

      <label htmlFor="next-move-intent" className="sr-only">What are you trying to move forward?</label>
      <Textarea
        id="next-move-intent"
        rows={3}
        value={intent}
        onChange={setIntent}
        placeholder={mission ? `What feels unclear or stuck about “${mission.title}”?` : 'What are you trying to move forward?'}
      />
      <div className="mt-3">
        <ActionBtn onClick={chooseNextMove} disabled={!intent.trim()}>Find the next move</ActionBtn>
      </div>

      {recommendation && (
        <div className="mt-4 space-y-3" role="status" aria-live="polite">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="teal">{recommendation.label}</Badge>
            <Badge tone="muted">Doctrine route · not executed</Badge>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>NEXT MOVE</div>
            <p className="mt-1" style={{ color: 'var(--text)', lineHeight: 1.55 }}>{recommendation.nextMove}</p>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>WHY</div>
            <p className="mt-1" style={{ color: 'var(--text-soft)', fontSize: '0.9rem', lineHeight: 1.55 }}>{recommendation.why}</p>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>PROOF OF COMPLETION</div>
            <p className="mt-1" style={{ color: 'var(--text-soft)', fontSize: '0.9rem', lineHeight: 1.55 }}>{recommendation.evidenceNeeded}</p>
          </div>
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.8rem' }}>Builder handoff</summary>
            <div className="mt-2 p-3 rounded-codex" style={{ border: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
              <div style={{ color: 'var(--text-soft)', fontSize: '0.85rem' }}>{recommendation.builderDestination}</div>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 8, color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'inherit' }}>{recommendation.handoff}</pre>
              <div className="mt-3">
                <ActionChip onClick={copyHandoff}>{copied ? 'Copied' : 'Copy handoff'}</ActionChip>
              </div>
            </div>
          </details>
        </div>
      )}
    </Card>
  )
}
