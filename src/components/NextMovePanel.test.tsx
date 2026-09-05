import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { NextMoveContext } from '@/types'
import NextMovePanel from './NextMovePanel'

const unavailable: NextMoveContext = {
  mission: null, missionStatus: 'unavailable', evidence: [], evidenceStatus: 'unavailable',
}
const loading: NextMoveContext = { ...unavailable, missionStatus: 'loading' }

afterEach(cleanup)

describe('NextMovePanel without account data', () => {
  it('can explain the missing context without requiring a typed request', () => {
    render(<NextMovePanel context={unavailable} />)
    fireEvent.click(screen.getByRole('button', { name: 'Find the next move' }))
    expect(screen.getByText('Reconnect to your mission')).toBeTruthy()
    expect(screen.getByText('Uses local rules · no AI request')).toBeTruthy()
  })

  it('discards a result when context changes, keeps the draft, and never revives the old result', () => {
    const { rerender } = render(<NextMovePanel context={unavailable} />)
    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: "I'm on my lunch break" } })
    fireEvent.click(screen.getByRole('button', { name: 'Find the next move' }))
    expect(screen.getByText('Reconnect to your mission')).toBeTruthy()
    rerender(<NextMovePanel context={loading} />)
    expect(screen.queryByText('Reconnect to your mission')).toBeNull()
    expect(input.value).toBe("I'm on my lunch break")
    expect((screen.getByRole('button', { name: 'Find the next move' }) as HTMLButtonElement).disabled).toBe(true)
    rerender(<NextMovePanel context={unavailable} />)
    expect(screen.queryByText('Reconnect to your mission')).toBeNull()
  })

  it('discards the suggestion when the request changes', () => {
    render(<NextMovePanel context={unavailable} />)
    fireEvent.click(screen.getByRole('button', { name: 'Find the next move' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: "I'm on my lunch break" } })
    expect(screen.queryByText('Reconnect to your mission')).toBeNull()
  })
})
