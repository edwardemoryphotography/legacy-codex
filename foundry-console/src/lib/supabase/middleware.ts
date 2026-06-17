import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieEntry = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Guard against missing env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables");
    // In production you might want to redirect to an error page
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieEntry[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (
      !user &&
      !request.nextUrl.pathname.startsWith("/login") &&
      !request.nextUrl.pathname.startsWith("/auth")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  } catch (error) {
    // Handle token refresh / auth errors gracefully
    console.error("Auth error in middleware:", error);

    // If there's an auth error on a protected route, redirect to login
    if (
      !request.nextUrl.pathname.startsWith("/login") &&
      !request.nextUrl.pathname.startsWith("/auth")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
