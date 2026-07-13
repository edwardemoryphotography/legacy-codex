"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_EMAIL = "freddyv@duck.com";
const MIN_PASSWORD_LENGTH = 12;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(ALLOWED_EMAIL);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
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

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (email.trim().toLowerCase() !== ALLOWED_EMAIL) {
      setMessage("This Foundry Console only permits the owner account.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: ALLOWED_EMAIL,
      password,
    });
    setBusy(false);

    if (error) {
      setMessage("The email or password is incorrect.");
    } else {
      setPassword("");
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("The new passwords do not match.");
      return;
    }

    setBusy(true);
    const metadata = session?.user.user_metadata ?? {};
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { ...metadata, must_change_password: false },
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (session && data.user) {
      setSession({ ...session, user: data.user });
    }
    setNewPassword("");
    setConfirmPassword("");
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
  const isOwner = Boolean(session && signedInEmail === ALLOWED_EMAIL);
  const mustChangePassword = session?.user.user_metadata?.must_change_password === true;

  if (isOwner && mustChangePassword) {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-950 px-6 text-neutral-100">
        <form
          onSubmit={changePassword}
          className="w-full max-w-md space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-7 shadow-2xl"
        >
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">Foundry Console</p>
            <h1 className="mt-2 text-2xl font-semibold">Choose your private password</h1>
            <p className="mt-2 text-sm text-neutral-400">
              Replace the temporary password now. Future visits on this device will open
              directly while your session remains active.
            </p>
          </div>
          <label className="block text-sm font-medium">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              disabled={busy}
              className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-400"
            />
          </label>
          <label className="block text-sm font-medium">
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              disabled={busy}
              className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-400"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save password and continue"}
          </button>
          {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
        </form>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-950 px-6 text-neutral-100">
        <div className="w-full max-w-md space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-7 shadow-2xl">
          <form onSubmit={signIn} className="space-y-5">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">Foundry Console</p>
              <h1 className="mt-2 text-2xl font-semibold">Owner sign-in</h1>
              <p className="mt-2 text-sm text-neutral-400">
                Sign in once. This device will keep your session so the permanent link opens
                directly next time.
              </p>
            </div>
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                disabled={busy || Boolean(session)}
                className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-400"
              />
            </label>
            {!session ? (
              <label className="block text-sm font-medium">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-neutral-400"
                />
              </label>
            ) : null}
            {!session ? (
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            ) : null}
            {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
          </form>
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
