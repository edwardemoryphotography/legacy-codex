import { resolveEnv } from '@supabase/server/core'

// Not exported by @supabase/server/core; derived from what resolveEnv returns.
type SupabaseEnv = NonNullable<ReturnType<typeof resolveEnv>['data']>

/**
 * Server auth environment for `verifyAuth(req, { auth: 'user' })`, resolved
 * the way /api/analyze already does it: `SUPABASE_URL`, else the public
 * `NEXT_PUBLIC_SUPABASE_URL` (a project URL, not a secret — Vercel previews
 * may only have that one), and, unless `SUPABASE_JWKS` / `SUPABASE_JWKS_URL`
 * is set, the project's own HTTPS JWKS endpoint derived from that URL.
 *
 * The verification URL never comes from a request or a token. Returns a
 * machine-readable reason instead of an env when nothing usable is set.
 */
export function resolveUserAuthEnv(): { env: SupabaseEnv; error: null } | { env: null; error: string } {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasJwksConfig = Boolean(process.env.SUPABASE_JWKS || process.env.SUPABASE_JWKS_URL)
  const { data, error } = resolveEnv(url ? { url } : {})
  if (error || !data) return { env: null, error: error?.code ?? 'UNRESOLVED_ENV' }
  if (!hasJwksConfig) {
    try {
      const jwks = new URL(`${data.url.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`)
      if (jwks.protocol !== 'https:' || jwks.username || jwks.password || jwks.search || jwks.hash) {
        return { env: null, error: 'INVALID_JWKS_URL' }
      }
      data.jwks = jwks
    } catch {
      return { env: null, error: 'INVALID_JWKS_URL' }
    }
  }
  return { env: data, error: null }
}
