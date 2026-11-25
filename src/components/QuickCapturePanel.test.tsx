/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import QuickCapturePanel from './QuickCapturePanel'
import type { CaptureItem } from '@/types'
import type { User } from '@supabase/supabase-js'

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }),
      insert: async () => ({ error: null }),
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  },
}))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

afterEach(cleanup)

const markdownNote = [
  '# Audit Summary',
  '',
  '| Signal | Status |',
  '| --- | --- |',
  '| Orb geometry | Verified |',
  '',
  '```ts',
  'const ok = true',
  '```',
].join('\n')

const sampleItem: CaptureItem = {
  id: 'cap-1',
  text: markdownNote,
  timestamp: '2026-11-24T19:00:00Z',
  suggested: 'automation',
}

describe('QuickCapturePanel', () => {
  it('renders Markdown tables/headings/code safely without mutating stored text, supports expanded reader, verbatim edit, and two-step clear confirmation', async () => {
    const onCapture = vi.fn()
    const onUpdate = vi.fn(async () => ({ ok: true, synced: true }))
    const onRemove = vi.fn(async () => ({ ok: true }))
    const onClearAll = vi.fn(async () => ({ ok: true }))

    render(
      <QuickCapturePanel
        user={{ id: 'u1' } as User}
        inbox={[sampleItem]}
        syncedCaptureIds={new Set(['cap-1'])}
        isSyncing={false}
        onCapture={onCapture}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onForceSync={() => {}}
        onForceSyncItem={() => {}}
        onExport={() => {}}
        onClearAll={onClearAll}
        onStatus={() => {}}
      />,
    )

    // Renders Markdown table properly (no raw | --- | --- | separator text).
    expect(screen.getByRole('heading', { name: 'Audit Summary' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByText(/\| --- \|/)).toBeNull()

    // Multiline composer captures Markdown verbatim.
    const composer = screen.getByLabelText('Quick capture note')
    fireEvent.change(composer, { target: { value: 'Line 1\nLine 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Capture' }))
    expect(onCapture).toHaveBeenCalledWith('Line 1\nLine 2')

    // Expanded document reader opens with verbatim edit support.
    fireEvent.click(screen.getByRole('button', { name: 'Read full note' }))
    const dialog = screen.getByRole('dialog', { name: 'Captured document' })
    expect(within(dialog).getByRole('table')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit' }))
    const editor = within(dialog).getByLabelText(/Original captured text/i)
    expect(editor).toHaveValue(markdownNote)
    fireEvent.change(editor, { target: { value: markdownNote + '\nUpdated line' } })
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    })
    expect(onUpdate).toHaveBeenCalledWith('cap-1', markdownNote + '\nUpdated line')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close capture' }))

    // Secondary administrative controls require explicit confirmation for Clear all.
    fireEvent.click(screen.getByText('Manage inbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onClearAll).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm clear all' }))
    })
    expect(onClearAll).toHaveBeenCalledOnce()
  })
})
