/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { clearNavigationMark, markNavigation, navigationAge, presenceForDomEvent } from './cognitionPresence'

describe('presenceForDomEvent', () => {
  afterEach(() => {
    clearNavigationMark()
    document.body.replaceChildren()
  })

  it('treats text entry as typing and ignores controls that are not text', () => {
    const idea = document.createElement('textarea')
    document.body.appendChild(idea)
    expect(presenceForDomEvent(new InputEvent('input', { bubbles: true }))).toBeNull()

    const typing = new InputEvent('input', { bubbles: true })
    idea.dispatchEvent(typing)
    expect(presenceForDomEvent(typing)).toBe('typing')

    const box = document.createElement('input')
    box.type = 'checkbox'
    const toggle = new InputEvent('input', { bubbles: true })
    box.dispatchEvent(toggle)
    expect(presenceForDomEvent(toggle)).toBeNull()
  })

  it('treats a select change as a mission change', () => {
    const select = document.createElement('select')
    const change = new Event('change')
    Object.defineProperty(change, 'target', { value: select })
    expect(presenceForDomEvent(change)).toBe('mission')
  })

  it('treats a tab or more-sheet click as navigation', () => {
    const tab = document.createElement('button')
    tab.setAttribute('role', 'tab')
    const label = document.createElement('span')
    tab.appendChild(label)
    document.body.appendChild(tab)
    const click = new MouseEvent('click', { bubbles: true })
    label.dispatchEvent(click)
    expect(presenceForDomEvent(click)).toBe('navigating')

    const other = document.createElement('button')
    const ignored = new MouseEvent('click', { bubbles: true })
    other.dispatchEvent(ignored)
    expect(presenceForDomEvent(ignored)).toBeNull()
  })

  it('treats arrow keys on a tab as navigation and ignores them elsewhere', () => {
    const tab = document.createElement('button')
    tab.setAttribute('role', 'tab')
    document.body.appendChild(tab)
    const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    tab.dispatchEvent(arrow)
    expect(presenceForDomEvent(arrow)).toBe('navigating')

    const typed = new KeyboardEvent('keydown', { key: 'a', bubbles: true })
    tab.dispatchEvent(typed)
    expect(presenceForDomEvent(typed)).toBeNull()

    const field = document.createElement('textarea')
    const inField = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    field.dispatchEvent(inField)
    expect(presenceForDomEvent(inField)).toBeNull()
  })

  it('remembers a navigation long enough for the field to remount', () => {
    expect(navigationAge(1_000)).toBeNull()
    markNavigation(1_000)
    expect(navigationAge(1_400)).toBe(400)
    clearNavigationMark()
    expect(navigationAge(1_400)).toBeNull()
  })
})
