// Exercise the real reference UI and its real corpus. No provider, auth,
// mission, or artifact doubles: opening this reference tab never signs in.
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import CodexTab from './CodexTab'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('Goose Cookbook in the Codex reference UI', () => {
  it('finds and opens the North Star from a Goose search with primary-source links', async () => {
    render(<CodexTab />)
    fireEvent.change(screen.getByPlaceholderText('Search codex entries…'), { target: { value: 'goose' } })

    const entries = within(screen.getByRole('navigation', { name: 'Codex sections' }))
      .getAllByRole('button', { name: /North Star — Goose Cookbook/ })
    expect(entries).toHaveLength(1)
    fireEvent.click(entries[0])

    expect(await screen.findByRole('heading', { level: 1, name: 'North Star — Goose Cookbook' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Read the canonical Goose Cookbook' })).toHaveAttribute(
      'href',
      'https://github.com/edwardemoryphotography/codex-system-architecture/blob/main/notion-wiki/docs/GOOSE-COOKBOOK.md',
    )
    expect(screen.getByRole('link', { name: 'Reviewed source revision' })).toHaveAttribute(
      'href',
      'https://github.com/edwardemoryphotography/codex-system-architecture/blob/df5c24c04856bdd31338ab62713d236f7c4542e7/notion-wiki/docs/GOOSE-COOKBOOK.md',
    )
    expect(window.location.hash).toBe('#codex=root.north-star')
  })

  it('restores the source entry when the reference tab receives its saved entry link', async () => {
    window.history.replaceState(null, '', '/#codex=root.north-star')
    render(<CodexTab />)

    expect(await screen.findByRole('heading', { level: 1, name: 'North Star — Goose Cookbook' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'From cookbook to MasterChef' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'The Goose incident' })).toBeVisible()
  })
})
