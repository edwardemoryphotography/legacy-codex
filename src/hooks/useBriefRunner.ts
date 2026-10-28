'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { BriefMode } from '@/lib/dailyBrief'

export type BriefStatus = 'idle' | 'running' | 'done' | 'error'

export interface BriefRunner {
  configured: boolean
  visitor: boolean
  status: BriefStatus
  activeMode: BriefMode | null
  output: string
  // Names the mission (and wall) a single-mission answer is about, so it is
  // never read as being about whatever is selected now.
  outputLabel: string
  providerLabel: string
  run: (mode: BriefMode, body: Record<string, unknown>, label?: string) => Promise<void>
  reset: () => void
}

// Shared by Brief and Territory: one owner-gated, display-only call to
// /api/brief. A visitor's 403 is an expected boundary, not an error. Any reply
// that arrives after reset() or a newer run() is dropped.
export function useBriefRunner(): BriefRunner {
  const [configured, setConfigured] = useState(false)
  const [visitor, setVisitor] = useState(false)
  const [status, setStatus] = useState<BriefStatus>('idle')
  const [activeMode, setActiveMode] = useState<BriefMode | null>(null)
  const [output, setOutput] = useState('')
  const [outputLabel, setOutputLabel] = useState('')
  const [providerLabel, setProviderLabel] = useState('')
  const requestRef = useRef(0)

  useEffect(() => {
    fetch('/api/brief')
      .then(res => res.json())
      .then(data => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false))
  }, [])

  const reset = useCallback(() => {
    requestRef.current += 1
    setOutput('')
    setOutputLabel('')
    setProviderLabel('')
    setStatus('idle')
    setActiveMode(null)
  }, [])

  const run = useCallback(async (mode: BriefMode, body: Record<string, unknown>, label = '') => {
    const request = ++requestRef.current
    setStatus('running')
    setActiveMode(mode)
    setOutput('')
    setOutputLabel('')
    setProviderLabel('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      if (request !== requestRef.current) return
      if (res.status === 403) {
        setVisitor(true)
        setStatus('idle')
        setActiveMode(null)
        return
      }
      const data = await res.json()
      if (request !== requestRef.current) return
      if (!res.ok || data.error) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setOutput(data.text || 'No brief text returned.')
      const names: Record<string, string> = { anthropic: 'Claude', gemini: 'Gemini', openai: 'OpenAI' }
      if (names[data.provider] && typeof data.model === 'string') {
        const fallbacks = Array.isArray(data.fallbacks) ? data.fallbacks
          .filter((entry: { provider?: string; reason?: string }) => names[entry?.provider ?? ''] && typeof entry.reason === 'string')
          .map((entry: { provider: string; reason: string }) => `${names[entry.provider]} ${entry.reason}`) : []
        setProviderLabel(`${names[data.provider]} · ${data.model}${fallbacks.length ? ` · Fallback: ${fallbacks.join('; ')}` : ''}`)
      }
      setOutputLabel(label)
      setStatus('done')
    } catch (err) {
      if (request !== requestRef.current) return
      setOutput(err instanceof Error ? err.message : String(err))
      setOutputLabel(label)
      setStatus('error')
    }
  }, [])

  return { configured, visitor, status, activeMode, output, outputLabel, providerLabel, run, reset }
}
