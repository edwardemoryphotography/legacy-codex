'use client'

// Shared capture-to-nd_captures pipeline. Originally lived duplicated in
// ControlsTab (the full inbox UI) and, temporarily, inline in MissionTab
// (write-only, no inbox display — Mission Screen must not expose the full
// backlog). Both now go through this one hook so there is exactly one place
// that writes a capture.

import { useCallback, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { CaptureItem } from '@/types'
import { supabase } from '@/lib/supabase/client'

const INBOX_KEY = 'nd_inbox_v1'
const DEFAULT_INBOX: CaptureItem[] = []

interface CaptureRow {
  id: string
  text: string
  created_at: string
  tags?: string[]
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

function suggestTag(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('client') || lower.includes('shoot')) return 'artistic'
  if (lower.includes('code') || lower.includes('sprint')) return 'automation'
  return 'personalos'
}

export function useCapture(user: User | null) {
  const [inbox, setInbox] = useLocalStorage<CaptureItem[]>(INBOX_KEY, DEFAULT_INBOX)
  const [syncedCaptureIds, setSyncedCaptureIds] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState('')

  const flash = useCallback((msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 1200)
  }, [])

  // Pulls the last 12 captures from Supabase as the inbox (source of truth
  // once signed in). Called by whichever tab's auth effect runs first.
  const loadCaptures = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('nd_captures')
      .select('id, text, created_at, tags')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12)
    if (data && data.length > 0) {
      const items: CaptureItem[] = (data as CaptureRow[]).map(d => ({
        id: d.id,
        text: d.text,
        timestamp: d.created_at,
        suggested: (d.tags && d.tags[0]) || 'general',
      }))
      setInbox(items)
      setSyncedCaptureIds(new Set(items.map(i => i.id)))
    }
  }, [setInbox])

  const syncToSupabase = useCallback(async (items: CaptureItem[]) => {
    if (!user?.id || items.length === 0) return

    const rows = items.map(item => ({
      id: item.id,
      user_id: user.id,
      text: item.text,
      tags: [item.suggested || 'general'],
      created_at: item.timestamp,
    }))
    const { error } = await supabase
      .from('nd_captures')
      .upsert(rows, { onConflict: 'id' })

    if (error) throw error

    setSyncedCaptureIds(prev => {
      const next = new Set(prev)
      items.forEach(item => next.add(item.id))
      return next
    })
  }, [user])

  // A new idea always enters Parked by default (spec §6) — nd_captures'
  // own default state column already encodes that; this just writes text.
  const capture = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const item: CaptureItem = {
      id: newId(),
      text: trimmed,
      timestamp: new Date().toISOString(),
      suggested: suggestTag(trimmed),
    }
    setInbox(prev => [item, ...prev].slice(0, 12))
    flash('Captured to inbox')
    void syncToSupabase([item])
      .then(() => {
        if (user?.id) flash('Saved to Supabase')
      })
      .catch(() => flash('Capture sync failed (RLS?)'))
    return item
  }, [setInbox, syncToSupabase, user, flash])

  const removeItem = useCallback(async (id: string) => {
    setInbox(prev => prev.filter(i => i.id !== id))
    setSyncedCaptureIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (!user?.id) return
    try {
      await supabase.from('nd_captures').delete().eq('id', id).eq('user_id', user.id)
    } catch {
      // silent — local removal already happened, matches prior ControlsTab behavior
    }
  }, [user, setInbox])

  const forceSyncItem = useCallback(async (item: CaptureItem) => {
    await syncToSupabase([item])
  }, [syncToSupabase])

  const forceSyncItems = useCallback(async (items: CaptureItem[]) => {
    await syncToSupabase(items)
  }, [syncToSupabase])

  const exportInbox = useCallback(() => {
    const data = JSON.stringify(inbox, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `legacy-codex-inbox-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [inbox])

  const clearInbox = useCallback(() => {
    setInbox([])
    setSyncedCaptureIds(new Set())
  }, [setInbox])

  return {
    inbox,
    syncedCaptureIds,
    status,
    loadCaptures,
    capture,
    removeItem,
    forceSyncItem,
    forceSyncItems,
    exportInbox,
    clearInbox,
  }
}
