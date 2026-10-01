import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fileHostPath, readLocalFileStream, saveLocalFile, saveLocalFileStream } from '../src/local-file-attachments.ts'

const directories: string[] = []

async function root(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-cos-files-'))
  directories.push(dir)
  return join(dir, 'attachments', 'v1')
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('DSH 0.2 file attachments with COS image storage', () => {
  it('stores streamed bytes at the compatible local path and reads them back', async () => {
    const directory = await root()
    const data = Buffer.from('hello from COS plugin')
    const ref = await saveLocalFileStream(directory, {
      name: 'C:\\temp\\report.txt',
      data: (async function* () { yield data.subarray(0, 5); yield data.subarray(5) })(),
    })
    expect(ref.name).toBe('report.txt')
    expect(ref.attachmentId).toBe(`sha256:${createHash('sha256').update(data).digest('hex')}`)
    expect(await readFile(fileHostPath(directory, ref))).toEqual(data)
    const chunks: Uint8Array[] = []
    for await (const chunk of readLocalFileStream(directory, ref)) chunks.push(chunk)
    expect(Buffer.concat(chunks)).toEqual(data)
  })

  it('retains distinct filenames for duplicate bytes and rejects corrupted data', async () => {
    const directory = await root()
    const data = Buffer.from('shared bytes')
    const first = await saveLocalFile(directory, { data, name: 'first.txt' })
    const second = await saveLocalFile(directory, { data, name: 'second.txt' })
    expect(second.attachmentId).toBe(first.attachmentId)
    expect(second.name).toBe('second.txt')
    await writeFile(fileHostPath(directory, first), 'changed')
    await expect(async () => {
      for await (const chunk of readLocalFileStream(directory, first)) void chunk
    }).rejects.toThrow('integrity verification')
  })
})
