"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_EMAIL = "freddyv@duck.com";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(ALLOWED_EMAIL);
  const [message, setMessage] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Send a one-time code, not a magic link: no emailRedirectTo means nothing
  // clickable in the email, so inbox link-scanners can't consume the token
  // before the owner types it.
  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (email.trim().toLowerCase() !== ALLOWED_EMAIL) {
      setMessage("This Foundry Console only permits the owner account.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: ALLOWED_EMAIL,
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
    } else {
      setCodeSent(true);
      setCode("");
      setMessage(null);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.trim().length < 6) return;

    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({
      email: ALLOWED_EMAIL,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);

    if (error) {
      setMessage(
        /expired|invalid|not found/i.test(error.message)
          ? "That code is invalid or expired. Request a new one."
          : error.message
      );
    }
    // On success onAuthStateChange updates the session and the gate opens.
  }

  async function signOut() {
    setMessage(null);
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center">Checking session…</main>;
  }

  const signedInEmail = session?.user.email?.toLowerCase();
  if (!session || signedInEmail !== ALLOWED_EMAIL) {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-950 px-6 text-neutral-100">
        <div className="w-full max-w-md space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-7 shadow-2xl">
          {codeSent ? (
            <form onSubmit={verifyCode} className="space-y-5">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">Foundry Console</p>
                <h1 className="mt-2 text-2xl font-semibold">Enter your code</h1>
                <p className="mt-2 text-sm text-neutral-400">
                  A 6-digit code was emailed to the owner account. Type it below — the email
                  contains no link to click.
                </p>
              </div>
              <label className="block text-sm font-medium">
                6-digit code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                  className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-neutral-400"
                  disabled={busy}
                />
              </label>
              <button
                type="submit"
                disabled={busy || code.trim().length < 6}
                className="w-full rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  setMessage(null);
                }}
                disabled={busy}
                className="w-full text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
              >
                Request a new code
              </button>
              {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
            </form>
          ) : (
            <form onSubmit={requestCode} className="space-y-5">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">Foundry Console</p>
                <h1 className="mt-2 text-2xl font-semibold">Owner sign-in required</h1>
                <p className="mt-2 text-sm text-neutral-400">
                  Access is restricted at both the application and database layers.
                </p>
              </div>
              <label className="block text-sm font-medium">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-400"
                  disabled={busy}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
              >
                {busy ? "Sending…" : "Email me a sign-in code"}
              </button>
              {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
            </form>
          )}
          {session ? (
            <div className="border-t border-neutral-800 pt-4 text-center">
              <p className="mb-2 text-xs text-neutral-500">
                Signed in as {session.user.email}
              </p>
              <button
                type="button"
                onClick={signOut}
                className="text-sm text-red-400 underline hover:text-red-300"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  return children;
}
