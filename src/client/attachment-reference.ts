import type { CosAttachmentOrigin, SessionAttachment } from '../protocol.ts'

const REFERENCE_PREFIX = 'dsh-cos-attachment:v1:'
const MAX_REFERENCE_LENGTH = 64 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCosAttachmentOrigin(value: unknown): value is CosAttachmentOrigin {
  return isRecord(value)
    && typeof value.bucket === 'string'
    && value.bucket !== ''
    && typeof value.region === 'string'
    && value.region !== ''
    && typeof value.key === 'string'
}

function isSessionAttachment(value: unknown): value is SessionAttachment {
  if (!isRecord(value)) return false
  if (typeof value.path !== 'string' || value.path === '') return false
  if (typeof value.name !== 'string' || value.name === '') return false
  if (typeof value.size !== 'number' || !Number.isFinite(value.size) || value.size < 0) return false
  if (value.source !== 'local' && value.source !== 'cos') return false
  if (typeof value.isDirectory !== 'boolean') return false
  if (value.cos !== undefined && !isCosAttachmentOrigin(value.cos)) return false
  return value.source !== 'cos' || isCosAttachmentOrigin(value.cos)
}

export function encodeSessionAttachmentReference(attachment: SessionAttachment): string {
  return `${REFERENCE_PREFIX}${encodeURIComponent(JSON.stringify(attachment))}`
}

export function decodeSessionAttachmentReference(ref: string): SessionAttachment | undefined {
  if (!ref.startsWith(REFERENCE_PREFIX) || ref.length > MAX_REFERENCE_LENGTH) return undefined
  try {
    const attachment: unknown = JSON.parse(decodeURIComponent(ref.slice(REFERENCE_PREFIX.length)))
    return isSessionAttachment(attachment) ? attachment : undefined
  } catch {
    return undefined
  }
}

export function sessionAttachmentPath(ref: string): string {
  return decodeSessionAttachmentReference(ref)?.path ?? ref
}

export function serializeSessionAttachment(attachment: SessionAttachment): string {
  if (attachment.cos === undefined) return attachment.path
  return [
    '[COS 云存储附件]',
    `本地路径：${attachment.path}`,
    `COS URI：cos://${attachment.cos.bucket}/${attachment.cos.key}`,
    `地域：${attachment.cos.region}`,
    '[/COS 云存储附件]',
  ].join('\n')
}

export function serializeSessionAttachmentReference(ref: string): string {
  const attachment = decodeSessionAttachmentReference(ref)
  return attachment === undefined ? ref : serializeSessionAttachment(attachment)
}
