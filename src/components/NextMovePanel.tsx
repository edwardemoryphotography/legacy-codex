'use client'

import { useEffect, useState } from 'react'
import { nextMoveContextExpiresAt, nextMoveContextKey, recommendNextMove } from '@/lib/nextMove'
import type { NextMoveContext, NextMoveRecommendation } from '@/types'
import { ActionBtn, ActionChip, Badge, Card, SectionSubtitle, SectionTitle, Textarea } from '@/components/ui'

type Props = {
  embedded?: boolean
  context: NextMoveContext
}

export default function NextMovePanel({ context, embedded = false }: Props) {
  const [intent, setIntent] = useState('')
  const [, refreshClock] = useState(0)
  const now = new Date().toISOString()
  const contextKey = nextMoveContextKey(context, now)
  const expiresAt = nextMoveContextExpiresAt(context, now)
  const mission = context.missionStatus === 'ready' ? context.mission : null

  useEffect(() => {
    const refresh = () => refreshClock(value => value + 1)
    const timer = expiresAt === null ? null : window.setTimeout(refresh,
      Math.min(2_147_483_647, Math.max(0, expiresAt - Date.now())))
    // Mobile browsers may suspend timers while the user is away.
    document.addEventListener('visibilitychange', refresh)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [expiresAt])

  const Surface = embedded ? 'div' : Card

  return (
    <Surface className="next-move-composer">
      <SectionTitle>Find your next move</SectionTitle>
      <SectionSubtitle>
        Checks your saved mission, constraints, and evidence. Optional notes are kept in the handoff.
      </SectionSubtitle>

      <label htmlFor="next-move-intent" className="sr-only">Optional note for the handoff</label>
      <Textarea
        id="next-move-intent"
        rows={3}
        value={intent}
        onChange={setIntent}
        placeholder={mission ? `Add a note about “${mission.title}” (optional)` : 'Add a note to carry forward (optional)'}
      />
      {/* Keep the draft, but discard the result and copy status on any context
          or intent change. A reverted context must not revive an old result. */}
      <NextMoveChoice key={JSON.stringify([contextKey, intent])} context={context} intent={intent} contextKey={contextKey} />
    </Surface>
  )
}

function NextMoveChoice({ context, intent, contextKey }: { context: NextMoveContext; intent: string; contextKey: string }) {
  const [recommendation, setRecommendation] = useState<NextMoveRecommendation | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')

  function chooseNextMove() {
    setRecommendation(recommendNextMove(intent, context))
    setCopied(false)
    setCopyError('')
  }

  async function copyHandoff() {
    if (!recommendation) return
    if (nextMoveContextKey(context, new Date().toISOString()) !== contextKey) {
      setRecommendation(null)
      setCopyError('Evidence has aged. Check your next move again before copying.')
      return
    }
    try {
      await navigator.clipboard.writeText(recommendation.handoff)
      setCopied(true)
      setCopyError('')
    } catch {
      setCopyError('Could not copy. Select the handoff text below to copy it manually.')
    }
  }

  return (
    <>
      <div className="composer-actions">
        <ActionBtn onClick={chooseNextMove} disabled={context.missionStatus === 'loading'}>Find the next move</ActionBtn>
        <span>Uses local rules · no AI request</span>
      </div>

      {copyError && <p role="alert">{copyError}</p>}
      {recommendation && (
        <div className="mt-4 space-y-3" role="status" aria-live="polite">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="teal">{recommendation.label}</Badge>
            <Badge tone="muted">{recommendation.kind === 'question' ? 'Needs clarification · not started' : 'Suggested · not started'}</Badge>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{recommendation.kind === 'question' ? 'ONE QUESTION' : 'NEXT MOVE'}</div>
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
            <summary style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.8rem' }}>Context and handoff</summary>
            <div className="mt-2 p-3 rounded-codex" style={{ border: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 8, color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'inherit' }}>{recommendation.handoff}</pre>
              <div className="mt-3">
                <ActionChip onClick={copyHandoff}>{copied ? 'Copied' : 'Copy handoff'}</ActionChip>
              </div>
            </div>
          </details>
        </div>
      )}
    </>
  )
}
