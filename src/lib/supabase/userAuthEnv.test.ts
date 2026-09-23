import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveUserAuthEnv } from './userAuthEnv'

const KEYS = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_JWKS', 'SUPABASE_JWKS_URL'] as const

function only(env: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) vi.stubEnv(key, env[key] ?? '')
}

describe('resolveUserAuthEnv', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('resolves from the public project URL alone, deriving the HTTPS JWKS endpoint', () => {
    only({ NEXT_PUBLIC_SUPABASE_URL: 'https://pkydkbuodikttfeawqsw.supabase.co' })
    const result = resolveUserAuthEnv()
    expect(result.error).toBeNull()
    expect(result.env?.url).toBe('https://pkydkbuodikttfeawqsw.supabase.co')
    expect(String(result.env?.jwks)).toBe('https://pkydkbuodikttfeawqsw.supabase.co/auth/v1/.well-known/jwks.json')
  })

  it('prefers SUPABASE_URL when both are set', () => {
    only({ SUPABASE_URL: 'https://server.supabase.co', NEXT_PUBLIC_SUPABASE_URL: 'https://public.supabase.co' })
    expect(resolveUserAuthEnv().env?.url).toBe('https://server.supabase.co')
  })

  it('refuses to derive a JWKS endpoint that is not plain HTTPS', () => {
    only({ NEXT_PUBLIC_SUPABASE_URL: 'http://pkydkbuodikttfeawqsw.supabase.co' })
    expect(resolveUserAuthEnv()).toEqual({ env: null, error: 'INVALID_JWKS_URL' })
  })

  it('reports a missing URL instead of inventing one', () => {
    only({})
    const result = resolveUserAuthEnv()
    expect(result.env).toBeNull()
    expect(result.error).toBeTruthy()
  })
})
