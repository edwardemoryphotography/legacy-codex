import { createHmac, randomBytes } from 'node:crypto'

// Real Supabase-shaped HS256 JWTs, verified by the real @supabase/server
// verifyAuth against an inline test JWKS (SUPABASE_JWKS). Nothing about auth
// is mocked: a route under test makes the same cryptographic check it makes
// in production, just against a throwaway key generated for this test run.
const secret = randomBytes(32)
const kid = 'route-test-key'

export const TEST_JWKS = JSON.stringify({
  keys: [{ kty: 'oct', alg: 'HS256', kid, k: secret.toString('base64url') }],
})

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

function sign(claims: Record<string, unknown>, key: Buffer = secret): string {
  const now = Math.floor(Date.now() / 1000)
  const head = `${b64({ alg: 'HS256', typ: 'JWT', kid })}.${b64({ aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 600, ...claims })}`
  return `${head}.${createHmac('sha256', key).update(head).digest('base64url')}`
}

/** The session every visitor gets automatically (supabase.auth.signInAnonymously). */
export const anonymousGuestToken = (sub: string) => sign({ sub, is_anonymous: true })

/** A real (non-anonymous) user session. */
export const userToken = (sub: string) => sign({ sub, is_anonymous: false })

/** Correctly shaped but signed with a different key — must be a 401, never a 500. */
export const forgedToken = (sub: string) => sign({ sub }, randomBytes(32))
