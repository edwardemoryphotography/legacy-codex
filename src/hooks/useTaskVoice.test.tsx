import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useTaskVoice } from './useTaskVoice'

// Browser callback contracts only, not a real microphone or speech-service test.
class Recognition {
  static current: Recognition
  lang = ''; interimResults = false; continuous = false
  onstart: (() => void) | null = null
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  abort = vi.fn()
  stop = vi.fn()
  constructor() { Recognition.current = this }
  start() { this.onstart?.() }
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('releases a listening microphone that never supplies any words', () => {
  vi.useFakeTimers()
  vi.stubGlobal('SpeechRecognition', Recognition)
  const change = vi.fn()
  const { result } = renderHook(() => useTaskVoice('', change))
  act(() => result.current.toggle())
  expect(result.current.phase).toBe('listening')
  act(() => vi.advanceTimersByTime(15000))
  expect(result.current.active).toBe(false)
  expect(Recognition.current.abort).toHaveBeenCalled()
  expect(result.current.status).toMatch(/no words|no speech/i)
  expect(change).not.toHaveBeenCalled()
})

it('uses the composer limit and reports it instead of silently clipping voice at another limit', () => {
  vi.stubGlobal('SpeechRecognition', Recognition)
  const change = vi.fn()
  const { result } = renderHook(() => useTaskVoice('', change, 400))
  act(() => result.current.toggle())
  const actual = 'this text box doesnt even let me send it anywhere '
  act(() => Recognition.current.onresult?.({ results: [[{ transcript: actual.repeat(10) }]] }))
  expect(change).toHaveBeenCalledWith(actual.repeat(10).trim().slice(0, 400))
  act(() => Recognition.current.onend?.())
  expect(result.current.status).toMatch(/400/)
})

it('keeps the five-second Stop deadline when a late final result arrives without end', () => {
  vi.useFakeTimers()
  vi.stubGlobal('SpeechRecognition', Recognition)
  const change = vi.fn()
  const { result } = renderHook(() => useTaskVoice('', change))
  act(() => result.current.toggle())
  act(() => result.current.toggle())
  expect(result.current.phase).toBe('stopping')
  act(() => vi.advanceTimersByTime(4000))
  act(() => Recognition.current.onresult?.({ results: [[{ transcript: 'also the microphone logo is there' }]] }))
  expect(change).toHaveBeenCalledWith('also the microphone logo is there')
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current.active).toBe(false)
  expect(Recognition.current.abort).toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
