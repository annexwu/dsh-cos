import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.ts'
import {
  ConfigValidationError,
  buildObjectKey,
  normalizeContentType,
  normalizeStoragePath,
  normalizeObjectKey,
  normalizeObjectName,
  normalizeUploadSize,
} from './cos-config.ts'
import {
  cosFolderExists,
  cosObjectExists,
  createCosFolder,
  deleteCosObject,
  describeCosError,
  getCosDownloadStream,
  getCosObjectUrl,
  probeCosDocumentPreview,
  readCosObjectText,
  uploadCosObject,
  type CosCredentials,
  type UploadStreamControl,
} from './cos-client.ts'
import { HttpError, assertSafeRequest, readJsonBody, sendError, sendJson } from './http.ts'
import type {
  CosObjectActionRequest,
  CosObjectPreviewRequest,
  CosObjectPreviewResponse,
  CosObjectUrlResponse,
  CosUploadCompleteResponse,
  CosUploadTaskActionRequest,
  CosUploadTaskActionResponse,
  CosUploadTaskListResponse,
  CreateCosFolderRequest,
  CreateCosFolderResponse,
  CreateCosUploadTaskRequest,
  CreateCosUploadTaskResponse,
  DeleteCosObjectResponse,
} from './protocol.ts'
import { UploadTaskManager } from './upload-tasks.ts'
import { isCiDocumentPreviewExtension } from './preview-policy.ts'

const API_CREATE_FOLDER = '/api/dsh-cos/objects/folder'
const API_DOWNLOAD_OBJECT = '/api/dsh-cos/objects/download'
const API_OBJECT_URL = '/api/dsh-cos/objects/url'
const API_OBJECT_PREVIEW = '/api/dsh-cos/objects/preview'
const PREVIEW_URL_EXPIRES_SECONDS = 900
const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024
const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'webp'])
const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'ogv', 'webm'])
const AUDIO_EXTENSIONS = new Set(['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'opus', 'wav'])
const TEXT_EXTENSIONS = new Set([
  'bat', 'c', 'cc', 'cfg', 'conf', 'cpp', 'cs', 'css', 'env', 'go', 'h', 'hpp', 'html', 'ini', 'java', 'js', 'json',
  'jsx', 'log', 'md', 'mjs', 'properties', 'py', 'rb', 'rs', 'sh', 'sql', 'text', 'toml', 'ts', 'tsx', 'txt', 'vue',
  'xml', 'yaml', 'yml',
])
const API_DELETE_OBJECT = '/api/dsh-cos/objects/delete'
const API_CREATE_UPLOAD = '/api/dsh-cos/uploads/create'
const API_UPLOAD_CONTENT = '/api/dsh-cos/uploads/content'
const API_LIST_UPLOADS = '/api/dsh-cos/uploads/list'
const API_PAUSE_UPLOAD = '/api/dsh-cos/uploads/pause'
const API_RESUME_UPLOAD = '/api/dsh-cos/uploads/resume'
const API_CANCEL_UPLOAD = '/api/dsh-cos/uploads/cancel'
const API_RETRY_UPLOAD = '/api/dsh-cos/uploads/retry'
const API_REMOVE_UPLOAD = '/api/dsh-cos/uploads/remove'
const API_CLEAR_UPLOADS = '/api/dsh-cos/uploads/clear-completed'

interface OperationDependencies extends Context {
  webServer: Context['webServer']
}

interface OperationServices {
  getConfig(): Config
  getCredentials(): Promise<CosCredentials>
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

function numberField(value: Record<string, unknown>, key: string): number {
  const field = value[key]
  if (typeof field !== 'number') throw new HttpError(400, 'invalid-request', `${key} 必须是数字。`)
  return field
}

function booleanField(value: Record<string, unknown>, key: string): boolean | undefined {
  const field = value[key]
  if (field === undefined) return undefined
  if (typeof field !== 'boolean') throw new HttpError(400, 'invalid-request', `${key} 必须是布尔值。`)
  return field
}

function optionalNumberField(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key]
  if (field === undefined) return undefined
  if (typeof field !== 'number') throw new HttpError(400, 'invalid-request', `${key} 必须是数字。`)
  return field
}

function parseFolderRequest(value: unknown): CreateCosFolderRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  return {
    path: stringField(value, 'path', false),
    name: stringField(value, 'name', true)!,
  }
}

function parseCreateUploadRequest(value: unknown): CreateCosUploadTaskRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  return {
    path: stringField(value, 'path', false),
    name: stringField(value, 'name', true)!,
    size: numberField(value, 'size'),
    contentType: stringField(value, 'contentType', false),
    overwrite: booleanField(value, 'overwrite'),
  }
}

