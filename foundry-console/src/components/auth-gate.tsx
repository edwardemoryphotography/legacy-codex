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

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (email.trim().toLowerCase() !== ALLOWED_EMAIL) {
      setMessage("This Foundry Console only permits the owner account.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: ALLOWED_EMAIL,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    setMessage(error ? error.message : "Check your email for the secure sign-in link.");
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center">Checking session…</main>;
  }

  const signedInEmail = session?.user.email?.toLowerCase();
  if (!session || signedInEmail !== ALLOWED_EMAIL) {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-950 px-6 text-neutral-100">
        <form
          onSubmit={requestMagicLink}
          className="w-full max-w-md space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-7 shadow-2xl"
        >
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
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-950 hover:bg-white"
          >
            Email me a sign-in link
          </button>
          {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
        </form>
      </main>
    );
  }

  return children;
}
