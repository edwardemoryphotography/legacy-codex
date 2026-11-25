import { ACCEPTED_FILE_SUMMARY, formatFileSize, MAX_ATTACH_BYTES } from './missionFiles'

export type AttachmentKind = 'image' | 'pdf' | 'text'

export interface StagedAttachment {
  id: string
  file: File
  originalName: string
  originalSize: number
  kind: AttachmentKind
  previewUrl: string | null
  transformNote: string | null
}

export interface PrepareAttachmentsResult {
  added: StagedAttachment[]
  errors: string[]
}

export interface ImageTransformDeps {
  transcodeImage?: (file: File, maxDimension: number, quality: number) => Promise<Blob | null>
  createPreviewUrl?: (file: File) => string | null
}

export const MAX_ATTACH_COUNT = 8
const IMAGE_OPTIMIZE_TRIGGER_BYTES = 1_500_000

const DIRECT_IMAGE_MIMES = new Map<string, string>([
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/png', 'image/png'],
  ['image/gif', 'image/gif'],
  ['image/webp', 'image/webp'],
])

const IMAGE_EXT_TO_MIME = new Map<string, string>([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
])

const HEIC_MIMES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.csv', '.json']

function extensionOf(name: string): string {
  const lower = name.toLowerCase().trim()
  const dot = lower.lastIndexOf('.')
  return dot >= 0 ? lower.slice(dot) : ''
}

export function classifyAttachment(file: File): { kind: AttachmentKind; mime: string; isHeic: boolean } | null {
  const mime = (file.type || '').toLowerCase().trim()
  const ext = extensionOf(file.name)

  if (HEIC_MIMES.has(mime) || ext === '.heic' || ext === '.heif') {
    return { kind: 'image', mime: 'image/heic', isHeic: true }
  }

  if (mime === 'application/pdf' || ext === '.pdf') {
    return { kind: 'pdf', mime: 'application/pdf', isHeic: false }
  }

  const directImage = DIRECT_IMAGE_MIMES.get(mime) ?? IMAGE_EXT_TO_MIME.get(ext)
  if (directImage) {
    return { kind: 'image', mime: directImage, isHeic: false }
  }

  if (mime.startsWith('text/') || mime === 'application/json' || TEXT_EXTENSIONS.includes(ext)) {
    return { kind: 'text', mime: mime || 'text/plain', isHeic: false }
  }

  return null
}

export function attachmentBadgeLabel(file: Pick<File, 'name' | 'type'>, kind: AttachmentKind): string {
  if (kind === 'pdf') return 'PDF'
  if (kind === 'image') return 'IMG'
  const ext = extensionOf(file.name).replace(/^\./, '').toUpperCase()
  if (ext && ext.length <= 5) return ext
  return 'TXT'
}

function replaceExtension(filename: string, nextExt: string): string {
  const trimmed = filename.trim() || 'photo'
  const dot = trimmed.lastIndexOf('.')
  if (dot > 0) return `${trimmed.slice(0, dot)}${nextExt}`
  return `${trimmed}${nextExt}`
}

async function decodeImageInBrowser(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        close: () => bitmap.close?.(),
      }
    } catch {
      // Fall through to HTMLImageElement decoding (e.g. Safari HEIC fallback).
    }
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Image decode failed'))
      element.src = objectUrl
    })
    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height
    if (!width || !height) {
      URL.revokeObjectURL(objectUrl)
      return null
    }
    return {
      width,
      height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      close: () => URL.revokeObjectURL(objectUrl),
    }
  } catch {
    URL.revokeObjectURL(objectUrl)
    return null
  }
}

async function defaultTranscodeImage(file: File, maxDimension: number, quality: number): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  const decoded = await decodeImageInBrowser(file)
  if (!decoded) return null
  try {
    const longest = Math.max(decoded.width, decoded.height)
    const scale = longest > maxDimension ? maxDimension / longest : 1
    const width = Math.max(1, Math.round(decoded.width * scale))
    const height = Math.max(1, Math.round(decoded.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    decoded.draw(ctx, width, height)
    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(result => resolve(result), 'image/jpeg', quality)
    })
    return blob && blob.size > 0 ? blob : null
  } catch {
    return null
  } finally {
    decoded.close()
  }
}

function defaultCreatePreviewUrl(file: File): string | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  try {
    return URL.createObjectURL(file)
  } catch {
    return null
  }
}

export function revokeAttachmentPreview(attachment: Pick<StagedAttachment, 'previewUrl'>): void {
  if (!attachment.previewUrl) return
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try { URL.revokeObjectURL(attachment.previewUrl) } catch { /* ignore */ }
  }
}

