"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = getBrowserClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }

    setMessage("Magic link sent. Check your email to continue.");
    setBusy(false);
  }

  useEffect(() => {
    async function handleSessionCheck() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        router.replace("/workspaces");
      }
    }

    void handleSessionCheck();
  }, [router, supabase]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">The Foundry Console</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Sign in with your Supabase magic link.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              className="w-full rounded-md px-3 py-2"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
          >
            {busy ? "Sending..." : "Send magic link"}
          </button>
        </form>

        {message ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
          By continuing you agree to use only real workspace data. No mock data
          is shown in this console.
        </p>
      </div>

      <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        Need help? Confirm your backend env vars and open{" "}
        <Link href="/" className="underline">
          the workspace index
        </Link>
        .
      </p>
    </main>
  );
}
