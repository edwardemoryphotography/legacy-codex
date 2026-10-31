'use client'

import { useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { EmailAccountFlow } from '@/types'
import { AccountSwitchWarning, confirmConversion, confirmEmailSignIn, emailAccountMessage, isEmailAccount, sendConversionCode, sendSignInCode, signOutEmailAccount } from '@/lib/supabase/emailAccount'
import { ActionBtn, Card, Input, SectionTitle } from '@/components/ui'

export default function AccountCard({ user, loading, connectionError, onRetry, onConverted }: {
  user: User | null
  loading: boolean
  connectionError: string
  onRetry: () => void
  onConverted: (user: User) => void
}) {
  const [flow, setFlow] = useState<EmailAccountFlow>('attach')
  const [email, setEmail] = useState(user?.new_email ?? '')
  const [sentEmail, setSentEmail] = useState(user?.new_email ?? '')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [warning, setWarning] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  function changeFlow(next: EmailAccountFlow) {
    setFlow(next)
    setEmail('')
    setSentEmail('')
    setCode('')
    setError('')
    setNotice('')
    setWarning('')
    setAcknowledged(false)
  }

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (failure) {
      if (failure instanceof AccountSwitchWarning) setWarning(failure.message)
      else setError(emailAccountMessage(failure))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function sendCode() {
    const address = email.trim()
    if (flow === 'attach') {
      if (!user) return
      await sendConversionCode(address, user.id)
    } else {
      await sendSignInCode(address, user?.id ?? null, acknowledged)
    }
    setSentEmail(address)
    setCode('')
    setNotice('Code requested. Check your email and enter the code here, in this browser.')
  }

  async function confirm() {
    if (!/^\d{6,10}$/.test(code)) {
      setError('Enter the number code from your email.')
      return
    }
    if (flow === 'attach' && user) {
      const converted = await confirmConversion(sentEmail, code, user.id)
      setCode('')
      setSentEmail('')
      setNotice('Email confirmed. Your account and saved missions have kept the same account id.')
      onConverted(converted)
    } else if (flow === 'signin') {
      await confirmEmailSignIn(sentEmail, code, user?.id ?? null, acknowledged)
      // All tabs re-read the new session; no old account's in-memory data survives.
      window.location.reload()
    }
  }

  return (
    <Card>
      <section aria-label="Account" className="space-y-4 min-w-0" style={{ fontSize: '1rem', overflowWrap: 'anywhere' }} aria-busy={busy || loading}>
        <SectionTitle>Account</SectionTitle>
        {user && <p style={{ color: 'var(--text-soft)', fontSize: '0.8rem' }}>Account ID: {user.id}</p>}
        {loading ? <p role="status">Checking this browser’s account…</p> : <>
          {connectionError && <div role="alert" className="space-y-3">
            <p>{connectionError}</p>
            <ActionBtn onClick={onRetry} disabled={busy} variant="secondary">Retry account connection</ActionBtn>
          </div>}
          {isEmailAccount(user) ? <>
            <p>Signed in as {user!.email} — works in any browser</p>
            <ActionBtn disabled={busy} variant="secondary" onClick={() => void run(async () => {
              await signOutEmailAccount(user!.id)
              window.location.reload()
            })}>Sign out</ActionBtn>
          </> : <>
            <p>{flow === 'attach'
              ? 'This account lives only in this browser. Add your email to use it anywhere.'
              : 'Sign in with the email you already added to your account. Enter the code here to bring that account into this browser.'}</p>
            {flow === 'attach' && <p style={{ color: 'var(--text-soft)' }}>Start in the browser that already has the missions you want to keep.</p>}
            {(flow === 'signin' || user?.is_anonymous) && <form className="space-y-3" onSubmit={event => {
              event.preventDefault()
              void run(sentEmail ? confirm : sendCode)
            }}>
              <label className="block space-y-2" htmlFor="account-email">
                <span>Email</span>
                <Input id="account-email" type="email" autoComplete="email" required value={email} disabled={busy || !!sentEmail}
                  onChange={setEmail} />
              </label>
              {sentEmail && <label className="block space-y-2" htmlFor="account-code">
                <span>Code from your email</span>
                <input id="account-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required
                  value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 10))} disabled={busy}
                  style={{ width: '100%', minWidth: 0, minHeight: 44, font: 'inherit', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--line-strong)', color: 'var(--text)', background: 'var(--field-bg)' }} />
              </label>}
              {warning && <div role="alert" className="space-y-3" style={{ color: 'var(--amber)' }}>
                <p>{warning}</p>
                <label className="flex items-start gap-3 py-2" style={{ minHeight: 44 }}>
                  <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={busy} style={{ width: 20, height: 20, flexShrink: 0 }} />
                  <span>I understand. Sign in to the other account anyway.</span>
                </label>
              </div>}
              <div className="flex flex-wrap gap-3">
                <ActionBtn type="submit" disabled={busy || (!!warning && !acknowledged)}>{busy ? 'Please wait…' : sentEmail ? 'Confirm' : 'Send code'}</ActionBtn>
                {sentEmail && <>
                  <ActionBtn variant="secondary" disabled={busy} onClick={() => void run(sendCode)}>Send new code</ActionBtn>
                  <ActionBtn variant="secondary" disabled={busy} onClick={() => { setSentEmail(''); setCode(''); setError(''); setNotice('') }}>Change email</ActionBtn>
                </>}
              </div>
            </form>}
            <button type="button" disabled={busy} className="text-left underline" style={{ minHeight: 44, color: 'var(--text-soft)' }}
              onClick={() => changeFlow(flow === 'attach' ? 'signin' : 'attach')}>
              {flow === 'attach' ? 'Already have an account? Sign in with email' : 'Keep this browser’s account — add an email instead'}
            </button>
          </>}
        </>}
        {error && <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </section>
    </Card>
  )
}
