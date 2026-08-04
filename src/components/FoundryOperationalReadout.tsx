'use client'

/**
 * Concise Legacy Codex operational readout for Foundry-derived state.
 *
 * Contract: consumers must pass output from Foundry's deriveFoundryState().
 * This component does not re-derive status, does not store a summary, and
 * does not duplicate the routing inbox or Foundry database.
 */

export interface FoundryReadoutState {
  whatMattersNow: string | null
  why: string | null
  currentBlocker: string | null
  nextAction: string | null
  nextActionProvenance: string
  evidenceState: 'none' | 'pending' | 'verified' | 'conflict'
  lastTrustworthyUpdate: string | null
  provenance: string
}

type Props = {
  state?: FoundryReadoutState | null
  unavailableReason?: string | null
}

export default function FoundryOperationalReadout({
  state = null,
  unavailableReason = null,
}: Props) {
  return (
    <section
      aria-label="Foundry operational readout"
      data-testid="foundry-operational-readout"
      data-derived-source="deriveFoundryState"
      style={{
        border: '1px solid var(--line)',
        background: 'rgba(10, 12, 19, 0.38)',
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3
            className="text-base font-black tracking-tight"
            style={{ letterSpacing: '-0.03em' }}
          >
            Foundry operational readout
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-soft)' }}>
            Derived via <code>deriveFoundryState()</code> — never stored, never a
            second routing inbox.
          </p>
        </div>
      </div>

      {!state ? (
        <p
          className="text-sm"
          style={{ color: 'var(--text-soft)', lineHeight: 1.65 }}
          data-testid="foundry-readout-unavailable"
        >
          {unavailableReason ??
            'No Foundry-derived state is available in Legacy Codex. Open Foundry Console → Routing for the live control plane. Owner authentication and deployed routing tables are required; no demonstration records are shown here.'}
        </p>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          {[
            ['What matters now', state.whatMattersNow ?? 'Nothing routed yet'],
            ['Why', state.why ?? '—'],
            ['Blocker', state.currentBlocker ?? 'None'],
            [
              'Next action',
              state.nextAction
                ? `${state.nextAction} (${state.nextActionProvenance})`
                : 'None',
            ],
            ['Evidence state', state.evidenceState],
            [
              'Last trustworthy update',
              state.lastTrustworthyUpdate ?? 'None',
            ],
            ['Provenance', state.provenance],
          ].map(([label, value]) => (
            <div key={label}>
              <dt style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                {label}
              </dt>
              <dd className="mt-1" style={{ color: 'var(--text)', wordBreak: 'break-word' }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
