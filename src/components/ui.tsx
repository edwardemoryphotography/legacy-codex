// Shared low-level UI primitives for Legacy Codex
// All components use CSS custom properties (var(--*)) from globals.css

import type { ReactNode, CSSProperties } from 'react'

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
  const borderColor = highlight
    ? `var(--${highlight})`
    : 'var(--line)'

  return (
    <div
      className={className}
      style={{
        background: 'linear-gradient(180deg, var(--surface-soft), var(--surface))',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius)',
        padding: '16px',
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
      style={{ fontSize: '1.05rem', color: 'var(--text)' }}
    >
      {children}
    </h2>
  )
}

export function SectionSubtitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4" style={{ color: 'var(--text-soft)', fontSize: '0.92rem' }}>
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
        fontSize: '0.8rem',
        color: 'var(--text-dim)',
        fontWeight: 700,
        letterSpacing: '0.02em',
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
        borderRadius: 10,
        background: '#0f0f18',
        color: 'var(--text)',
        font: 'inherit',
        padding: '11px 12px',
        minHeight: 44,
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
        borderRadius: 10,
        background: '#0f0f18',
        color: 'var(--text)',
        font: 'inherit',
        padding: '11px 12px',
        minHeight: 140,
        resize: 'vertical',
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
        borderRadius: 10,
        background: '#0f0f18',
        color: 'var(--text)',
        font: 'inherit',
        padding: '11px 12px',
        minHeight: 44,
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
          background: 'var(--teal-soft)',
          color: 'var(--teal)',
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
        borderRadius: 10,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        minHeight: 44,
        padding: '10px 14px',
        opacity: disabled ? 0.5 : 1,
        fontSize: 'inherit',
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
    fail:     { color: 'var(--error)',   border: 'var(--error)',   bg: 'var(--error-soft)' },
    open:     { color: 'var(--amber)',   border: 'var(--amber)',   bg: 'var(--amber-soft)' },
  }
  const c = colors[variant]
  return (
    <span
      style={{
        fontSize: '0.7rem',
        letterSpacing: '0.04em',
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