function fileExtension(key: string): string {
  const name = key.split('/').filter(Boolean).pop() ?? ''
  const index = name.lastIndexOf('.')
  return index <= 0 || index === name.length - 1 ? '' : name.slice(index + 1).toLowerCase()
}

function parsePreviewRequest(value: unknown): CosObjectPreviewRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  if (stringField(value, 'kind', true) !== 'file') throw new HttpError(400, 'file-required', '只有文件可以预览。')
  return { kind: 'file', key: stringField(value, 'key', true)! }
}

function parseObjectAction(value: unknown): CosObjectActionRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  const kind = stringField(value, 'kind', true)
  if (kind !== 'folder' && kind !== 'file') throw new HttpError(400, 'invalid-object-kind', '对象类型无效。')
  const domain = stringField(value, 'domain', false)
  if (domain !== undefined && domain !== 'default' && domain !== 'custom') {
    throw new HttpError(400, 'invalid-link-domain', '链接域名选项无效。')
  }
  return {
    kind,
    key: stringField(value, 'key', true)!,
    download: booleanField(value, 'download'),
    expiresSeconds: optionalNumberField(value, 'expiresSeconds'),
    ...(domain === undefined ? {} : { domain }),
  }
}

function parseTaskAction(value: unknown): CosUploadTaskActionRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  const taskId = stringField(value, 'taskId', true)!
  if (taskId.length > 128) throw new HttpError(400, 'invalid-task-id', '任务 ID 无效。')
  return { taskId }
}

function taskIdFromUrl(request: IncomingMessage): string {
  let taskId: string | null
  try {
    taskId = new URL(request.url ?? '', 'http://localhost').searchParams.get('taskId')
  } catch {
    throw new HttpError(400, 'invalid-task-id', '任务 ID 无效。')
  }
  if (!taskId || taskId.length > 128) throw new HttpError(400, 'invalid-task-id', '任务 ID 无效。')
  return taskId
}

function assertUploadLength(request: IncomingMessage, expected: number): void {
  const value = request.headers['content-length']
  if (value === undefined || !/^\d+$/.test(value) || Number(value) !== expected) {
    throw new HttpError(400, 'invalid-content-length', '上传内容大小与任务不一致。')
  }
}

function safeSendError(response: ServerResponse, error: unknown): void {
  if (!response.destroyed && !response.writableEnded) sendError(response, error)
}

function describeUploadError(error: unknown): string {
  if (error instanceof HttpError || error instanceof ConfigValidationError) return error.message
  return describeCosError(error)
}

function operationError(error: unknown, code: string): unknown {
  if (error instanceof HttpError || error instanceof ConfigValidationError) return error
  return new HttpError(502, code, describeCosError(error))
}

