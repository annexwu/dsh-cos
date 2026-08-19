import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.ts'
import { ConfigValidationError, normalizeStoragePath, normalizeListMarker, normalizeObjectKey } from './cos-config.ts'
import {
  describeCosError,
  getCosDownloadStream,
  listCosFolderObjects,
  listCosObjects,
  type CosCredentials,
} from './cos-client.ts'
import { HttpError, assertSafeRequest, readJsonBody, sendError, sendJson } from './http.ts'
import type {
  CreateLocalAttachmentResponse,
  DeleteSessionAttachmentRequest,
  ImportCosAttachmentRequest,
  ImportCosAttachmentResponse,
  ListCosAttachmentRequest,
  ListCosAttachmentResponse,
} from './protocol.ts'
import {
  createSessionAttachmentFolder,
  removeSessionAttachment,
  sanitizeAttachmentName,
  sanitizeSessionId,
  setAttachmentDirectorySize,
  writeAttachmentFileInFolder,
  writeSessionAttachment,
} from './session-attachments.ts'

const API_LOCAL_ATTACHMENT = '/api/dsh-cos/attachments/local'
const API_LIST_COS_ATTACHMENT = '/api/dsh-cos/attachments/cos/list'
const API_IMPORT_COS_ATTACHMENT = '/api/dsh-cos/attachments/cos/import'
const API_DELETE_ATTACHMENT = '/api/dsh-cos/attachments/delete'

interface SessionRecord {
  header: { cwd?: string }
}

type AttachmentDependencies = Context

interface AttachmentServices {
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

function sessionCwd(ctx: AttachmentDependencies, rawSessionId: string): { sessionId: string; cwd: string } {
  const sessionId = sanitizeSessionId(rawSessionId)
  if (sessionId !== rawSessionId) throw new HttpError(400, 'invalid-session-id', '会话标识无效。')
  const sessions = ctx.sessions as unknown as { get(id: string): SessionRecord | undefined }
  const cwd = sessions.get(sessionId)?.header.cwd
  if (cwd === undefined || cwd === '') throw new HttpError(404, 'session-not-found', '当前会话不存在或没有工作区。')
  return { sessionId, cwd }
}

function requireConfiguredConfig(services: AttachmentServices): Config {
  const config = services.getConfig()
  if (config.bucket.trim() === '' || config.region.trim() === '') {
    throw new HttpError(409, 'config-required', '请先在 COS 云存储设置中配置存储桶和地域。')
  }
  return config
}

function parseListRequest(value: unknown): ListCosAttachmentRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  return {
    sessionId: stringField(value, 'sessionId', true)!,
    path: stringField(value, 'path', false),
    marker: stringField(value, 'marker', false),
  }
}

function parseImportRequest(value: unknown): ImportCosAttachmentRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  const kind = stringField(value, 'kind', true)
  if (kind !== 'file' && kind !== 'folder') throw new HttpError(400, 'invalid-object-kind', '对象类型无效。')
  return {
    sessionId: stringField(value, 'sessionId', true)!,
    key: stringField(value, 'key', true)!,
    kind,
  }
}

function parseDeleteRequest(value: unknown): DeleteSessionAttachmentRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  return {
    sessionId: stringField(value, 'sessionId', true)!,
    path: stringField(value, 'path', true)!,
  }
}

function localHeaders(request: IncomingMessage): { sessionId: string; name: string; size?: number } {
  const rawSessionId = request.headers['x-session-id']
  const rawName = request.headers['x-file-name']
  if (typeof rawSessionId !== 'string' || typeof rawName !== 'string') {
    throw new HttpError(400, 'missing-attachment-header', '缺少会话或文件名信息。')
  }
  let name: string
  try {
    name = decodeURIComponent(rawName)
  } catch {
    throw new HttpError(400, 'invalid-file-name', '文件名编码无效。')
  }
  const rawSize = request.headers['content-length']
  if (rawSize !== undefined && (!/^\d+$/.test(rawSize) || !Number.isSafeInteger(Number(rawSize)))) {
    throw new HttpError(400, 'invalid-content-length', '附件大小无效。')
  }
  return { sessionId: rawSessionId, name: sanitizeAttachmentName(name), ...(rawSize === undefined ? {} : { size: Number(rawSize) }) }
}

