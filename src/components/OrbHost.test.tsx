/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrbHostProvider, OrbSlot, PersistentOrb, useOrbCognition, type OrbCognition } from './OrbHost'

function Publisher(props: OrbCognition) {
  useOrbCognition(props)
  return <OrbSlot />
}

function Harness({ mission, cognition }: { mission: boolean, cognition: OrbCognition }) {
  return (
    <OrbHostProvider placed={mission}>
      <header>
        <PersistentOrb />
      </header>
      {mission ? (
        <section className="sd" data-testid="mission">
          <Publisher {...cognition} />
        </section>
      ) : null}
    </OrbHostProvider>
  )
}

const settled: OrbCognition = { cognition: 'settled', provenance: 'deterministic', recording: false }
const reading: OrbCognition = { cognition: 'reconstructing', provenance: 'insufficient_context', recording: false }

describe('PersistentOrb', () => {
  it('keeps one field, in the mission slot and then in the dock', () => {
    const { rerender } = render(<Harness mission cognition={settled} />)
    const field = document.querySelector('.sd-field')
    expect(document.querySelectorAll('.sd-field')).toHaveLength(1)
    expect(screen.getByTestId('mission').contains(field)).toBe(true)
    expect(document.querySelector('.sd-orb-hero.sd')).toBeNull()
    expect(document.querySelector('.sd-orb-dock')).toBeNull()

    rerender(<Harness mission={false} cognition={settled} />)
    const dock = document.querySelector('.sd-orb-dock')
    expect(document.querySelectorAll('.sd-field')).toHaveLength(1)
    expect(dock?.querySelector('.sd-field')).toBeTruthy()
    expect(dock?.getAttribute('data-cognition')).toBe('settled')
    expect(dock?.getAttribute('data-provenance')).toBe('deterministic')
    expect(screen.queryByTestId('mission')).toBeNull()
  })

  it('settles a read that leaves the screen instead of docking on that read', () => {
    const { rerender } = render(<Harness mission cognition={reading} />)
    rerender(<Harness mission={false} cognition={reading} />)
    const dock = document.querySelector('.sd-orb-dock')
    expect(dock?.getAttribute('data-cognition')).toBe('insufficient')
    expect(dock?.getAttribute('data-recording')).toBeNull()
  })
})
