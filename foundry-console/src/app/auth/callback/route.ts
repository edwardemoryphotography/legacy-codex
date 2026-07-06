import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

function loginRedirect(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  // token_hash flow: verifies server-side, works in any browser —
  // no PKCE code_verifier cookie required
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
    return loginRedirect(origin, error.message);
  }

  // PKCE flow: only works in the browser that requested the magic link
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
    return loginRedirect(origin, error.message);
  }

  // Supabase redirects here with the error in the query string when the
  // link was expired or already used (e.g. consumed by an email scanner)
  const description =
    searchParams.get("error_description") ?? searchParams.get("error");
  return loginRedirect(
    origin,
    description ??
      "The sign-in link contained no code — it may have expired or already been used."
  );
}
