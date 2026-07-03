// Shared low-level UI primitives for Legacy Codex
// All components use CSS custom properties (var(--*)) from globals.css

import type { ReactNode, CSSProperties } from 'react'

const TONE_STYLES = {
  teal: {
    border: 'var(--teal)',
    color: 'var(--teal)',
    bg: 'var(--teal-soft)',
  },
  amber: {
    border: 'var(--amber)',
    color: 'var(--amber)',
    bg: 'var(--amber-soft)',
  },
  error: {
    border: 'var(--error)',
    color: 'var(--error)',
    bg: 'var(--error-soft)',
  },
  success: {
    border: 'var(--success)',
    color: 'var(--success)',
    bg: 'var(--success-soft)',
  },
  muted: {
    border: 'var(--line-strong)',
    color: 'var(--text-soft)',
    bg: 'var(--surface-soft)',
  },
} as const

/* ─── Card ───────────────────────────────────────────────────── */
export function Card({
  children,
  className = '',
  style,
  highlight,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  highlight?: 'teal' | 'amber' | 'error' | 'success'
}) {
  const borderColor = highlight ? `var(--${highlight})` : 'var(--line)'

  return (
    <div
      className={"card " + className}
      style={{
        background: 'linear-gradient(180deg, rgba(23, 26, 40, 0.98), rgba(14, 16, 24, 0.98))',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--nd-card-padding)',
        boxShadow: '0 18px 50px rgba(0, 0, 0, 0.24)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ─── Section title / subtitle ───────────────────────────────── */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      className="font-bold mb-3 mt-1"
      style={{ fontSize: '1.08rem', color: 'var(--text)', letterSpacing: '0.01em' }}
    >
      {children}
    </h2>
  )
}

export function SectionSubtitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4" style={{ color: 'var(--text-soft)', fontSize: '0.93rem' }}>
      {children}
    </p>
  )
}

/* ─── Label ──────────────────────────────────────────────────── */
export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontSize: '0.78rem',
        color: 'var(--text-dim)',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: '6px',
      }}
    >
      {children}
    </label>
  )
}

/* ─── Input ──────────────────────────────────────────────────── */
export function Input({
  id,
  type = 'text',
  value,
  defaultValue,
  onChange,
  placeholder,
  readOnly,
}: {
  id?: string
  type?: string
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  placeholder?: string
  readOnly?: boolean
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      defaultValue={defaultValue}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        width: '100%',
        border: '1px solid var(--line-strong)',
        borderRadius: 12,
        background: 'rgba(13, 15, 24, 0.94)',
        color: 'var(--text)',
        font: 'inherit',
        padding: '11px 12px',
        minHeight: 44,
        transition: 'border-color 150ms ease, background 150ms ease, box-shadow 150ms ease',
      }}
    />
  )
}

/* ─── Textarea ───────────────────────────────────────────────── */
export function Textarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  id?: string
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        border: '1px solid var(--line-strong)',
        borderRadius: 12,
        background: 'rgba(13, 15, 24, 0.94)',
        color: 'var(--text)',
        font: 'inherit',
        padding: '11px 12px',
        minHeight: 140,
        resize: 'vertical',
        transition: 'border-color 150ms ease, background 150ms ease, box-shadow 150ms ease',
      }}
    />
  )
}

/* ─── Select ─────────────────────────────────────────────────── */
export function Select({
  id,
  value,
  onChange,
  children,
}: {
  id?: string
  value?: string
  onChange?: (v: string) => void
  children: ReactNode
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      style={{
        width: '100%',
        border: '1px solid var(--line-strong)',
        borderRadius: 12,
        background: 'rgba(13, 15, 24, 0.94)',
        color: 'var(--text)',
        font: 'inherit',
        padding: '11px 12px',
        minHeight: 44,
        transition: 'border-color 150ms ease, background 150ms ease, box-shadow 150ms ease',
      }}
    >
      {children}
    </select>
  )
}

