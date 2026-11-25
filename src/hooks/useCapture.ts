'use client'

// Shared capture-to-nd_captures pipeline. Used by ControlsTab (full Quick
// Capture inbox UI) and MissionTab (write-only capture). Original captured
// text is always stored verbatim and isolated strictly per user account.

import { useCallback, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { readCaptureInbox, writeCaptureInbox } from '@/lib/captureCache'
import type { CaptureItem } from '@/types'
import { supabase } from '@/lib/supabase/client'

const EMPTY_INBOX: CaptureItem[] = []
const CAPTURE_LIMIT = 50

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
  const [syncError, setSyncError] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

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
    setTimeout(() => setStatus(''), 1400)
  }, [])

  // Pulls recent captures from Supabase as the inbox (source of truth once signed in).
  const loadCaptures = useCallback(async (userId: string) => {
    const attempt = ++loadAttempt.current
    const { data, error } = await supabase
      .from('nd_captures')
      .select('id, text, created_at, tags')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(CAPTURE_LIMIT)
    if (attempt !== loadAttempt.current) return
    const local = readCaptureInbox(userId)
    if (error) {
      setSyncError('Could not load cloud captures. Showing items saved on this device.')
      setCache({ ownerId: userId, inbox: local, synced: new Set() })
      throw error
    }
    const remote: CaptureItem[] = ((data ?? []) as CaptureRow[]).map(d => ({
      id: d.id,
      text: d.text,
      timestamp: d.created_at,
      suggested: (d.tags && d.tags[0]) || 'general',
    }))
    const items = [...local.filter(item => !remote.some(row => row.id === item.id)), ...remote].slice(0, CAPTURE_LIMIT)
    try { writeCaptureInbox(userId, items) } catch { /* Keep the current account visible even if storage is unavailable. */ }
    setSyncError('')
    setLastSyncedAt(new Date().toISOString())
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

    setSyncError('')
    setLastSyncedAt(new Date().toISOString())
    setSyncedCaptureIds(prev => {
      const next = new Set(prev)
      items.forEach(item => next.add(item.id))
      return next
    })
  }, [user, setSyncedCaptureIds])

  // Preserves captured text verbatim (trimmed of outer whitespace only).
  const capture = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const item: CaptureItem = {
      id: newId(),
      text: trimmed,
      timestamp: new Date().toISOString(),
      suggested: suggestTag(trimmed),
    }
    try { writeCaptureInbox(ownerId, [item, ...readCaptureInbox(ownerId)].slice(0, CAPTURE_LIMIT)) } catch { /* Keep the draft in memory below. */ }
    setInbox(prev => [item, ...prev.filter(current => current.id !== item.id)].slice(0, CAPTURE_LIMIT))
    flash('Captured to inbox')
    return syncToSupabase([item])
      .then(() => {
        if (user?.id) flash('Synced to your account')
        return item
      })
      .catch(() => {
        setSyncError('Saved on this device, but cloud sync did not complete.')
        flash('Saved locally (sync pending)')
        return item
      })
  }, [setInbox, syncToSupabase, user, flash, ownerId])

  // Edits an existing capture verbatim while preserving its ID and original timestamp.
  const updateItem = useCallback(async (id: string, nextText: string): Promise<{ ok: boolean; synced: boolean; error?: string }> => {
    const trimmed = nextText.trim()
    if (!trimmed) return { ok: false, synced: false, error: 'Capture text cannot be empty.' }
    const stored = readCaptureInbox(ownerId)
    const target = stored.find(item => item.id === id) ?? inbox.find(item => item.id === id)
    if (!target) return { ok: false, synced: false, error: 'Capture was not found in this account.' }
    const updated: CaptureItem = { ...target, text: trimmed, suggested: suggestTag(trimmed) }
    const merged = [updated, ...stored.filter(item => item.id !== id)]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, CAPTURE_LIMIT)
    try { writeCaptureInbox(ownerId, merged) } catch { /* Keep updated text in memory. */ }
    setInbox(prev => prev.map(item => item.id === id ? updated : item))
    setSyncedCaptureIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (!user?.id) return { ok: true, synced: false }
    try {
      await syncToSupabase([updated])
      return { ok: true, synced: true }
    } catch {
      const message = 'Updated on this device, but cloud sync failed. Use Sync now to retry.'
      setSyncError(message)
      return { ok: true, synced: false, error: message }
    }
  }, [ownerId, inbox, setInbox, setSyncedCaptureIds, user, syncToSupabase])

  const removeItem = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const nextLocal = readCaptureInbox(ownerId).filter(item => item.id !== id)
    try { writeCaptureInbox(ownerId, nextLocal) } catch { /* Keep removal in memory. */ }
    setInbox(prev => prev.filter(i => i.id !== id))
    setSyncedCaptureIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (!user?.id) return { ok: true }
    try {
      const { error } = await supabase.from('nd_captures').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
      setSyncError('')
      return { ok: true }
    } catch {
      const message = 'Removed on this device, but cloud deletion could not be confirmed.'
      setSyncError(message)
      return { ok: false, error: message }
    }
  }, [ownerId, user, setInbox, setSyncedCaptureIds])

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

  const clearInbox = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try { writeCaptureInbox(ownerId, []) } catch { /* Clear memory below. */ }
    setInbox([])
    setSyncedCaptureIds(new Set())
    if (!user?.id) return { ok: true }
    try {
      const { error } = await supabase.from('nd_captures').delete().eq('user_id', user.id)
      if (error) throw error
      setSyncError('')
      setLastSyncedAt(new Date().toISOString())
      return { ok: true }
    } catch {
      const message = 'Cleared on this device, but cloud captures could not be deleted.'
      setSyncError(message)
      return { ok: false, error: message }
    }
  }, [ownerId, user, setInbox, setSyncedCaptureIds])

  return {
    inbox,
    syncedCaptureIds,
    status,
    syncError,
    lastSyncedAt,
    loadCaptures,
    capture,
    updateItem,
    removeItem,
    forceSyncItem,
    forceSyncItems,
    exportInbox,
    clearInbox,
  }
}
