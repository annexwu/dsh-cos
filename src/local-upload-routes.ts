import { createReadStream } from 'node:fs'
import { realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.ts'
import {
  ConfigValidationError,
  buildObjectKey,
  normalizeContentType,
  normalizeStoragePath,
  normalizeObjectName,
} from './cos-config.ts'
import { cosObjectExists, describeCosError, uploadCosObject, type CosCredentials, type UploadStreamControl } from './cos-client.ts'
import { HttpError, assertSafeRequest, readJsonBody, sendError, sendJson } from './http.ts'
import type {
  BrowseLocalUploadRequest,
  BrowseLocalUploadResponse,
  LocalUploadEntry,
  LocalUploadConflictMode,
  StartLocalUploadRequest,
  StartLocalUploadResponse,
} from './protocol.ts'
import { UploadTaskManager } from './upload-tasks.ts'

const API_BROWSE_LOCAL_UPLOAD = '/api/dsh-cos/local-upload/browse'
const API_START_LOCAL_UPLOAD = '/api/dsh-cos/local-upload/start'
const MAX_DIRECTORY_ENTRIES = 1_000
const MAX_SELECTED_ENTRIES = 100
const MAX_LOCAL_CONCURRENT_UPLOADS = 3
const ATTACHMENT_DIRECTORY = '.dsh-cos'

interface SessionRecord {
  header: { cwd?: string }
}

type LocalUploadDependencies = Context

interface LocalUploadServices {
  getConfig(): Config
  getCredentials(): Promise<CosCredentials>
}

interface LocalPathState {
  sessionId: string
  cwd: string
  currentPath: string
  roots: string[]
}

interface SelectedLocalFile {
  sourcePath: string
  relativePath: string
  size: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(value: Record<string, unknown>, key: string, required: boolean): string | undefined {
  const field = value[key]
  if (field === undefined && !required) return undefined
  if (typeof field !== 'string') throw new HttpError(400, 'invalid-request', `${key} 必须是字符串。`)
  return field
}

function stringArrayField(value: Record<string, unknown>, key: string): string[] {
  const field = value[key]
  if (!Array.isArray(field) || field.some(item => typeof item !== 'string')) {
    throw new HttpError(400, 'invalid-request', `${key} 必须是字符串数组。`)
  }
  return field
}

function sessionCwd(ctx: LocalUploadDependencies, rawSessionId: string): { sessionId: string; cwd: string } {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(rawSessionId)) {
    throw new HttpError(400, 'invalid-session-id', '会话标识无效。')
  }
  const sessions = ctx.sessions as unknown as { get(id: string): SessionRecord | undefined }
  const cwd = sessions.get(rawSessionId)?.header.cwd
  if (cwd === undefined || cwd === '') throw new HttpError(404, 'session-not-found', '当前会话不存在或没有工作区。')
  return { sessionId: rawSessionId, cwd }
}

async function availableRoots(cwd: string): Promise<string[]> {
  if (process.platform !== 'win32') return ['/']
  const roots = new Set<string>([parse(resolve(cwd)).root])
  for (let code = 67; code <= 90; code += 1) {
    const root = `${String.fromCharCode(code)}:\\`
    try {
      await realpath(root)
      roots.add(root)
    } catch {}
  }
  return Array.from(roots)
}

function isInsideRoot(root: string, target: string): boolean {
  const relation = relative(resolve(root), resolve(target))
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation))
}

function rootForPath(path: string, roots: string[]): string {
  const root = roots.find(candidate => isInsideRoot(candidate, path))
  if (root === undefined) throw new HttpError(403, 'local-path-denied', '本机路径不在可访问范围内。')
  return root
}

function ensureReadablePath(rawPath: string, roots: string[]): string {
  if (!isAbsolute(rawPath)) throw new HttpError(400, 'invalid-local-path', '本机路径无效。')
  const resolved = resolve(rawPath)
  if (!roots.some(root => isInsideRoot(root, resolved))) {
    throw new HttpError(403, 'local-path-denied', '本机路径不在可访问范围内。')
  }
  return resolved
}