function safeSendError(response: ServerResponse, error: unknown): void {
  if (!response.destroyed && !response.writableEnded) sendError(response, error)
}

function attachmentError(error: unknown, code: string): unknown {
  if (error instanceof HttpError || error instanceof ConfigValidationError) return error
  return new HttpError(502, code, describeCosError(error))
}

function baseName(key: string): string {
  const name = key.split('/').filter(Boolean).pop()
  if (name === undefined) throw new ConfigValidationError('COS 对象 Key 无效。')
  return sanitizeAttachmentName(name)
}

export function registerAttachmentRoutes(ctx: AttachmentDependencies, services: AttachmentServices): () => void {
  const disposers: Array<() => void> = []
  const register = (path: string, handler: (request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
    disposers.push(ctx.webServer.register({ kind: 'exact', path, handler }))
  }

  try {
    register(API_LOCAL_ATTACHMENT, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST', 'binary')
        const input = localHeaders(request)
        const session = sessionCwd(ctx, input.sessionId)
        const attachment = await writeSessionAttachment(session.cwd, session.sessionId, input.name, request, input.size, 'local')
        const body: CreateLocalAttachmentResponse = { ok: true, attachment }
        sendJson(response, 200, body)
      } catch (error) {
        safeSendError(response, attachmentError(error, 'local-attachment-failed'))
      }
    })

    register(API_LIST_COS_ATTACHMENT, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parseListRequest(await readJsonBody(request))
        sessionCwd(ctx, input.sessionId)
        const config = requireConfiguredConfig(services)
        const path = normalizeStoragePath(input.path)
        const marker = normalizeListMarker(input.marker, `${config.prefix}${path}`)
        const result = await listCosObjects(config, await services.getCredentials(), path, marker)
        const body: ListCosAttachmentResponse = {
          ok: true,
          path,
          items: result.items,
          ...(result.nextMarker === undefined ? {} : { nextMarker: result.nextMarker }),
        }
        sendJson(response, 200, body)
      } catch (error) {
        safeSendError(response, attachmentError(error, 'cos-attachment-list-failed'))
      }
    })

    register(API_IMPORT_COS_ATTACHMENT, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parseImportRequest(await readJsonBody(request))
        const session = sessionCwd(ctx, input.sessionId)
        const config = requireConfiguredConfig(services)
        const key = normalizeObjectKey(input.key, config.prefix, input.kind)
        const credentials = await services.getCredentials()
        if (input.kind === 'file') {
          const download = await getCosDownloadStream(config, credentials, key)
          const attachment = await writeSessionAttachment(session.cwd, session.sessionId, baseName(key), download.stream, download.contentLength, 'cos')
          const body: ImportCosAttachmentResponse = { ok: true, attachment }
          sendJson(response, 200, body)
          return
        }

        const { root, attachment: directoryAttachment } = await createSessionAttachmentFolder(session.cwd, session.sessionId, baseName(key))
        try {
          const objects = await listCosFolderObjects(config, credentials, key)
          for (const object of objects) {
            const relativePath = object.key.slice(key.length)
            const download = await getCosDownloadStream(config, credentials, object.key)
            await writeAttachmentFileInFolder(root, relativePath, download.stream, download.contentLength ?? object.size)
          }
          const attachment = await setAttachmentDirectorySize(directoryAttachment)
          const body: ImportCosAttachmentResponse = { ok: true, attachment }
          sendJson(response, 200, body)
        } catch (error) {
          await import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true, force: true }))
          throw error
        }
      } catch (error) {
        safeSendError(response, attachmentError(error, 'cos-attachment-import-failed'))
      }
    })

    register(API_DELETE_ATTACHMENT, async (request, response) => {
      try {
        assertSafeRequest(request, 'POST')
        const input = parseDeleteRequest(await readJsonBody(request))
        const session = sessionCwd(ctx, input.sessionId)
        await removeSessionAttachment(session.cwd, session.sessionId, input.path)
        sendJson(response, 200, { ok: true })
      } catch (error) {
        safeSendError(response, attachmentError(error, 'attachment-delete-failed'))
      }
    })
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    throw error
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}
