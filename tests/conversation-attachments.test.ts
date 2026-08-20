import { describe, expect, it } from 'vitest'
import type { SessionAttachment } from '../src/protocol.ts'
import {
  decodeSessionAttachmentReference,
  encodeSessionAttachmentReference,
  serializeSessionAttachment,
  serializeSessionAttachmentReference,
  sessionAttachmentPath,
} from '../src/client/attachment-reference.ts'

describe('conversation attachment serialization', () => {
  it('keeps a local attachment as its workspace path', () => {
    expect(serializeSessionAttachment({
      path: 'D:/workspace/.dsh-cos/session-1/local.txt',
      name: 'local.txt',
      size: 1,
      source: 'local',
      isDirectory: false,
    })).toBe('D:/workspace/.dsh-cos/session-1/local.txt')
  })

  it('round-trips Unicode paths and COS identity in a persistent reference', () => {
    const attachment: SessionAttachment = {
      path: 'D:/工作区/.dsh-cos/session-1/报告.pdf',
      name: '报告.pdf',
      size: 1024,
      source: 'cos',
      isDirectory: false,
      cos: { bucket: 'reports-1250000000', region: 'ap-shanghai', key: '日报/报告.pdf' },
    }
    const ref = encodeSessionAttachmentReference(attachment)

    expect(ref).not.toContain(attachment.path)
    expect(decodeSessionAttachmentReference(ref)).toEqual(attachment)
    expect(sessionAttachmentPath(ref)).toBe(attachment.path)
    expect(serializeSessionAttachmentReference(ref)).toContain('cos://reports-1250000000/日报/报告.pdf')
  })

  it('serializes each COS attachment with its own cloud identity', () => {
    const first = serializeSessionAttachment({
      path: 'D:/workspace/.dsh-cos/session-1/report.pdf',
      name: 'report.pdf',
      size: 1,
      source: 'cos',
      isDirectory: false,
      cos: { bucket: 'reports-1250000000', region: 'ap-shanghai', key: 'daily/report.pdf' },
    })
    const second = serializeSessionAttachment({
      path: 'D:/workspace/.dsh-cos/session-1/archive',
      name: 'archive',
      size: 2,
      source: 'cos',
      isDirectory: true,
      cos: { bucket: 'archive-1250000000', region: 'ap-beijing', key: 'exports/' },
    })

    expect(first).toContain('D:/workspace/.dsh-cos/session-1/report.pdf')
    expect(first).toContain('cos://reports-1250000000/daily/report.pdf')
    expect(first).toContain('地域：ap-shanghai')
    expect(second).toContain('cos://archive-1250000000/exports/')
    expect(second).toContain('地域：ap-beijing')
  })

  it('keeps legacy and malformed references as plain workspace paths', () => {
    const legacy = 'D:/workspace/.dsh-cos/session-1/legacy.txt'
    expect(decodeSessionAttachmentReference(legacy)).toBeUndefined()
    expect(sessionAttachmentPath(legacy)).toBe(legacy)
    expect(serializeSessionAttachmentReference(legacy)).toBe(legacy)
    expect(decodeSessionAttachmentReference('dsh-cos-attachment:v1:%7Bbad')).toBeUndefined()
  })
})
