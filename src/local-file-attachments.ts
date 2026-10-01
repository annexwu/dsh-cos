import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { link, mkdir, open, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { AttachmentError, AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { FileAttachmentRef, SaveFileAttachment, SaveFileStreamAttachment } from '@deepseek-ai/dsh-attachment'

function fileName(value?: string): string {
  const leaf = (value ?? 'file').split(/[\\/]/).pop() ?? ''
  let clean = leaf.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').trim().replace(/[. ]+$/u, '')
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(clean)) clean = `_${clean}`
  let prefix = ''
  for (const character of clean) {
    if (Buffer.byteLength(prefix + character) > 255) break
    prefix += character
  }
  return prefix || 'file'
}

function hashOf(ref: FileAttachmentRef): string {
  const match = /^sha256:([a-f0-9]{64})$/.exec(String(ref.attachmentId))
  if (!match || ref.name !== fileName(ref.name) || !Number.isSafeInteger(ref.bytes) || ref.bytes < 0) {
    throw new AttachmentError('File attachment reference is invalid.', 'INVALID_ATTACHMENT_REF')
  }
  return match[1]
}

export function fileHostPath(root: string, ref: FileAttachmentRef): string {
  const hash = hashOf(ref)
  return join(root, 'files', hash.slice(0, 2), hash, ref.name)
}

async function linkIfAbsent(source: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true })
  try {
    await link(source, destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
}

async function syncPublicationDirectories(root: string, paths: readonly string[]): Promise<void> {
  if (process.platform === 'win32') return
  const boundary = dirname(resolve(root))
  const visited = new Set<string>()
  for (const path of paths) {
    for (let directory = dirname(path); !visited.has(directory); directory = dirname(directory)) {
      visited.add(directory)
      const handle = await open(directory, 'r')
      try { await handle.sync() } finally { await handle.close() }
      if (directory === boundary || dirname(directory) === directory) break
    }
  }
}

export async function saveLocalFileStream(root: string, input: SaveFileStreamAttachment): Promise<FileAttachmentRef> {
  const temporaryDirectory = join(root, 'tmp')
  await mkdir(temporaryDirectory, { recursive: true })
  const temporary = join(temporaryDirectory, randomUUID())
  const file = await open(temporary, 'wx')
  const digest = createHash('sha256')
  let bytes = 0
  try {
    for await (const chunk of input.data) {
      input.signal?.throwIfAborted()
      digest.update(chunk)
      bytes += chunk.byteLength
      await file.writeFile(chunk)
    }
    input.signal?.throwIfAborted()
    await file.sync()
  } catch (error) {
    await file.close()
    await rm(temporary, { force: true })
    throw error
  }
  await file.close()
  const hash = digest.digest('hex')
  const ref: FileAttachmentRef = { attachmentId: AttachmentId(`sha256:${hash}`), name: fileName(input.name), bytes }
  const object = join(root, 'file-objects', hash.slice(0, 2), hash)
  try {
    input.signal?.throwIfAborted()
    await linkIfAbsent(temporary, object)
    const alias = fileHostPath(root, ref)
    await linkIfAbsent(object, alias)
    await syncPublicationDirectories(root, [object, alias])
    input.signal?.throwIfAborted()
    return ref
  } finally {
    await rm(temporary, { force: true })
  }
}

export async function saveLocalFile(root: string, input: SaveFileAttachment): Promise<FileAttachmentRef> {
  return saveLocalFileStream(root, { name: input.name, data: (async function* () { yield input.data })() })
}

export async function* readLocalFileStream(root: string, ref: FileAttachmentRef, signal?: AbortSignal): AsyncIterable<Uint8Array> {
  signal?.throwIfAborted()
  const hash = hashOf(ref)
  const stream = createReadStream(fileHostPath(root, ref), { highWaterMark: 1 << 16, signal })
  const digest = createHash('sha256')
  let bytes = 0
  try {
    for await (const chunk of stream) {
      signal?.throwIfAborted()
      const data = chunk as Buffer
      digest.update(data)
      bytes += data.byteLength
      yield data
    }
  } catch (error) {
    signal?.throwIfAborted()
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new AttachmentError('File attachment object is missing.', 'ATTACHMENT_NOT_FOUND')
    }
    throw error
  } finally {
    stream.destroy()
  }
  if (bytes !== ref.bytes || digest.digest('hex') !== hash) {
    throw new AttachmentError('Stored file attachment failed integrity verification.', 'ATTACHMENT_CORRUPT')
  }
}
