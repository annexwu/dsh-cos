import { createWriteStream } from 'node:fs'
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { Transform, type Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { ConfigValidationError } from './cos-config.ts'
import type { SessionAttachment } from './protocol.ts'

const ATTACHMENT_DIRECTORY = '.dsh-cos'
const MAX_NAME_BYTES = 240

export function sanitizeSessionId(value: string): string {
  const sessionId = value.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 120)
  if (sessionId === '') throw new ConfigValidationError('会话标识无效。')
  return sessionId
}

export function sanitizeAttachmentName(value: string): string {
  const name = value.trim().replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/]/g, '_').replace(/^\.+/, '')
  if (name === '' || name === '.' || name === '..' || Buffer.byteLength(name, 'utf8') > MAX_NAME_BYTES) {
    throw new ConfigValidationError('附件文件名无效。')
  }
  return name
}

export function sessionAttachmentDirectory(cwd: string, sessionId: string): string {
  return join(cwd, ATTACHMENT_DIRECTORY, sanitizeSessionId(sessionId))
}

function ensureInside(root: string, target: string): string {
  const resolvedRoot = resolve(root)
  const resolvedTarget = resolve(target)
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${sep}`)) {
    throw new ConfigValidationError('附件路径不在当前会话目录内。')
  }
  return resolvedTarget
}

function splitRelativePath(value: string): string[] {
  if (value === '' || value.startsWith('/') || value.includes('\\')) {
    throw new ConfigValidationError('附件相对路径无效。')
  }
  const segments = value.split('/')
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw new ConfigValidationError('附件相对路径无效。')
  }
  return segments.map(sanitizeAttachmentName)
}

async function uniqueFilePath(root: string, rawName: string): Promise<{ name: string; path: string }> {
  const initial = sanitizeAttachmentName(rawName)
  const extensionStart = initial.lastIndexOf('.')
  const stem = extensionStart > 0 ? initial.slice(0, extensionStart) : initial
  const extension = extensionStart > 0 ? initial.slice(extensionStart) : ''
  for (let index = 0; index < 10_000; index += 1) {
    const name = index === 0 ? initial : `${stem} (${index})${extension}`
    const path = ensureInside(root, join(root, name))
    try {
      await stat(path)
    } catch {
      return { name, path }
    }
  }
  throw new ConfigValidationError('同名附件过多，请更换文件名后重试。')
}

async function uniqueDirectory(root: string, rawName: string): Promise<{ name: string; path: string }> {
  const initial = sanitizeAttachmentName(rawName)
  for (let index = 0; index < 10_000; index += 1) {
    const name = index === 0 ? initial : `${initial} (${index})`
    const path = ensureInside(root, join(root, name))
    try {
      await stat(path)
    } catch {
      await mkdir(path, { recursive: false })
      return { name, path }
    }
  }
  throw new ConfigValidationError('同名附件目录过多，请更换目录名后重试。')
}

async function streamToFile(source: Readable, destination: string, expectedSize?: number): Promise<number> {
  const temporary = `${destination}.partial-${Math.random().toString(36).slice(2)}`
  let size = 0
  const counter = new Transform({
    transform(chunk: Buffer | Uint8Array, _encoding, callback) {
      size += chunk.length
      callback(null, chunk)
    },
  })
  try {
    await pipeline(source, counter, createWriteStream(temporary, { flags: 'wx' }))
    if (expectedSize !== undefined && size !== expectedSize) {
      throw new ConfigValidationError('附件内容大小与声明不一致。')
    }
    await rename(temporary, destination)
    return size
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

export async function writeSessionAttachment(
  cwd: string,
  sessionId: string,
  rawName: string,
  source: Readable,
  expectedSize: number | undefined,
  origin: SessionAttachment['source'],
): Promise<SessionAttachment> {
  const root = sessionAttachmentDirectory(cwd, sessionId)
  await mkdir(root, { recursive: true })
  const { name, path } = await uniqueFilePath(root, rawName)
  const size = await streamToFile(source, path, expectedSize)
  return { path, name, size, source: origin, isDirectory: false }
}

export async function createSessionAttachmentFolder(
  cwd: string,
  sessionId: string,
  rawName: string,
): Promise<{ root: string; attachment: SessionAttachment }> {
  const root = sessionAttachmentDirectory(cwd, sessionId)
  await mkdir(root, { recursive: true })
  const { name, path } = await uniqueDirectory(root, rawName)
  return {
    root: path,
    attachment: { path, name, size: 0, source: 'cos', isDirectory: true },
  }
}

export async function writeAttachmentFileInFolder(
  folder: string,
  relativePath: string,
  source: Readable,
  expectedSize?: number,
): Promise<number> {
  const segments = splitRelativePath(relativePath)
  const destination = ensureInside(folder, join(folder, ...segments))
  await mkdir(resolve(destination, '..'), { recursive: true })
  return await streamToFile(source, destination, expectedSize)
}

export async function setAttachmentDirectorySize(attachment: SessionAttachment): Promise<SessionAttachment> {
  if (!attachment.isDirectory) return attachment
  let total = 0
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) total += (await stat(path)).size
    }
  }
  await visit(attachment.path)
  return { ...attachment, size: total }
}

export async function removeSessionAttachment(cwd: string, sessionId: string, attachmentPath: string): Promise<void> {
  const root = sessionAttachmentDirectory(cwd, sessionId)
  const target = ensureInside(root, attachmentPath)
  await rm(target, { force: true, recursive: true })
}

export async function sessionAttachmentFromExisting(
  cwd: string,
  sessionId: string,
  attachmentPath: string,
  source: SessionAttachment['source'],
): Promise<SessionAttachment> {
  const root = sessionAttachmentDirectory(cwd, sessionId)
  const path = ensureInside(root, attachmentPath)
  const info = await stat(path)
  return { path, name: relative(root, path), size: info.size, source, isDirectory: info.isDirectory() }
}
