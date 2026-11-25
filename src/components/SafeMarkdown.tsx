'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Never initiate external network requests from Markdown images inside saved
// notes or model answers; render only their alt text.
const baseComponents: Components = {
  img: ({ alt }) => <span>{alt || '[image]'}</span>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
}

const inlineComponents: Components = {
  ...baseComponents,
  p: ({ children }) => <>{children}</>,
  h1: ({ children }) => <strong>{children}</strong>,
  h2: ({ children }) => <strong>{children}</strong>,
  h3: ({ children }) => <strong>{children}</strong>,
  h4: ({ children }) => <strong>{children}</strong>,
  h5: ({ children }) => <strong>{children}</strong>,
  h6: ({ children }) => <strong>{children}</strong>,
  ul: ({ children }) => <span>{children}</span>,
  ol: ({ children }) => <span>{children}</span>,
  li: ({ children }) => <span>{children} </span>,
  blockquote: ({ children }) => <span>{children}</span>,
}

/** Strips common inline Markdown punctuation for plain-text attributes/buttons
 *  (e.g. aria-label) without mutating any stored record. */
export function stripMarkdownInline(value: string): string {
  return value
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$|[.,!?;:])/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hasMarkdownSyntax(value: string): boolean {
  return /(\*\*|__|`|\[[^\]]+\]\([^)]+\)|^#{1,6}\s|^[-*+]\s|^\d+\.\s|\|.*\|)/m.test(value)
}

/** Presentation-only safe Markdown renderer. Never mutates stored records. */
export default function SafeMarkdown({
  children,
  inline = false,
  className,
}: {
  children: string
  inline?: boolean
  className?: string
}) {
  if (inline) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={inlineComponents}>
        {children}
      </ReactMarkdown>
    )
  }
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={baseComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
