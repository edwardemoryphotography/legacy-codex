"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastEmail, setLastEmail] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message || "Failed to send magic link. Please try again.");
    } else {
      setLastEmail(email);
      setSent(true);
    }
    setLoading(false);
  }

  async function handleResend() {
    if (!lastEmail) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: lastEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message || "Failed to resend magic link.");
    } else {
      // Keep sent state, just show success feedback
    }
    setLoading(false);
  }

  function handleBackToLogin() {
    setSent(false);
    setError(null);
    setEmail(lastEmail || "");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            The Foundry Console
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Case Study Zero
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center space-y-4">
            <div>
              <p className="text-sm text-zinc-300">
                Check your email for a magic link to sign in.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Sent to <span className="font-mono">{lastEmail}</span>
              </p>
            </div>

            <button
              onClick={handleResend}
              disabled={loading}
              className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              {loading ? "Resending…" : "Resend magic link"}
            </button>

            <button
              onClick={handleBackToLogin}
              className="block w-full text-xs text-zinc-500 hover:text-zinc-400"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending magic link…" : "Send Magic Link"}
            </button>

            <p className="text-center text-xs text-zinc-500">
              We&apos;ll email you a secure link to sign in.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
