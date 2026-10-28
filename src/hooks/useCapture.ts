'use client'

// Shared capture-to-nd_captures pipeline. Originally lived duplicated in
// ControlsTab (the full inbox UI) and, temporarily, inline in MissionTab
// (write-only, no inbox display — Mission Screen must not expose the full
// backlog). Both now go through this one hook so there is exactly one place
// that writes a capture.

import { useCallback, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { readCaptureInbox, writeCaptureInbox } from '@/lib/captureCache'
import type { CaptureItem } from '@/types'
import { supabase } from '@/lib/supabase/client'

const EMPTY_INBOX: CaptureItem[] = []

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
  const ownerId = user?.id ?? null
  const [cache, setCache] = useState<{ ownerId: string | null; inbox: CaptureItem[]; synced: Set<string> }>({ ownerId: null, inbox: [], synced: new Set() })
  const inbox = cache.ownerId === ownerId ? cache.inbox : EMPTY_INBOX
  const syncedCaptureIds = cache.ownerId === ownerId ? cache.synced : new Set<string>()
  const loadAttempt = useRef(0)
  const [status, setStatus] = useState('')

  const setInbox = useCallback((next: CaptureItem[] | ((previous: CaptureItem[]) => CaptureItem[])) => {
    setCache(previous => {
      const stored = readCaptureInbox(ownerId)
      const existing = previous.ownerId === ownerId
        ? [...previous.inbox, ...stored.filter(item => !previous.inbox.some(current => current.id === item.id))] : stored
      const items = typeof next === 'function' ? next(existing) : next
      try { writeCaptureInbox(ownerId, items) } catch { /* Retain this account's in-memory draft if storage is full. */ }
      return { ownerId, inbox: items, synced: previous.ownerId === ownerId ? previous.synced : new Set() }
    })
  }, [ownerId])

  const setSyncedCaptureIds = useCallback((next: Set<string> | ((previous: Set<string>) => Set<string>)) => {
    setCache(previous => previous.ownerId !== ownerId ? previous : {
      ...previous, synced: typeof next === 'function' ? next(previous.synced) : next,
    })
  }, [ownerId])

  const flash = useCallback((msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 1200)
  }, [])

  // Pulls the last 12 captures from Supabase as the inbox (source of truth
  // once signed in). Called by whichever tab's auth effect runs first.
  const loadCaptures = useCallback(async (userId: string) => {
    const attempt = ++loadAttempt.current
    const { data, error } = await supabase
      .from('nd_captures')
      .select('id, text, created_at, tags')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12)
    if (attempt !== loadAttempt.current) return
    const local = readCaptureInbox(userId)
    if (error) {
      setCache({ ownerId: userId, inbox: local, synced: new Set() })
      throw error
    }
    const remote: CaptureItem[] = ((data ?? []) as CaptureRow[]).map(d => ({
      id: d.id,
      text: d.text,
      timestamp: d.created_at,
      suggested: (d.tags && d.tags[0]) || 'general',
    }))
    const items = [...local.filter(item => !remote.some(row => row.id === item.id)), ...remote].slice(0, 12)
    try { writeCaptureInbox(userId, items) } catch { /* Keep the current account visible even if storage is unavailable. */ }
    setCache({ ownerId: userId, inbox: items, synced: new Set(remote.map(item => item.id)) })
  }, [])

  const syncToSupabase = useCallback(async (items: CaptureItem[]) => {
    if (!user?.id || items.length === 0) return
    const cached = readCaptureInbox(user.id)
    if (items.some(item => !cached.some(current => current.id === item.id))) {
      throw new Error('These captures belong to another account or could not be saved locally. Reconnect before syncing.')
    }

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
  }, [user, setSyncedCaptureIds])

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
    // Persist synchronously before sync checks ownership; React may defer its
    // state updater until after the async write has already started.
    try { writeCaptureInbox(ownerId, [item, ...readCaptureInbox(ownerId)].slice(0, 12)) } catch { /* Keep the draft in memory below. */ }
    setInbox(prev => [item, ...prev.filter(current => current.id !== item.id)].slice(0, 12))
    flash('Captured to inbox')
    return syncToSupabase([item])
      .then(() => {
        if (user?.id) flash('Saved to Supabase')
        return item
      })
      .catch(() => {
        flash('Capture sync failed (RLS?)')
        return item
      })
  }, [setInbox, syncToSupabase, user, flash, ownerId])

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
  }, [user, setInbox, setSyncedCaptureIds])

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
  }, [setInbox, setSyncedCaptureIds])

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
