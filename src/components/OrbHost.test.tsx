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
  it('keeps one field, over the mission slot and then in the dock', () => {
    const { rerender } = render(<Harness mission cognition={settled} />)
    const host = document.querySelector('.sd-orb-host')
    expect(document.querySelectorAll('.sd-field')).toHaveLength(1)
    expect(host?.getAttribute('data-orb')).toBe('hero')
    expect(host?.getAttribute('data-cognition')).toBe('settled')
    // The field is never re-parented into the mission section.
    expect(screen.getByTestId('mission').querySelector('.sd-field')).toBeNull()
    expect(screen.getByTestId('mission').querySelector('.sd-field-slot')).toBeTruthy()

    rerender(<Harness mission={false} cognition={settled} />)
    expect(document.querySelectorAll('.sd-field')).toHaveLength(1)
    expect(host?.getAttribute('data-orb')).toBe('dock')
    expect(host?.getAttribute('data-cognition')).toBe('settled')
    expect(host?.getAttribute('data-provenance')).toBe('deterministic')
    expect(screen.queryByTestId('mission')).toBeNull()
  })

  it('keeps the same field node, under the same parent, across Mission → other tab → Mission', () => {
    const { rerender } = render(<Harness mission cognition={settled} />)
    const field = document.querySelector('.sd-field')
    const parent = field?.parentElement
    expect(field).toBeTruthy()

    rerender(<Harness mission={false} cognition={settled} />)
    expect(document.querySelector('.sd-field')).toBe(field)
    expect(field?.parentElement).toBe(parent)

    rerender(<Harness mission cognition={settled} />)
    expect(document.querySelector('.sd-field')).toBe(field)
    expect(field?.parentElement).toBe(parent)
    expect(document.querySelectorAll('.sd-field')).toHaveLength(1)
  })

  it('settles a read that leaves the screen instead of docking on that read', () => {
    const { rerender } = render(<Harness mission cognition={reading} />)
    rerender(<Harness mission={false} cognition={reading} />)
    const dock = document.querySelector('.sd-orb-host[data-orb="dock"]')
    expect(dock?.getAttribute('data-cognition')).toBe('insufficient')
    expect(dock?.getAttribute('data-recording')).toBeNull()
  })
})