async function convertOrOptimizeImage(
  file: File,
  options: { isHeic: boolean; targetMaxBytes: number },
  transcode: (file: File, maxDimension: number, quality: number) => Promise<Blob | null>,
): Promise<{ file: File; transformNote: string } | { error: string }> {
  const attempts: Array<{ maxDimension: number; quality: number }> = [
    { maxDimension: 2048, quality: 0.85 },
    { maxDimension: 1600, quality: 0.74 },
    { maxDimension: 1280, quality: 0.64 },
    { maxDimension: 960, quality: 0.56 },
  ]

  let bestBlob: Blob | null = null
  for (const step of attempts) {
    const blob = await transcode(file, step.maxDimension, step.quality)
    if (!blob) {
      if (options.isHeic && !bestBlob) {
        return {
          error: `“${file.name}” is in HEIC/HEIF format and this browser cannot convert it directly. Convert it to JPEG or PNG, or choose it from Photos (Most Compatible), and try again.`,
        }
      }
      break
    }
    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob
    }
    if (blob.size <= options.targetMaxBytes) {
      bestBlob = blob
      break
    }
  }

  if (!bestBlob) {
    if (options.isHeic) {
      return {
        error: `“${file.name}” is in HEIC/HEIF format and this browser cannot convert it directly. Convert it to JPEG or PNG, or choose it from Photos (Most Compatible), and try again.`,
      }
    }
    return { file, transformNote: '' }
  }

  if (!options.isHeic && bestBlob.size >= file.size) {
    return { file, transformNote: '' }
  }

  const nextName = options.isHeic ? replaceExtension(file.name, '.jpg') : replaceExtension(file.name, '.jpg')
  const converted = new File([bestBlob], nextName, { type: 'image/jpeg', lastModified: file.lastModified })
  const note = options.isHeic
    ? (bestBlob.size < file.size
        ? `Converted from HEIC · ${formatFileSize(file.size)} → ${formatFileSize(converted.size)}`
        : 'Converted from HEIC to JPEG')
    : `Resized from ${formatFileSize(file.size)} to ${formatFileSize(converted.size)}`

  return { file: converted, transformNote: note }
}

let attachmentSeq = 0
function nextAttachmentId(): string {
  attachmentSeq += 1
  return `att-${Date.now()}-${attachmentSeq}`
}

export async function prepareAttachments(
  incoming: FileList | File[],
  existing: StagedAttachment[],
  deps: ImageTransformDeps = {},
): Promise<PrepareAttachmentsResult> {
  const list = Array.from(incoming)
  const added: StagedAttachment[] = []
  const errors: string[] = []
  const transcode = deps.transcodeImage ?? defaultTranscodeImage
  const createPreview = deps.createPreviewUrl ?? defaultCreatePreviewUrl

  let runningCount = existing.length
  let runningBytes = existing.reduce((sum, item) => sum + item.file.size, 0)

  for (const rawFile of list) {
    if (runningCount >= MAX_ATTACH_COUNT) {
      errors.push(`Up to ${MAX_ATTACH_COUNT} files can be attached at once. Remove one before adding “${rawFile.name}”.`)
      continue
    }

    if (rawFile.size === 0) {
      errors.push(`“${rawFile.name}” is empty (0 B) and cannot be analyzed.`)
      continue
    }

    const classified = classifyAttachment(rawFile)
    if (!classified) {
      errors.push(`Unsupported file type: “${rawFile.name}”. Accepted: ${ACCEPTED_FILE_SUMMARY}.`)
      continue
    }

    let finalFile = rawFile
    let transformNote: string | null = null

    const remainingBudget = Math.max(350_000, MAX_ATTACH_BYTES - runningBytes)
    const shouldOptimizeImage =
      classified.kind === 'image' &&
      classified.mime !== 'image/gif' &&
      (classified.isHeic || rawFile.size > IMAGE_OPTIMIZE_TRIGGER_BYTES || runningBytes + rawFile.size > MAX_ATTACH_BYTES)

    if (shouldOptimizeImage) {
      const targetMaxBytes = Math.min(remainingBudget, Math.floor(MAX_ATTACH_BYTES * 0.85))
      const transformed = await convertOrOptimizeImage(rawFile, { isHeic: classified.isHeic, targetMaxBytes }, transcode)
      if ('error' in transformed) {
        errors.push(transformed.error)
        continue
      }
      finalFile = transformed.file
      transformNote = transformed.transformNote || null
    } else if (classified.kind === 'image' && !rawFile.type && classified.mime) {
      // Ensure standard images with missing browser MIME carry an explicit MIME type.
      finalFile = new File([rawFile], rawFile.name, { type: classified.mime, lastModified: rawFile.lastModified })
    }

    const previewUrl = classified.kind === 'image' ? createPreview(finalFile) : null
    added.push({
      id: nextAttachmentId(),
      file: finalFile,
      originalName: rawFile.name,
      originalSize: rawFile.size,
      kind: classified.kind,
      previewUrl,
      transformNote,
    })
    runningCount += 1
    runningBytes += finalFile.size
  }

  return { added, errors }
}

export function buildAttachmentQuestionSummary(
  attachments: Array<Pick<StagedAttachment, 'originalName'>>,
  userQuestion: string,
): string {
  const names = attachments.map(item => item.originalName).join(', ')
  const trimmed = userQuestion.trim()
  const prefix = attachments.length === 1
    ? `Attached temporarily (not stored): ${names}`
    : `Attached temporarily (${attachments.length} files, not stored): ${names}`
  return trimmed ? `${prefix} — ${trimmed}` : prefix
}
