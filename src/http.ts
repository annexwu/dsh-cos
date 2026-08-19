import type { IncomingMessage, ServerResponse } from 'node:http'
import { ConfigValidationError } from './cos-config.ts'
import type { CosStorageErrorResponse } from './protocol.ts'

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
const MAX_BODY_BYTES = 16 * 1024

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

export function isLoopbackRequest(request: IncomingMessage): boolean {
  const remoteAddress = request.socket.remoteAddress
  if (remoteAddress !== undefined) {
    const normalized = remoteAddress.toLowerCase()
    const loopback = normalized === '127.0.0.1'
      || normalized === '::1'
      || normalized.startsWith('127.')
      || normalized.startsWith('::ffff:127.')
    if (!loopback) return false
  }

  const hostHeader = request.headers.host
  if (hostHeader === undefined) return false
  try {
    const hostname = normalizeHostname(new URL(`http://${hostHeader}`).hostname).toLowerCase()
    return hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.')
  } catch {
    return false
  }
}

export function assertSafeRequest(
  request: IncomingMessage,
  expectedMethod: 'GET' | 'POST',
  contentType: 'json' | 'binary' | 'none' = expectedMethod === 'POST' ? 'json' : 'none',
): void {
  if (!isLoopbackRequest(request)) throw new HttpError(403, 'forbidden', '仅允许从本机 DSH 页面访问。')
  if ((request.method ?? 'GET').toUpperCase() !== expectedMethod) {
    throw new HttpError(405, 'method-not-allowed', '请求方法不受支持。')
  }
  const fetchSite = request.headers['sec-fetch-site']
  if (typeof fetchSite === 'string' && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') {
    throw new HttpError(403, 'forbidden-origin', '拒绝跨站请求。')
  }
  const origin = request.headers.origin
  if (origin !== undefined) {
    const host = request.headers.host
    if (host === undefined) throw new HttpError(403, 'forbidden-origin', '请求来源无效。')
    let originHost: string
    try {
      originHost = new URL(origin).host.toLowerCase()
    } catch {
      throw new HttpError(403, 'forbidden-origin', '请求来源无效。')
    }
    if (originHost !== host.toLowerCase()) throw new HttpError(403, 'forbidden-origin', '拒绝跨站请求。')
  }
  const actualContentType = request.headers['content-type'] ?? ''
  if (contentType === 'json' && !actualContentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'unsupported-media-type', '请求必须使用 application/json。')
  }
  if (contentType === 'binary' && !actualContentType.toLowerCase().startsWith('application/octet-stream')) {
    throw new HttpError(415, 'unsupported-media-type', '上传内容必须使用 application/octet-stream。')
  }
}

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentLength = request.headers['content-length']
  if (contentLength !== undefined && Number(contentLength) > MAX_BODY_BYTES) {
    throw new HttpError(413, 'payload-too-large', '请求内容过大。')
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'payload-too-large', '请求内容过大。')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'invalid-json', '请求内容不是有效的 JSON。')
  }
}

export function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode
  response.setHeader('Content-Type', JSON_CONTENT_TYPE)
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.end(JSON.stringify(body))
}

export function sendError(response: ServerResponse, error: unknown): void {
  if (error instanceof HttpError) {
    const body: CosStorageErrorResponse = { ok: false, error: { code: error.code, message: error.message } }
    sendJson(response, error.statusCode, body)
    return
  }
  if (error instanceof ConfigValidationError) {
    const body: CosStorageErrorResponse = { ok: false, error: { code: 'invalid-config', message: error.message } }
    sendJson(response, 400, body)
    return
  }
  const body: CosStorageErrorResponse = {
    ok: false,
    error: { code: 'internal-error', message: '服务暂时不可用，请稍后重试。' },
  }
  sendJson(response, 500, body)
}
