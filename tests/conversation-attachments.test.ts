import { describe, expect, it } from 'vitest'
import { serializeSessionAttachment } from '../src/client/ConversationAttachments.tsx'

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
})
