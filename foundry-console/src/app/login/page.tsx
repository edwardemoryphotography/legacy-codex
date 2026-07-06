"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function friendlyAuthError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg === "auth_failed") {
    return "Sign-in failed. Request a new code below.";
  }
  if (
    msg.includes("expired") ||
    msg.includes("invalid") ||
    msg.includes("not found") ||
    msg.includes("already been used")
  ) {
    return "That sign-in link was invalid, expired, or already used. Email apps sometimes pre-open links and use them up — enter the 6-digit code instead.";
  }
  if (msg.includes("code verifier") || msg.includes("flow state")) {
    return "That link was opened in a different browser than the one that requested it. Enter the 6-digit code instead — it works anywhere.";
  }
  return raw;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? friendlyAuthError(urlError) : null
  );
  const [loading, setLoading] = useState(false);
  const [lastEmail, setLastEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);

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
      setOtpCode("");
    }
    setLoading(false);
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!lastEmail || otpCode.trim().length < 6) return;

    setVerifying(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: lastEmail,
      token: otpCode.trim(),
      type: "email",
    });

    if (error) {
      setError(friendlyAuthError(error.message));
      setVerifying(false);
    } else {
      // Full navigation so the middleware sees the new auth cookies
      window.location.assign("/");
    }
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
      setOtpCode("");
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

        {error && (
          <div className="rounded-md border border-red-900/50 bg-red-950/30 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {sent ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-5">
            <div className="text-center">
              <p className="text-sm text-zinc-300">
                Check your email for a 6-digit code (or a magic link).
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Sent to <span className="font-mono">{lastEmail}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-3">
              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-medium text-zinc-300"
                >
                  6-digit code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="000000"
                  className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  disabled={verifying || loading}
                />
              </div>
              <button
                type="submit"
                disabled={verifying || loading || otpCode.trim().length < 6}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying ? "Verifying…" : "Sign In with Code"}
              </button>
            </form>

            <div className="space-y-2 text-center">
              <button
                onClick={handleResend}
                disabled={verifying || loading}
                className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
              >
                {loading ? "Resending…" : "Resend code"}
              </button>

              <button
                onClick={handleBackToLogin}
                disabled={verifying || loading}
                className="block w-full text-xs text-zinc-500 hover:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Use a different email
              </button>
            </div>
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

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending code…" : "Send Sign-In Code"}
            </button>

            <p className="text-center text-xs text-zinc-500">
              We&apos;ll email you a 6-digit code to sign in.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
