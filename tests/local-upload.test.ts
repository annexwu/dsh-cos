import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  sanitizeAttachmentName,
  sanitizeSessionId,
  sessionAttachmentDirectory,
} from '../src/session-attachments.ts'

describe('local upload path boundaries', () => {
  it('keeps session and attachment names safe for the workspace cache', () => {
    expect(sanitizeSessionId('session/../../other')).toBe('session_other')
    expect(sanitizeAttachmentName('../secret.txt')).toBe('_secret.txt')
    expect(sanitizeAttachmentName('a/b.txt')).toBe('a_b.txt')
  })

  it('keeps all attachment files inside the session directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'dsh-cos-upload-'))
    try {
      const directory = sessionAttachmentDirectory(cwd, 'session-1')
      await mkdir(directory, { recursive: true })
      const path = join(directory, sanitizeAttachmentName('../report.txt'))
      await writeFile(path, 'safe')
      expect(await readFile(path, 'utf8')).toBe('safe')
      expect(path.startsWith(directory)).toBe(true)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
