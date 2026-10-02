import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import OriginTab from './OriginTab'

afterEach(cleanup)

describe('Origin Atlas tab', () => {
  it('opens the architecture map first, with history one tap away', () => {
    render(<OriginTab />)
    expect(screen.getByTitle('Current human-intent loop')).toHaveAttribute(
      'src',
      '/origin/architecture/index.html#lens=frontend~database',
    )
    fireEvent.click(screen.getByRole('tab', { name: 'History' }))
    expect(screen.getByTitle('Legacy Codex origin atlas')).toHaveAttribute('src', '/origin/index.html')
  })
})