async function resolveExistingPath(rawPath: string, roots: string[]): Promise<string> {
  const allowed = ensureReadablePath(rawPath, roots)
  try {
    const resolved = await realpath(allowed)
    return ensureReadablePath(resolved, roots)
  } catch {
    throw new HttpError(404, 'local-path-not-found', '本机文件或目录不存在。')
  }
}

function pathLabel(path: string): string {
  return path.replace(/\\/g, '/')
}

function isHiddenAttachmentDirectory(name: string): boolean {
  return name === ATTACHMENT_DIRECTORY
}

function entryId(name: string): string {
  return encodeURIComponent(name)
}

function entryName(id: string): string {
  try {
    const name = decodeURIComponent(id)
    if (name === '' || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || /[\u0000-\u001f\u007f]/.test(name)) {
      throw new Error('invalid')
    }
    return name
  } catch {
    throw new HttpError(400, 'invalid-local-entry', '本机文件标识无效。')
  }
}

function parseBrowseRequest(value: unknown): BrowseLocalUploadRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  const action = stringField(value, 'action', true)
  if (action !== 'current' && action !== 'up' && action !== 'enter' && action !== 'root') {
    throw new HttpError(400, 'invalid-browse-action', '本机目录操作无效。')
  }
  return {
    sessionId: stringField(value, 'sessionId', true)!,
    currentPath: stringField(value, 'currentPath', false),
    action,
    name: stringField(value, 'name', false),
    root: stringField(value, 'root', false),
  }
}

function parseStartRequest(value: unknown): StartLocalUploadRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  const conflictMode = stringField(value, 'conflictMode', true)
  if (conflictMode !== 'ask' && conflictMode !== 'overwrite' && conflictMode !== 'skip') {
    throw new HttpError(400, 'invalid-conflict-mode', '同名文件处理方式无效。')
  }
  const itemIds = stringArrayField(value, 'itemIds')
  if (itemIds.length === 0 || itemIds.length > MAX_SELECTED_ENTRIES || new Set(itemIds).size !== itemIds.length) {
    throw new HttpError(400, 'invalid-local-selection', '请选择 1 至 100 个不同的本机文件或文件夹。')
  }
  return {
    sessionId: stringField(value, 'sessionId', true)!,
    currentPath: stringField(value, 'currentPath', true)!,
    itemIds,
    destinationPath: stringField(value, 'destinationPath', false),
    conflictMode,
  }
}

function localError(error: unknown, code: string): unknown {
  if (error instanceof HttpError || error instanceof ConfigValidationError) return error
  return new HttpError(502, code, describeCosError(error))
}

function safeSendError(response: ServerResponse, error: unknown): void {
  if (!response.destroyed && !response.writableEnded) sendError(response, error)
}

async function browseDirectory(state: LocalPathState): Promise<BrowseLocalUploadResponse> {
  const directory = await resolveExistingPath(state.currentPath, state.roots)
  const entries = await import('node:fs/promises').then(({ readdir }) => readdir(directory, { withFileTypes: true }))
  const items: LocalUploadEntry[] = []
  for (const entry of entries) {
    if (isHiddenAttachmentDirectory(entry.name)) continue
    if (!entry.isFile() && !entry.isDirectory()) continue
    try {
      const target = await resolveExistingPath(join(directory, entry.name), state.roots)
      const info = await import('node:fs/promises').then(({ stat }) => stat(target))
      if (!info.isFile() && !info.isDirectory()) continue
      items.push({
        id: entryId(entry.name),
        name: entry.name,
        kind: info.isDirectory() ? 'folder' : 'file',
        size: info.isFile() ? info.size : 0,
        modifiedAt: info.mtime.toISOString(),
      })
    } catch {}
    if (items.length >= MAX_DIRECTORY_ENTRIES) break
  }
  items.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  return {
    ok: true,
    currentPath: pathLabel(directory),
    roots: state.roots.map(pathLabel),
    entries: items,
  }
}

