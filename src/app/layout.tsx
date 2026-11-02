import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/instrument-sans/wght.css'
import '@fontsource/instrument-serif/latin-400.css'
import './globals.css'
import './atmosphere.css'
import './control-panel.css'
import './mission-assistance.css'
import './aurora-presence.css'
import '@fontsource-variable/bricolage-grotesque/wght.css'
import '@fontsource-variable/figtree/wght.css'
import './codex-glass.css'
import './lesson-relay.css'
import './immersive.css'
import { THEME_BOOT_SCRIPT } from '@/lib/themeReview'

export const metadata: Metadata = {
  title: 'Legacy Codex',
  description: 'Legacy Codex preserves context, clarifies what matters, and helps choose the next meaningful action.',
  robots: 'noindex, nofollow',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#101113',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The review theme is applied before paint by the script below, so the
    // server-rendered <html> can legitimately differ on data-theme.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