/* ─── Action button ──────────────────────────────────────────── */
export function ActionBtn({
  onClick,
  disabled,
  children,
  variant = 'primary',
}: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  variant?: 'primary' | 'secondary'
}) {
  const styles =
    variant === 'primary'
      ? {
          border: '1px solid var(--teal)',
          background: 'linear-gradient(180deg, var(--teal-soft), rgba(40, 224, 187, 0.08))',
          color: 'var(--teal)',
          boxShadow: '0 10px 24px rgba(40, 224, 187, 0.12)',
        }
      : {
          border: '1px solid var(--line-strong)',
          background: 'linear-gradient(180deg, rgba(22, 24, 36, 0.98), rgba(15, 17, 26, 0.98))',
          color: 'var(--text-soft)',
          boxShadow: '0 10px 22px rgba(0, 0, 0, 0.18)',
        }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles,
        borderRadius: 12,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        minHeight: 44,
        padding: '10px 14px',
        opacity: disabled ? 0.5 : 1,
        fontSize: 'inherit',
        transition: 'transform 150ms ease, border-color 150ms ease, background 150ms ease, color 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

/* ─── Compact action button ─────────────────────────────────── */
export function ActionChip({
  onClick,
  disabled,
  children,
  variant = 'secondary',
}: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const styles =
    variant === 'primary'
      ? {
          border: '1px solid var(--teal)',
          background: 'var(--teal-soft)',
          color: 'var(--teal)',
        }
      : variant === 'danger'
      ? {
          border: '1px solid var(--error)',
          background: 'var(--error-soft)',
          color: 'var(--error)',
        }
      : variant === 'ghost'
      ? {
          border: '1px solid var(--line-strong)',
          background: 'transparent',
          color: 'var(--text-dim)',
        }
      : {
          border: '1px solid var(--line-strong)',
          background: 'var(--surface-soft)',
          color: 'var(--text-soft)',
        }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles,
        borderRadius: 999,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        minHeight: 34,
        padding: '7px 11px',
        opacity: disabled ? 0.5 : 1,
        fontSize: '0.78rem',
        letterSpacing: '0.02em',
        transition: 'transform 150ms ease, border-color 150ms ease, background 150ms ease, color 150ms ease, opacity 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

/* ─── Tag ────────────────────────────────────────────────────── */
export function Tag({
  variant,
  children,
}: {
  variant: 'resolved' | 'fail' | 'open'
  children: ReactNode
}) {
  const colors = {
    resolved: { color: 'var(--success)', border: 'var(--success)', bg: 'var(--success-soft)' },
    fail: { color: 'var(--error)', border: 'var(--error)', bg: 'var(--error-soft)' },
    open: { color: 'var(--amber)', border: 'var(--amber)', bg: 'var(--amber-soft)' },
  }
  const c = colors[variant]
  return (
    <span
      style={{
        fontSize: '0.69rem',
        letterSpacing: '0.08em',
        fontWeight: 800,
        padding: '4px 8px',
        borderRadius: 999,
        border: `1px solid ${c.border}`,
        color: c.color,
        background: c.bg,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

/* ─── Badge ──────────────────────────────────────────────────── */
export function Badge({
  tone = 'muted',
  children,
}: {
  tone?: keyof typeof TONE_STYLES
  children: ReactNode
}) {
  const c = TONE_STYLES[tone]
  return (
    <span
      style={{
        fontSize: '0.7rem',
        letterSpacing: '0.09em',
        fontWeight: 800,
        padding: '5px 9px',
        borderRadius: 999,
        border: `1px solid ${c.border}`,
        color: c.color,
        background: c.bg,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

/* ─── Helper line ────────────────────────────────────────────── */
export function HelperLine({
  children,
  variant,
}: {
  children: ReactNode
  variant?: 'error' | 'success'
}) {
  const color =
    variant === 'error'
      ? 'var(--error)'
      : variant === 'success'
      ? 'var(--success)'
      : 'var(--text-dim)'

  return (
    <p style={{ marginTop: '8px', color, fontSize: '0.82rem' }}>
      {children}
    </p>
  )
}
