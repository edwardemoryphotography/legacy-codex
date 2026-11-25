/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  attachmentAnalysisLabel, attachmentInstruction, attachmentQuestion, attachmentRejection,
  convertImageForAnalysis, formatBytes, MAX_ATTACH_BYTES, prepareAttachments, removeAttachment,
} from './homeAttachments'

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:preview' })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} })
  HTMLCanvasElement.prototype.getContext = (() => ({ drawImage: () => {} })) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
    callback(new Blob([new Uint8Array(128)], { type: 'image/jpeg' }))
  }
})

afterEach(() => { delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap })

function bitmap(width = 800, height = 600) {
  return { width, height, close: () => {} }
}

describe('attachment validation', () => {
  it('formats sizes without inventing precision', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })

  it('refuses unsupported and empty files explicitly', () => {
    expect(attachmentRejection(new File(['x'], 'archive.zip', { type: 'application/zip' }))).toContain('Unsupported file type')
    expect(attachmentRejection(new File([], 'empty.txt', { type: 'text/plain' }))).toContain('empty')
    expect(attachmentRejection(new File(['x'], 'notes.txt', { type: 'text/plain' }))).toBeNull()
    expect(attachmentRejection(new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' }))).toBeNull()
  })
})

describe('phone photo conversion', () => {
  it('converts a decodable HEIC to JPEG and states the conversion', async () => {
    globalThis.createImageBitmap = (async () => bitmap()) as unknown as typeof createImageBitmap
    const heic = new File([new Uint8Array(4096)], 'IMG_0001.HEIC', { type: 'image/heic' })
    const result = await convertImageForAnalysis(heic)
    expect(result.file.type).toBe('image/jpeg')
    expect(result.file.name).toBe('IMG_0001.jpg')
    expect(result.convertedFrom).toBe('image/heic')
  })

  it('refuses an unreadable conversion instead of substituting content', async () => {
    globalThis.createImageBitmap = (async () => null) as unknown as typeof createImageBitmap
    const heic = new File([new Uint8Array(4096)], 'IMG_0002.HEIC', { type: 'image/heic' })
    await expect(convertImageForAnalysis(heic)).rejects.toThrow(/Could not read IMG_0002\.HEIC/)
  })
})

describe('combined request budget', () => {
  it('refuses a selection beyond the 4 MB analysis limit with a reason', async () => {
    globalThis.createImageBitmap = (async () => bitmap()) as unknown as typeof createImageBitmap
    const big = new File([new Uint8Array(MAX_ATTACH_BYTES + 1)], 'huge.pdf', { type: 'application/pdf' })
    const result = await prepareAttachments([big])
    expect(result.attachments).toEqual([])
    expect(result.errors.join(' ')).toMatch(/4 MB even after compression/)
  })

  it('keeps supported files together under the limit', async () => {
    const result = await prepareAttachments([
      new File(['hello'], 'a.txt', { type: 'text/plain' }),
      new File(['{"a":1}'], 'b.json', { type: 'application/json' }),
    ])
    expect(result.errors).toEqual([])
    expect(result.attachments.map(item => item.name)).toEqual(['a.txt', 'b.json'])
  })
})

describe('analysis framing', () => {
  it('treats file contents as untrusted and bounds the instruction', () => {
    const instruction = attachmentInstruction('x'.repeat(900), ['a.pdf'])
    expect(instruction.length).toBeLessThanOrEqual(400)
    expect(instruction).toContain('untrusted artifact content')
    expect(instruction).toContain('a.pdf')
    expect(attachmentInstruction('', ['a.pdf'])).toContain('Analyse this attachment')
  })

  it('labels analysis as temporary and not stored, including conversions', () => {
    expect(attachmentAnalysisLabel(['scan.pdf'])).toMatch(/Temporary analysis of scan\.pdf — file not stored/)
    expect(attachmentAnalysisLabel(['a.jpg'], ['IMG.HEIC → JPEG'])).toContain('Converted for analysis: IMG.HEIC → JPEG')
    expect(attachmentQuestion('', ['scan.pdf'])).toBe('What matters in scan.pdf?')
  })

  it('revokes the preview object URL when removed', () => {
    let revoked: string | null = null
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: (url: string) => { revoked = url } })
    const attachments = [{
      id: 'one', file: new File(['x'], 'x.png', { type: 'image/png' }), name: 'x.png', size: 1,
      previewUrl: 'blob:one',
    }]
    expect(removeAttachment(attachments, 'one')).toEqual([])
    expect(revoked).toBe('blob:one')
  })
})