export function registerOperationRoutes(
  ctx: OperationDependencies,
  services: OperationServices,
  tasks = new UploadTaskManager(),
): () => void {
  const disposers: Array<() => void> = []
  const register = (path: string, handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
    disposers.push(ctx.webServer.register({ kind: 'exact', path, handler }))
  }

  try {
    register(API_CREATE_FOLDER, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parseFolderRequest(await readJsonBody(request))
        const config = services.getConfig()
        const credentials = await services.getCredentials()
        const path = normalizeStoragePath(input.path)
        const name = normalizeObjectName(input.name, '文件夹名称')
        const key = buildObjectKey(config.prefix, path, name, true)
        if (await cosFolderExists(config, credentials, key)) {
          throw new HttpError(409, 'folder-exists', '当前目录已存在同名文件夹。')
        }
        await createCosFolder(config, credentials, key)
        const body: CreateCosFolderResponse = { ok: true, name, key, path: `${path}${name}/` }
        sendJson(response, 200, body)
      } catch (error) {
        safeSendError(response, operationError(error, 'create-folder-failed'))
      }
    })

    register(API_DOWNLOAD_OBJECT, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parseObjectAction(await readJsonBody(request))
        if (input.kind !== 'file') throw new HttpError(400, 'file-required', '只有文件可以下载。')
        const config = services.getConfig()
        const key = normalizeObjectKey(input.key, config.prefix, input.kind)
        const credentials = await services.getCredentials()
        const download = await getCosDownloadStream(config, credentials, key)
        const name = key.split('/').filter(Boolean).pop() || 'download'
        response.statusCode = 200
        response.setHeader('Content-Type', 'application/octet-stream')
        response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`)
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('X-Content-Type-Options', 'nosniff')
        if (download.contentLength !== undefined) response.setHeader('Content-Length', String(download.contentLength))
        download.stream.once('error', (streamError) => {
          if (!response.headersSent) safeSendError(response, operationError(streamError, 'download-failed'))
          else response.destroy(streamError as Error)
        })
        download.stream.pipe(response)
      } catch (error) {
        safeSendError(response, operationError(error, 'download-failed'))
      }
    })

    register(API_OBJECT_PREVIEW, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parsePreviewRequest(await readJsonBody(request))
        const config = services.getConfig()
        const key = normalizeObjectKey(input.key, config.prefix, input.kind)
        const extension = fileExtension(key)
        const credentials = await services.getCredentials()
        if (TEXT_EXTENSIONS.has(extension)) {
          const text = await readCosObjectText(config, credentials, key, MAX_TEXT_PREVIEW_BYTES)
          const body: CosObjectPreviewResponse = { ok: true, kind: 'text', text }
          sendJson(response, 200, body)
          return
        }
        if (IMAGE_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension) || AUDIO_EXTENSIONS.has(extension)) {
          const kind = IMAGE_EXTENSIONS.has(extension) ? 'image' : VIDEO_EXTENSIONS.has(extension) ? 'video' : 'audio'
          const url = await getCosObjectUrl(config, credentials, key, false, PREVIEW_URL_EXPIRES_SECONDS)
          const body: CosObjectPreviewResponse = { ok: true, kind, url }
          sendJson(response, 200, body)
          return
        }
        if (isCiDocumentPreviewExtension(extension)) {
          const url = await getCosObjectUrl(config, credentials, key, false, PREVIEW_URL_EXPIRES_SECONDS, undefined, {
            'ci-process': 'doc-preview',
            dstType: 'html',
          })
          const status = await probeCosDocumentPreview(url)
          if (status !== 'available') {
            const body: CosObjectPreviewResponse = {
              ok: true,
              kind: 'ci-unavailable',
              message: status === 'not-enabled'
                ? '文档预览服务尚未开通。'
                : '文档预览服务当前不可用。',
            }
            sendJson(response, 200, body)
            return
          }
          const body: CosObjectPreviewResponse = { ok: true, kind: 'ci-document', url }
          sendJson(response, 200, body)
          return
        }
        const body: CosObjectPreviewResponse = {
          ok: true,
          kind: 'unsupported',
          message: '此文件类型暂不支持预览，可下载后在本地查看。',
        }
        sendJson(response, 200, body)
      } catch (error) {
        safeSendError(response, operationError(error, 'object-preview-failed'))
      }
    })

    register(API_OBJECT_URL, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parseObjectAction(await readJsonBody(request))
        if (input.kind !== 'file') throw new HttpError(400, 'file-required', '只有文件可以生成访问链接。')
        const config = services.getConfig()
        const key = normalizeObjectKey(input.key, config.prefix, input.kind)
        const expiresSeconds = input.expiresSeconds ?? 3600
        if (!Number.isSafeInteger(expiresSeconds) || ![300, 1800, 3600, 86400, 604800].includes(expiresSeconds)) {
          throw new HttpError(400, 'invalid-link-expiry', '临时链接有效时长无效。')
        }
        const domain = input.domain ?? 'default'
        if (domain === 'custom' && config.customDomain === '') {
          throw new HttpError(400, 'custom-domain-unavailable', '尚未配置自定义域名。')
        }
        const credentials = await services.getCredentials()
        const url = await getCosObjectUrl(
          config,
          credentials,
          key,
          input.download === true,
          expiresSeconds,
          domain === 'custom' ? config.customDomain : undefined,
        )
        const body: CosObjectUrlResponse = {
          ok: true,
          url,
          expiresAt: new Date(Date.now() + expiresSeconds * 1000).toISOString(),
        }
        sendJson(response, 200, body)
      } catch (error) {
        safeSendError(response, operationError(error, 'object-url-failed'))
      }
    })

    register(API_DELETE_OBJECT, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parseObjectAction(await readJsonBody(request))
        const config = services.getConfig()
        const key = normalizeObjectKey(input.key, config.prefix, input.kind)
        const credentials = await services.getCredentials()
        const deleted = await deleteCosObject(config, credentials, key, input.kind)
        const body: DeleteCosObjectResponse = { ok: true, deleted }
        sendJson(response, 200, body)
      } catch (error) {
        safeSendError(response, operationError(error, 'delete-object-failed'))
      }
    })

    register(API_CREATE_UPLOAD, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parseCreateUploadRequest(await readJsonBody(request))
        const config = services.getConfig()
        const credentials = await services.getCredentials()
        const path = normalizeStoragePath(input.path)
        const name = normalizeObjectName(input.name, '文件名')
        const size = normalizeUploadSize(input.size)
        const contentType = normalizeContentType(input.contentType)
        const key = buildObjectKey(config.prefix, path, name)
        if (input.overwrite !== true && await cosObjectExists(config, credentials, key)) {
          throw new HttpError(409, 'object-exists', '当前目录已存在同名文件。')
        }
        const task = tasks.create({ name, path, key, size, contentType, config })
        const body: CreateCosUploadTaskResponse = {
          ok: true,
          task,
          uploadUrl: `${API_UPLOAD_CONTENT}?taskId=${encodeURIComponent(task.id)}`,
        }
        sendJson(response, 200, body)
      } catch (error) {
        safeSendError(response, operationError(error, 'create-upload-failed'))
      }
    })

    register(API_UPLOAD_CONTENT, async (request, response) => {
      let taskId: string | undefined
      try {
        assertSafeRequest(request, 'POST', 'binary')
        taskId = taskIdFromUrl(request)
        const upload = tasks.getUploadInput(taskId)
        assertUploadLength(request, upload.task.size)
        const credentials = await services.getCredentials()
        let uploadControl: UploadStreamControl | undefined
        let cancelled = false
        let paused = false
        tasks.begin(taskId, {
          cancel: () => {
            cancelled = true
            uploadControl?.cancel()
            if (!request.destroyed) request.destroy()
          },
          pause: () => {
            paused = true
            uploadControl?.pause()
          },
          resume: () => {
            paused = false
            uploadControl?.resume()
          },
        })
        request.once('aborted', () => {
          try {
            tasks.cancel(taskId!)
          } catch {}
        })
        await uploadCosObject({
          config: upload.config,
          credentials,
          key: upload.task.key,
          body: request,
          size: upload.task.size,
          contentType: upload.contentType,
          onControlReady: (control) => {
            uploadControl = control
            if (cancelled) control.cancel()
            else if (paused) control.pause()
          },
          onProgress: uploadedBytes => tasks.progress(taskId!, uploadedBytes),
        })
        const task = tasks.complete(taskId)
        if (task.status === 'cancelled') throw new HttpError(409, 'upload-cancelled', '上传已取消。')
        const body: CosUploadCompleteResponse = { ok: true, task }
        sendJson(response, 200, body)
      } catch (error) {
        if (taskId !== undefined) {
          try {
            const current = tasks.get(taskId)
            const concurrencyLimited = error instanceof HttpError && error.code === 'upload-concurrency-limit'
            if (current.status !== 'cancelled' && !concurrencyLimited) tasks.fail(taskId, describeUploadError(error))
          } catch {}
        }
        safeSendError(response, error instanceof HttpError ? error : new HttpError(502, 'upload-failed', describeCosError(error)))
      }
    })

    register(API_LIST_UPLOADS, async (request, response) => {
      try {
        assertSafeRequest(request, 'GET')
        const body: CosUploadTaskListResponse = { ok: true, tasks: tasks.list() }
        sendJson(response, 200, body)
      } catch (error) {
        safeSendError(response, error)
      }
    })

    const registerTaskAction = (
      path: string,
      action: (taskId: string) => CosUploadTaskActionResponse,
    ) => register(path, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const { taskId } = parseTaskAction(await readJsonBody(request))
        sendJson(response, 200, action(taskId))
      } catch (error) {
        safeSendError(response, error)
      }
    })

    registerTaskAction(API_PAUSE_UPLOAD, taskId => ({ ok: true, task: tasks.pause(taskId) }))
    registerTaskAction(API_RESUME_UPLOAD, taskId => ({ ok: true, task: tasks.resume(taskId) }))
    registerTaskAction(API_CANCEL_UPLOAD, taskId => ({ ok: true, task: tasks.cancel(taskId) }))
    registerTaskAction(API_RETRY_UPLOAD, taskId => ({ ok: true, task: tasks.retry(taskId) }))
    registerTaskAction(API_REMOVE_UPLOAD, (taskId) => {
      tasks.remove(taskId)
      return { ok: true }
    })

    register(API_CLEAR_UPLOADS, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        await readJsonBody(request)
        sendJson(response, 200, { ok: true, removed: tasks.clearCompleted() } satisfies CosUploadTaskActionResponse)
      } catch (error) {
        safeSendError(response, error)
      }
    })
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    tasks.dispose()
    throw error
  }

  return () => {
    tasks.dispose()
    for (const dispose of disposers.reverse()) dispose()
  }
}
