import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/instrument-sans/wght.css'
import '@fontsource/instrument-serif/latin-400.css'
import './globals.css'
import { THEME_BOOT_SCRIPT } from '@/lib/themeReview'

export const metadata: Metadata = {
  title: 'Legacy Codex',
  description: 'Legacy Codex preserves context, clarifies what matters, and helps choose the next meaningful action.',
  robots: 'noindex, nofollow',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0f',
  viewportFit: 'cover',
}

// The light/dark review switch exists only on Vercel preview deployments and
// local development, decided from the deployment's own configuration at
// build time. Every production deployment — whichever Vercel project or
// domain serves it — gets neither the switch nor the boot script. If
// VERCEL_ENV is unavailable the switch is simply absent (fails closed).
const THEME_REVIEW_ENABLED = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The review theme is applied before paint by the script below, so the
    // server-rendered <html> can legitimately differ on data-theme.
    <html lang="en" suppressHydrationWarning data-theme-review={THEME_REVIEW_ENABLED ? 'on' : undefined}>
      <head>
        {THEME_REVIEW_ENABLED && <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />}
      </head>
      <body>{children}</body>
    </html>
  )
}
