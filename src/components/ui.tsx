// Shared low-level UI primitives for Legacy Codex
// All components use CSS custom properties (var(--*)) from globals.css

import type { ReactNode, CSSProperties, Ref } from 'react'

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
        background: 'var(--card-bg)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--nd-card-padding)',
        boxShadow: 'var(--card-lift)',
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
  name,
  type = 'text',
  value,
  defaultValue,
  onChange,
  placeholder,
  readOnly,
  disabled,
  required,
  autoComplete,
  enterKeyHint,
  className,
}: {
  id?: string
  name?: string
  type?: string
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  disabled?: boolean
  required?: boolean
  autoComplete?: string
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
  className?: string
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      defaultValue={defaultValue}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={disabled}
      required={required}
      autoComplete={autoComplete}
      enterKeyHint={enterKeyHint}
      className={className}
      style={{
        width: '100%',
        border: '1px solid var(--line-strong)',
        borderRadius: 12,
        background: 'var(--field-bg)',
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
  name,
  value,
  onChange,
  placeholder,
  rows = 6,
  compact = false,
  required,
  autoComplete,
  className,
  textareaRef,
}: {
  id?: string
  name?: string
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  rows?: number
  compact?: boolean
  required?: boolean
  autoComplete?: string
  className?: string
  textareaRef?: Ref<HTMLTextAreaElement>
}) {
  return (
    <textarea
      id={id}
      name={name}
      ref={textareaRef}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      required={required}
      autoComplete={autoComplete}
      className={className}
      style={{
        width: '100%',
        border: '1px solid var(--line-strong)',
        borderRadius: 12,
        background: 'var(--field-bg)',
        color: 'var(--text)',
        font: 'inherit',
        padding: '11px 12px',
        minHeight: compact ? 88 : 140,
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
        background: 'var(--field-bg)',
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
  type = 'button',
  'aria-expanded': ariaExpanded,
  'aria-controls': ariaControls,
  'aria-label': ariaLabel,
}: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  variant?: 'primary' | 'secondary'
  type?: 'button' | 'submit'
  'aria-expanded'?: boolean
  'aria-controls'?: string
  /** Must start with the visible label (WCAG 2.5.3, label in name). */
  'aria-label'?: string
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
          background: 'var(--control-bg)',
          color: 'var(--text-soft)',
          boxShadow: 'var(--control-lift)',
        }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-label={ariaLabel}
      className="interactive-control"
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
  className = '',
  title,
  'aria-expanded': ariaExpanded,
  'aria-controls': ariaControls,
}: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
  title?: string
  'aria-expanded'?: boolean
  'aria-controls'?: string
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
      title={title}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      className={'interactive-control ' + className}
      style={{
        ...styles,
        borderRadius: 999,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        minHeight: 44,
        padding: '9px 12px',
        opacity: disabled ? 0.5 : 1,
        fontSize: '0.8rem',
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
  wrap = false,
  children,
}: {
  tone?: keyof typeof TONE_STYLES
  wrap?: boolean
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
        whiteSpace: wrap ? 'normal' : 'nowrap',
        maxWidth: wrap ? '100%' : undefined,
        overflowWrap: wrap ? 'anywhere' : undefined,
        textAlign: wrap ? 'center' : undefined,
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
