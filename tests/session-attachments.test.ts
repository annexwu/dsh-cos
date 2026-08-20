import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createSessionAttachmentFolder,
  removeSessionAttachment,
  sanitizeAttachmentName,
  sanitizeSessionId,
  sessionAttachmentDirectory,
  writeAttachmentFileInFolder,
  writeSessionAttachment,
  withCosAttachmentOrigin,
} from '../src/session-attachments.ts'

const roots: string[] = []

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-cos-storage-test-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('session attachment storage', () => {
  it('isolates and streams a local attachment into the session cache', async () => {
    const cwd = await workspace()
    const attachment = await writeSessionAttachment(
      cwd,
      'session-1',
      'report.pdf',
      Readable.from([Buffer.from('contents')]),
      8,
      'local',
    )
    expect(attachment).toMatchObject({ name: 'report.pdf', size: 8, source: 'local', isDirectory: false })
    expect(attachment.path).toBe(join(sessionAttachmentDirectory(cwd, 'session-1'), 'report.pdf'))
    await expect(readFile(attachment.path, 'utf8')).resolves.toBe('contents')
  })

  it('sanitizes traversal-shaped names and keeps session ids directory-safe', () => {
    expect(sanitizeSessionId('session/../../other')).toBe('session_other')
    expect(sanitizeAttachmentName('../secret.txt')).toBe('_secret.txt')
    expect(sanitizeAttachmentName('a/b.txt')).toBe('a_b.txt')
  })

  it('writes selected COS folder contents below one cached directory and removes it recursively', async () => {
    const cwd = await workspace()
    const { root, attachment } = await createSessionAttachmentFolder(cwd, 'session-2', 'analysis')
    await writeAttachmentFileInFolder(root, 'reports/a.txt', Readable.from(['A']), 1)
    await writeAttachmentFileInFolder(root, 'reports/b.txt', Readable.from(['B']), 1)
    await expect(readFile(join(root, 'reports', 'a.txt'), 'utf8')).resolves.toBe('A')
    await removeSessionAttachment(cwd, 'session-2', attachment.path)
    await expect(readFile(join(root, 'reports', 'b.txt'), 'utf8')).rejects.toThrow()
  })

  it('keeps each COS file or directory attached to its original object identity', () => {
    const file = withCosAttachmentOrigin(
      { path: 'D:/workspace/report.pdf', name: 'report.pdf', size: 1, source: 'cos', isDirectory: false },
      'reports-1250000000',
      'ap-shanghai',
      'daily/report.pdf',
    )
    const directory = withCosAttachmentOrigin(
      { path: 'D:/workspace/archive', name: 'archive', size: 2, source: 'cos', isDirectory: true },
      'archive-1250000000',
      'ap-beijing',
      'exports/',
    )

    expect(file.cos).toEqual({ bucket: 'reports-1250000000', region: 'ap-shanghai', key: 'daily/report.pdf' })
    expect(directory.cos).toEqual({ bucket: 'archive-1250000000', region: 'ap-beijing', key: 'exports/' })
  })
})
