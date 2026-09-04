'use client'

import { useState } from 'react'
import { recommendNextMove, type NextMoveRecommendation } from '@/lib/nextMove'
import { ActionBtn, ActionChip, Badge, Card, SectionSubtitle, SectionTitle, Textarea } from '@/components/ui'

type Props = {
  embedded?: boolean
  mission?: { title: string; finishLine: string | null } | null
}

export default function NextMovePanel({ mission = null, embedded = false }: Props) {
  const [intent, setIntent] = useState('')
  const [recommendation, setRecommendation] = useState<NextMoveRecommendation | null>(null)
  const [copied, setCopied] = useState(false)

  function chooseNextMove() {
    const value = intent.trim()
    if (!value) return
    setRecommendation(recommendNextMove(value, mission))
    setCopied(false)
  }

  const [copyError, setCopyError] = useState('')

  async function copyHandoff() {
    if (!recommendation) return
    try {
      await navigator.clipboard.writeText(recommendation.handoff)
      setCopied(true)
      setCopyError('')
    } catch {
      setCopyError('Could not copy. Select the handoff text below to copy it manually.')
    }
  }

  const Surface = embedded ? 'div' : Card

  return (
    <Surface className="next-move-composer">
      <SectionTitle>Find your next move</SectionTitle>
      <SectionSubtitle>
        What feels unclear or stuck? Start with what you know.
      </SectionSubtitle>

      <label htmlFor="next-move-intent" className="sr-only">What are you trying to move forward?</label>
      <Textarea
        id="next-move-intent"
        rows={3}
        value={intent}
        onChange={value => { setIntent(value); setRecommendation(null); setCopied(false); setCopyError('') }}
        placeholder={mission ? `What feels unclear or stuck about “${mission.title}”?` : 'What are you trying to move forward?'}
      />
      <div className="composer-actions">
        <ActionBtn onClick={chooseNextMove} disabled={!intent.trim()}>Find the next move</ActionBtn>
        <span>Uses local rules · no AI request</span>
      </div>

      {recommendation && (
        <div className="mt-4 space-y-3" role="status" aria-live="polite">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="teal">{recommendation.label}</Badge>
            <Badge tone="muted">Suggested · not started</Badge>
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
                {copyError && <p role="alert">{copyError}</p>}
              </div>
            </div>
          </details>
        </div>
      )}
    </Surface>
  )
}