function nextDirectory(state: LocalPathState, input: BrowseLocalUploadRequest): string {
  if (input.action === 'current') return state.currentPath
  if (input.action === 'root') {
    if (input.root === undefined) throw new HttpError(400, 'root-required', '请选择本机根目录。')
    return ensureReadablePath(input.root, state.roots)
  }
  if (input.action === 'up') {
    const parent = dirname(state.currentPath)
    return ensureReadablePath(parent, state.roots)
  }
  if (input.name === undefined) throw new HttpError(400, 'entry-required', '请选择要进入的目录。')
  return join(state.currentPath, entryName(input.name))
}

async function collectFiles(root: string, name: string, roots: string[], output: SelectedLocalFile[], prefix = ''): Promise<void> {
  const sourcePath = await resolveExistingPath(join(root, name), roots)
  const info = await import('node:fs/promises').then(({ stat }) => stat(sourcePath))
  const relativePath = prefix === '' ? name : `${prefix}/${name}`
  if (info.isFile()) {
    output.push({ sourcePath, relativePath, size: info.size })
    return
  }
  if (!info.isDirectory()) return
  const entries = await import('node:fs/promises').then(({ readdir }) => readdir(sourcePath, { withFileTypes: true }))
  for (const entry of entries) {
    if (isHiddenAttachmentDirectory(entry.name)) continue
    if (!entry.isFile() && !entry.isDirectory()) continue
    await collectFiles(sourcePath, entry.name, roots, output, relativePath)
  }
}

async function selectFiles(currentPath: string, roots: string[], itemIds: string[]): Promise<SelectedLocalFile[]> {
  const files: SelectedLocalFile[] = []
  for (const id of itemIds) await collectFiles(currentPath, entryName(id), roots, files)
  if (files.length === 0) throw new HttpError(400, 'empty-local-selection', '所选文件夹中没有可上传的普通文件。')
  return files
}

function contentTypeFor(name: string): string {
  const extension = basename(name).split('.').pop()?.toLowerCase()
  if (extension === 'txt' || extension === 'md' || extension === 'log') return 'text/plain; charset=utf-8'
  if (extension === 'json') return 'application/json'
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'zip') return 'application/zip'
  return 'application/octet-stream'
}

interface LocalTaskSource {
  sourcePath: string
  rootPath: string
}

