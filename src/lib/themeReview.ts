// Shared by ThemeReview (client) and layout.tsx (server). Plain module —
// a 'use client' module's exports would reach the server as references,
// not strings.
export const PRODUCTION_HOST = 'legacy-codex.vercel.app'
export const THEME_KEY = 'codex_review_theme'
export type ReviewTheme = 'dark' | 'light' | 'sunset'

export const THEME_COLOR: Record<ReviewTheme, string> = { dark: '#0a0a0f', light: '#f5f4fa', sunset: '#1e3a46' }

/** Runs before first paint (see layout.tsx) so a stored light or sunset theme does not
 *  flash dark. Kept dependency-free: it is inlined as a string. */
export const THEME_BOOT_SCRIPT = `(function(){try{if(location.hostname===${JSON.stringify(PRODUCTION_HOST)})return;var ok=function(v){return v==='light'||v==='sunset'||v==='dark'};var q=new URLSearchParams(location.search).get('theme');var t=ok(q)?q:localStorage.getItem(${JSON.stringify(THEME_KEY)});if(ok(q))localStorage.setItem(${JSON.stringify(THEME_KEY)},q);if(t==='light'||t==='sunset')document.documentElement.dataset.theme=t}catch(e){}})()`

