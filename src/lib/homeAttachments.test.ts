/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import {
  buildAttachmentQuestionSummary,
  classifyAttachment,
  prepareAttachments,
  revokeAttachmentPreview,
} from './homeAttachments'
import { formatFileSize } from './missionFiles'

describe('homeAttachments', () => {
  it('classifies PDF, text, standard images (including empty MIME fallback), and HEIC/HEIF', () => {
    expect(classifyAttachment(new File(['%PDF'], 'brief.pdf', { type: 'application/pdf' }))).toEqual({
      kind: 'pdf', mime: 'application/pdf', isHeic: false,
    })
    expect(classifyAttachment(new File(['# Notes'], 'notes.md', { type: '' }))).toEqual({
      kind: 'text', mime: 'text/plain', isHeic: false,
    })
    expect(classifyAttachment(new File(['img'], 'IMG_001.JPG', { type: '' }))).toEqual({
      kind: 'image', mime: 'image/jpeg', isHeic: false,
    })
    expect(classifyAttachment(new File(['heic'], 'IMG_1234.HEIC', { type: 'image/heic' }))).toEqual({
      kind: 'image', mime: 'image/heic', isHeic: true,
    })
    expect(classifyAttachment(new File(['bin'], 'archive.zip', { type: 'application/zip' }))).toBeNull()
  })

  it('rejects unsupported and empty files explicitly without discarding valid ones', async () => {
    const result = await prepareAttachments(
      [
        new File(['real notes'], 'plan.md', { type: 'text/markdown' }),
        new File([], 'empty.txt', { type: 'text/plain' }),
        new File(['zip'], 'bundle.zip', { type: 'application/zip' }),
      ],
      [],
      { createPreviewUrl: () => null },
    )
    expect(result.added).toHaveLength(1)
    expect(result.added[0].originalName).toBe('plan.md')
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toMatch(/empty/i)
    expect(result.errors[1]).toMatch(/Unsupported file type.*bundle\.zip/i)
  })

  it('converts HEIC photos to JPEG when browser decoding is available and discloses the conversion', async () => {
    const heic = new File([new Uint8Array(400_000)], 'IMG_4021.HEIC', { type: 'image/heic' })
    const transcodeImage = vi.fn(async () => new Blob([new Uint8Array(120_000)], { type: 'image/jpeg' }))
    const createPreviewUrl = vi.fn(() => 'blob:heic-preview')

    const result = await prepareAttachments([heic], [], { transcodeImage, createPreviewUrl })

    expect(result.errors).toEqual([])
    expect(result.added).toHaveLength(1)
    expect(result.added[0].file.name).toBe('IMG_4021.jpg')
    expect(result.added[0].file.type).toBe('image/jpeg')
    expect(result.added[0].originalName).toBe('IMG_4021.HEIC')
    expect(result.added[0].previewUrl).toBe('blob:heic-preview')
    expect(result.added[0].transformNote).toContain('Converted from HEIC')
  })

  it('reports an explicit error for HEIC when the browser cannot decode it (never silent drop or substitution)', async () => {
    const heic = new File([new Uint8Array(200_000)], 'IMG_9999.HEIC', { type: 'image/heic' })
    const result = await prepareAttachments([heic], [], {
      transcodeImage: async () => null,
      createPreviewUrl: () => null,
    })
    expect(result.added).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('IMG_9999.HEIC')
    expect(result.errors[0]).toMatch(/HEIC\/HEIF/)
  })

  it('resizes oversized iPhone JPEG images to stay under the 4 MB budget and discloses size reduction', async () => {
    const largePhoto = new File([new Uint8Array(5 * 1024 * 1024)], 'IMG_5000.jpg', { type: 'image/jpeg' })
    const transcodeImage = vi.fn(async () => new Blob([new Uint8Array(480_000)], { type: 'image/jpeg' }))

    const result = await prepareAttachments([largePhoto], [], {
      transcodeImage,
      createPreviewUrl: () => 'blob:resized-preview',
    })

    expect(result.errors).toEqual([])
    expect(result.added).toHaveLength(1)
    expect(result.added[0].file.size).toBe(480_000)
    expect(result.added[0].transformNote).toMatch(/Resized from 5\.0 MB to 469 KB/)
  })

  it('formats sizes, builds temporary-analysis question summaries, and revokes preview URLs', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(14_336)).toBe('14.0 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
    expect(buildAttachmentQuestionSummary([{ originalName: 'spec.pdf' }], 'Check deadlines')).toBe(
      'Attached temporarily (not stored): spec.pdf — Check deadlines',
    )
    expect(buildAttachmentQuestionSummary([{ originalName: 'a.pdf' }, { originalName: 'b.png' }], '')).toBe(
      'Attached temporarily (2 files, not stored): a.pdf, b.png',
    )
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    revokeAttachmentPreview({ previewUrl: 'blob:test-url' })
    expect(revokeSpy).toHaveBeenCalledWith('blob:test-url')
    revokeSpy.mockRestore()
  })
})