export function registerLocalUploadRoutes(
  ctx: LocalUploadDependencies,
  services: LocalUploadServices,
  tasks: UploadTaskManager,
): () => void {
  const disposers: Array<() => void> = []
  const localSources = new Map<string, LocalTaskSource>()
  const runningTaskIds = new Set<string>()
  let active = 0
  let disposed = false

  const schedule = () => {
    if (disposed) return
    while (active < MAX_LOCAL_CONCURRENT_UPLOADS && tasks.availableUploadSlots() > 0) {
      const task = tasks.list().find(item => item.source === 'local' && item.status === 'queued' && localSources.has(item.id) && !runningTaskIds.has(item.id))
      if (task === undefined) return
      active += 1
      runningTaskIds.add(task.id)
      void run(task.id).finally(() => {
        active -= 1
        runningTaskIds.delete(task.id)
        schedule()
      })
    }
  }

  const run = async (taskId: string): Promise<void> => {
    try {
      const source = localSources.get(taskId)
      if (source === undefined) return
      const input = tasks.getUploadInput(taskId)
      let control: UploadStreamControl | undefined
      let stream: ReturnType<typeof createReadStream> | undefined
      let cancelled = false
      let paused = false
      tasks.begin(taskId, {
        cancel: () => {
          cancelled = true
          control?.cancel()
          stream?.destroy()
        },
        pause: () => {
          paused = true
          control?.pause()
        },
        resume: () => {
          paused = false
          control?.resume()
        },
      })
      const sourcePath = await resolveExistingPath(source.sourcePath, [source.rootPath])
      const info = await import('node:fs/promises').then(({ stat }) => stat(sourcePath))
      if (!info.isFile() || info.size !== input.task.size) {
        throw new HttpError(409, 'local-file-changed', '本机文件已变更，请重新选择后上传。')
      }
      stream = createReadStream(sourcePath)
      const uploadStream = stream
      if (cancelled) uploadStream.destroy()
      await uploadCosObject({
        config: input.config,
        credentials: await services.getCredentials(),
        key: input.task.key,
        body: uploadStream,
        size: input.task.size,
        contentType: input.contentType,
        onControlReady: (next) => {
          control = next
          if (cancelled) control.cancel()
          else if (paused) control.pause()
        },
        onProgress: bytes => tasks.progress(taskId, bytes),
      })
      tasks.complete(taskId)
    } catch (error) {
      try {
        const task = tasks.get(taskId)
        if (task.status !== 'cancelled') tasks.fail(taskId, error instanceof Error ? error.message : describeCosError(error))
      } catch {}
    }
  }

  const register = (path: string, handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
    disposers.push(ctx.webServer.register({ kind: 'exact', path, handler }))
  }

  tasks.setLocalTaskScheduler(schedule)
  try {
    register(API_BROWSE_LOCAL_UPLOAD, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parseBrowseRequest(await readJsonBody(request))
        const session = sessionCwd(ctx, input.sessionId)
        const roots = await availableRoots(session.cwd)
        const cwd = await resolveExistingPath(session.cwd, roots)
        const currentPath = nextDirectory({
          ...session,
          cwd,
          currentPath: input.currentPath === undefined ? cwd : ensureReadablePath(input.currentPath, roots),
          roots,
        }, input)
        const body = await browseDirectory({ ...session, cwd, currentPath, roots })
        sendJson(response, 200, body)
      } catch (error) {
        safeSendError(response, localError(error, 'browse-local-upload-failed'))
      }
    })

    register(API_START_LOCAL_UPLOAD, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parseStartRequest(await readJsonBody(request))
        const session = sessionCwd(ctx, input.sessionId)
        const roots = await availableRoots(session.cwd)
        const cwd = await resolveExistingPath(session.cwd, roots)
        const currentPath = await resolveExistingPath(input.currentPath, roots)
        const files = await selectFiles(currentPath, roots, input.itemIds)
        const config = services.getConfig()
        const credentials = await services.getCredentials()
        const destinationPath = normalizeStoragePath(input.destinationPath)
        const conflicts: string[] = []
        const plans: Array<{ file: SelectedLocalFile; name: string; path: string; key: string }> = []
        let skipped = 0
        for (const file of files) {
          const segments = file.relativePath.split('/')
          const name = normalizeObjectName(segments.pop()!, '文件名')
          const path = `${destinationPath}${segments.length > 0 ? `${segments.map(segment => normalizeObjectName(segment, '目录名')).join('/')}/` : ''}`
          const key = buildObjectKey(config.prefix, path, name)
          const exists = await cosObjectExists(config, credentials, key)
          if (exists && input.conflictMode === 'ask') {
            conflicts.push(`${path}${name}`)
            continue
          }
          if (exists && input.conflictMode === 'skip') {
            skipped += 1
            continue
          }
          plans.push({ file, name, path, key })
        }
        if (conflicts.length > 0) {
          const body: StartLocalUploadResponse = { ok: true, accepted: 0, skipped: 0, conflicts, tasks: [] }
          sendJson(response, 200, body)
          return
        }
        const tasksToStart = plans.map(({ file, name, path, key }) => {
          const task = tasks.create({
            name,
            path,
            key,
            size: file.size,
            source: 'local',
            contentType: normalizeContentType(contentTypeFor(name)),
            config,
          })
          localSources.set(task.id, { sourcePath: file.sourcePath, rootPath: rootForPath(file.sourcePath, roots) })
          return task
        })
        const body: StartLocalUploadResponse = { ok: true, accepted: tasksToStart.length, skipped, conflicts: [], tasks: tasksToStart }
        sendJson(response, 200, body)
        schedule()
      } catch (error) {
        safeSendError(response, localError(error, 'start-local-upload-failed'))
      }
    })
  } catch (error) {
    tasks.setLocalTaskScheduler(undefined)
    for (const dispose of disposers.reverse()) dispose()
    throw error
  }

  return () => {
    disposed = true
    tasks.setLocalTaskScheduler(undefined)
    for (const dispose of disposers.reverse()) dispose()
  }
}
