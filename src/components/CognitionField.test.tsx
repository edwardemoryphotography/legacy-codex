/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CognitionField from './CognitionField'

// jsdom reports a zero-size rect by default; the component intentionally
// bails out on a zero-size rect (nothing to compute proximity against), so
// give the field a plausible size for these tests.
function mockRect() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, width: 200, height: 64, top: 0, left: 0, right: 200, bottom: 64, toJSON: () => {},
  })
}

function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
}

describe('CognitionField', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the core/ring/specks structure as a decorative, hidden field', () => {
    setReducedMotion(false)
    const { container } = render(<CognitionField />)
    const field = container.querySelector('.sd-field')
    expect(field?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.sd-field-core')).toBeTruthy()
    expect(container.querySelector('.sd-field-ring')).toBeTruthy()
    expect(container.querySelector('.sd-field-specks')).toBeTruthy()
  })

  it('reports pointer proximity via CSS custom properties, never React state, on pointer move', async () => {
    setReducedMotion(false)
    mockRect()
    const { container } = render(<CognitionField />)
    const field = container.querySelector('.sd-field') as HTMLDivElement

    field.dispatchEvent(new PointerEvent('pointermove', {
      pointerType: 'mouse', clientX: 100, clientY: 32, bubbles: true,
    }))
    await new Promise(resolve => requestAnimationFrame(resolve))

    expect(field.style.getPropertyValue('--px')).toBe('0.500')
    expect(field.style.getPropertyValue('--py')).toBe('0.500')
    expect(Number(field.style.getPropertyValue('--proximity'))).toBeGreaterThan(0)

    field.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
    expect(field.style.getPropertyValue('--proximity')).toBe('0')
  })

  it('ignores touch pointer moves — proximity stays a desktop/hover-shaped effect', async () => {
    setReducedMotion(false)
    mockRect()
    const { container } = render(<CognitionField />)
    const field = container.querySelector('.sd-field') as HTMLDivElement

    field.dispatchEvent(new PointerEvent('pointermove', {
      pointerType: 'touch', clientX: 100, clientY: 32, bubbles: true,
    }))
    await new Promise(resolve => requestAnimationFrame(resolve))

    expect(field.style.getPropertyValue('--px')).toBe('')
  })

  it('fires a one-shot tap ripple on pointerdown, for touch and mouse alike', () => {
    setReducedMotion(false)
    mockRect()
    const { container } = render(<CognitionField />)
    const field = container.querySelector('.sd-field') as HTMLDivElement

    field.dispatchEvent(new PointerEvent('pointerdown', {
      pointerType: 'touch', clientX: 50, clientY: 16, bubbles: true,
    }))

    expect(field.classList.contains('sd-field-tap')).toBe(true)
    expect(field.style.getPropertyValue('--tap-x')).toBe('0.250')
  })

  it('does not wire up pointer interaction when reduced motion is requested', async () => {
    setReducedMotion(true)
    mockRect()
    const { container } = render(<CognitionField />)
    const field = container.querySelector('.sd-field') as HTMLDivElement

    field.dispatchEvent(new PointerEvent('pointermove', {
      pointerType: 'mouse', clientX: 100, clientY: 32, bubbles: true,
    }))
    await new Promise(resolve => requestAnimationFrame(resolve))

    expect(field.style.getPropertyValue('--px')).toBe('')
    expect(field.style.getPropertyValue('--proximity')).toBe('')
  })
})
