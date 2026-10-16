'use client'

import { useRef, useState } from 'react'
import { ActionBtn } from '@/components/ui'
import { assistanceQuestion } from '@/lib/missionAssistance'
import type { ProjectReviewRequest } from '@/lib/projectReview'

export default function MissionAssistance({ missionId, title, finishLine, question, busy, onSubmit }: {
  missionId: string; title: string; finishLine: string; question?: string | null; busy: boolean
  onSubmit: (request: ProjectReviewRequest) => Promise<boolean | void>
}) {
  const [answer, setAnswer] = useState('')
  const [sending, setSending] = useState(false)
  const inFlight = useRef(false)
  const attempt = useRef<{ text: string; id: string } | null>(null)
  async function send() {
    const text = answer.trim()
    if (!text || busy || inFlight.current) return
    inFlight.current = true
    setSending(true)
    if (attempt.current?.text !== text) attempt.current = { text, id: crypto.randomUUID() }
    try {
      const saved = await onSubmit({ missionId, finishLine, contextNote: text, requestId: attempt.current.id })
      if (saved === true) { setAnswer(''); attempt.current = null }
    } finally { inFlight.current = false; setSending(false) }
  }
  return <form className="mission-assistance" onSubmit={event => { event.preventDefault(); void send() }}>
    <label htmlFor="mission-answer">{question || assistanceQuestion(title)}</label>
    <textarea id="mission-answer" value={answer} onChange={event => setAnswer(event.target.value)} maxLength={6000}
      disabled={busy || sending} placeholder="Paste the assignment, share your notes, or tell me where you are stuck…" rows={4} />
    <ActionBtn type="submit" disabled={!answer.trim() || busy || sending}>{busy || sending ? 'Working with your context…' : 'Help me move this forward'}</ActionBtn>
    <p className="sd-hint">Your answer stays with this mission. Review the draft before using it.</p>
  </form>
}
