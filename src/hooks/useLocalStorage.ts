'use client'

import { useState, useEffect } from 'react'

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) {
        setValue(JSON.parse(stored) as T)
      }
    } catch {
      // localStorage unavailable or invalid JSON — stay with default
    }
  }, [key])

  const set = (nextValue: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof nextValue === 'function'
        ? (nextValue as (prev: T) => T)(prev)
        : nextValue
      try {
        localStorage.setItem(key, JSON.stringify(resolved))
      } catch {
        // quota exceeded or unavailable
      }
      return resolved
    })
  }

  return [value, set, mounted] as const
}
