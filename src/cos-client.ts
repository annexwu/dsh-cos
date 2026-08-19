import { Readable } from 'node:stream'
import COS from 'cos-nodejs-sdk-v5'
import type { Config } from './config.ts'
import type { CosStorageItem } from './protocol.ts'

const LIST_PAGE_SIZE = 100

export interface CosCredentials {
  secretId: string
  secretKey: string
}

export interface CosStorageListResult {
  items: CosStorageItem[]
  nextMarker?: string
}

function createCosClient(credentials: CosCredentials): COS {
  return new COS({
    SecretId: credentials.secretId,
    SecretKey: credentials.secretKey,
    Timeout: 15_000,
  })
}

export async function testCosConnection(config: Config, credentials: CosCredentials): Promise<void> {
  const cos = createCosClient(credentials)
  await cos.getBucket({
    Bucket: config.bucket,
    Region: config.region,
    ...(config.prefix === '' ? {} : { Prefix: config.prefix }),
    Delimiter: '/',
    MaxKeys: 1,
  })
}

interface CosListData {
  CommonPrefixes?: Array<{ Prefix: string }>
  Contents?: Array<{
    Key: string
    Size: string
    LastModified: string
    ETag: string
    StorageClass: string
  }>
}

export function mapCosStorageItems(
  rootPrefix: string,
  currentPrefix: string,
  data: CosListData,
): CosStorageItem[] {
  const folders = (data.CommonPrefixes ?? [])
    .filter(item => item.Prefix.startsWith(currentPrefix) && item.Prefix !== currentPrefix)
    .map<CosStorageItem>((item) => {
      const relativePath = item.Prefix.slice(rootPrefix.length)
      const name = item.Prefix.slice(currentPrefix.length).replace(/\/$/, '')
      return {
        kind: 'folder',
        name,
        key: item.Prefix,
        path: relativePath,
        size: 0,
      }
    })
    .filter(item => item.name !== '' && !item.name.includes('/'))

  const files = (data.Contents ?? [])
    .filter(item => item.Key.startsWith(currentPrefix) && item.Key !== currentPrefix && !item.Key.endsWith('/'))
    .map<CosStorageItem>((item) => ({
      kind: 'file',
      name: item.Key.slice(currentPrefix.length),
      key: item.Key,
      path: item.Key.slice(rootPrefix.length),
      size: Number.isFinite(Number(item.Size)) && Number(item.Size) >= 0 ? Number(item.Size) : 0,
      lastModified: item.LastModified,
      eTag: item.ETag,
      storageClass: item.StorageClass,
    }))
    .filter(item => item.name !== '' && !item.name.includes('/'))

  return [...folders, ...files]
}

export interface CosFolderObject {
  key: string
  size: number
}

export async function listCosFolderObjects(
  config: Config,
  credentials: CosCredentials,
  prefix: string,
): Promise<CosFolderObject[]> {
  const cos = createCosClient(credentials)
  const objects: CosFolderObject[] = []
  let marker: string | undefined
  do {
    const data = await cos.getBucket({
      Bucket: config.bucket,
      Region: config.region,
      Prefix: prefix,
      ...(marker === undefined ? {} : { Marker: marker }),
      MaxKeys: 1000,
    })
    for (const item of data.Contents ?? []) {
      if (item.Key.startsWith(prefix) && item.Key !== prefix && !item.Key.endsWith('/')) {
        objects.push({ key: item.Key, size: Number(item.Size) || 0 })
      }
    }
    marker = data.IsTruncated === 'true' && data.NextMarker ? data.NextMarker : undefined
  } while (marker !== undefined)
  return objects
}

export async function listCosObjects(
  config: Config,
  credentials: CosCredentials,
  relativePath: string,
  marker?: string,
  maxKeys = LIST_PAGE_SIZE,
): Promise<CosStorageListResult> {
  const currentPrefix = `${config.prefix}${relativePath}`
  const cos = createCosClient(credentials)
  const data = await cos.getBucket({
    Bucket: config.bucket,
    Region: config.region,
    ...(currentPrefix === '' ? {} : { Prefix: currentPrefix }),
    ...(marker === undefined ? {} : { Marker: marker }),
    Delimiter: '/',
    MaxKeys: maxKeys,
  })
  const nextMarker = data.IsTruncated === 'true' && data.NextMarker ? data.NextMarker : undefined
  return {
    items: mapCosStorageItems(config.prefix, currentPrefix, data),
    ...(nextMarker === undefined ? {} : { nextMarker }),
  }
}

export async function cosObjectExists(
  config: Config,
  credentials: CosCredentials,
  key: string,
): Promise<boolean> {
  const cos = createCosClient(credentials)
  try {
    await cos.headObject({ Bucket: config.bucket, Region: config.region, Key: key })
    return true
  } catch (error) {
    if (isCosNotFoundError(error)) return false
    throw error
  }
}

export async function cosFolderExists(
  config: Config,
  credentials: CosCredentials,
  key: string,
): Promise<boolean> {
  const cos = createCosClient(credentials)
  const data = await cos.getBucket({
    Bucket: config.bucket,
    Region: config.region,
    Prefix: key,
    MaxKeys: 1,
  })
  return (data.Contents?.length ?? 0) > 0 || (data.CommonPrefixes?.length ?? 0) > 0
}

export async function createCosFolder(
  config: Config,
  credentials: CosCredentials,
  key: string,
): Promise<void> {
  const cos = createCosClient(credentials)
  await cos.putObject({
    Bucket: config.bucket,
    Region: config.region,
    Key: key,
    Body: '',
    ContentLength: 0,
    ContentType: 'application/x-directory',
  })
}

export interface UploadStreamControl {
  cancel(): void
  pause(): void
  resume(): void
}

export interface UploadCosObjectOptions {
  config: Config
  credentials: CosCredentials
  key: string
  body: Readable
  size: number
  contentType: string
  onControlReady: (control: UploadStreamControl) => void
  onProgress: (uploadedBytes: number) => void
}

class PartStreamReader {
  private readonly iterator: AsyncIterator<unknown>
  private remainder?: Buffer

  constructor(private readonly source: Readable) {
    this.iterator = source[Symbol.asyncIterator]()
  }

  async *read(
    length: number,
    waitIfPaused: () => Promise<void>,
    onBytes: (bytes: number) => void,
  ): AsyncGenerator<Buffer> {
    let remaining = length
    while (remaining > 0) {
      await waitIfPaused()
      let buffer = this.remainder
      if (buffer === undefined || buffer.length === 0) {
        const next = await this.iterator.next()
        if (next.done) throw new Error('upload stream ended before Content-Length')
        buffer = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value as Uint8Array)
      }
      const size = Math.min(buffer.length, remaining)
      const current = buffer.subarray(0, size)
      this.remainder = size < buffer.length ? buffer.subarray(size) : undefined
      remaining -= size
      onBytes(size)
      yield current
    }
  }
}

export function multipartChunkSize(size: number): number {
  const mib = 1024 ** 2
  const minimum = 8 * mib
  const maximum = 5 * 1024 ** 3
  const required = Math.ceil(size / 10_000 / mib) * mib
  return Math.min(maximum, Math.max(minimum, required))
}

export async function uploadCosObject(options: UploadCosObjectOptions): Promise<void> {
  const cos = createCosClient(options.credentials)
  let cancelled = false
  let paused = false
  let resumeWaiters: Array<() => void> = []
  const releasePaused = () => {
    const waiters = resumeWaiters
    resumeWaiters = []
    for (const resolve of waiters) resolve()
  }
  const waitIfPaused = async () => {
    if (cancelled) throw new Error('upload cancelled')
    if (!paused) return
    await new Promise<void>(resolve => resumeWaiters.push(resolve))
    if (cancelled) throw new Error('upload cancelled')
  }
  options.onControlReady({
    cancel() {
      cancelled = true
      paused = false
      releasePaused()
      options.body.destroy(new Error('upload cancelled'))
    },
    pause() {
      if (!cancelled) paused = true
    },
    resume() {
      paused = false
      releasePaused()
    },
  })

  if (options.size === 0) {
    await cos.putObject({
      Bucket: options.config.bucket,
      Region: options.config.region,
      Key: options.key,
      Body: '',
      ContentLength: 0,
      ContentType: options.contentType,
    })
    options.onProgress(0)
    return
  }

  const initialized = await cos.multipartInit({
    Bucket: options.config.bucket,
    Region: options.config.region,
    Key: options.key,
    ContentType: options.contentType,
  })
  const reader = new PartStreamReader(options.body)
  const parts: COS.Part[] = []
  const chunkSize = multipartChunkSize(options.size)
  let consumed = 0
  try {
    for (let partNumber = 1; consumed < options.size; partNumber += 1) {
      await waitIfPaused()
      const currentSize = Math.min(chunkSize, options.size - consumed)
      const partBody = Readable.from(reader.read(currentSize, waitIfPaused, (bytes) => {
        consumed += bytes
        options.onProgress(consumed)
      }))
      const result = await cos.multipartUpload({
        Bucket: options.config.bucket,
        Region: options.config.region,
        Key: options.key,
        UploadId: initialized.UploadId,
        PartNumber: partNumber,
        Body: partBody,
        ContentLength: currentSize,
      })
      parts.push({ PartNumber: partNumber, ETag: result.ETag })
    }
    await waitIfPaused()
    await cos.multipartComplete({
      Bucket: options.config.bucket,
      Region: options.config.region,
      Key: options.key,
      UploadId: initialized.UploadId,
      Parts: parts,
    })
  } catch (error) {
    await cos.multipartAbort({
      Bucket: options.config.bucket,
      Region: options.config.region,
      Key: options.key,
      UploadId: initialized.UploadId,
    }).catch(() => {})
    throw error
  }
}

export interface CosObjectInfo {
  size: number
}

export async function getCosObjectInfo(
  config: Config,
  credentials: CosCredentials,
  key: string,
): Promise<CosObjectInfo> {
  const cos = createCosClient(credentials)
  const metadata = await cos.headObject({
    Bucket: config.bucket,
    Region: config.region,
    Key: key,
  })
  const rawLength = metadata.headers?.['content-length']
  return {
    size: typeof rawLength === 'string' && /^\d+$/.test(rawLength) ? Number(rawLength) : 0,
  }
}

export interface CosDeleteObject {
  key: string
  versionId?: string
}

export interface CosDeleteObjectsResult {
  deleted: string[]
  errors: Array<{ key: string; code?: string; message?: string }>
}

export async function deleteCosObjects(
  config: Config,
  credentials: CosCredentials,
  objects: CosDeleteObject[],
): Promise<CosDeleteObjectsResult> {
  const cos = createCosClient(credentials)
  const deleted: string[] = []
  const errors: Array<{ key: string; code?: string; message?: string }> = []
  for (let offset = 0; offset < objects.length; offset += 1000) {
    const batch = objects.slice(offset, offset + 1000)
    const result = await cos.deleteMultipleObject({
      Bucket: config.bucket,
      Region: config.region,
      Objects: batch.map(item => ({ Key: item.key, ...(item.versionId === undefined ? {} : { VersionId: item.versionId }) })),
      Quiet: false,
    })
    for (const item of result.Deleted ?? []) deleted.push(item.Key)
    for (const item of result.Error ?? []) {
      errors.push({
        key: item.Key,
        ...(item.Code === undefined ? {} : { code: item.Code }),
        ...(item.Message === undefined ? {} : { message: item.Message }),
      })
    }
  }
  return { deleted, errors }
}

export interface CosDownloadStream {
  stream: Readable
  contentLength?: number
}

export async function getCosDownloadStream(
  config: Config,
  credentials: CosCredentials,
  key: string,
): Promise<CosDownloadStream> {
  const cos = createCosClient(credentials)
  const metadata = await cos.headObject({
    Bucket: config.bucket,
    Region: config.region,
    Key: key,
  })
  const rawLength = metadata.headers?.['content-length']
  const contentLength = typeof rawLength === 'string' && /^\d+$/.test(rawLength) ? Number(rawLength) : undefined
  return {
    stream: cos.getObjectStream({
      Bucket: config.bucket,
      Region: config.region,
      Key: key,
    }) as Readable,
    ...(contentLength === undefined ? {} : { contentLength }),
  }
}

export async function readCosObjectText(
  config: Config,
  credentials: CosCredentials,
  key: string,
  maxBytes: number,
): Promise<string> {
  const { stream, contentLength } = await getCosDownloadStream(config, credentials, key)
  if (contentLength !== undefined && contentLength > maxBytes) {
    stream.destroy()
    throw new Error(`文件超过 ${maxBytes} 字节的文本预览限制。`)
  }
  const chunks: Buffer[] = []
  let received = 0
  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      received += buffer.length
      if (received > maxBytes) {
        stream.destroy()
        throw new Error(`文件超过 ${maxBytes} 字节的文本预览限制。`)
      }
      chunks.push(buffer)
    }
  } finally {
    stream.destroy()
  }
  return Buffer.concat(chunks).toString('utf8')
}

export type CosDocumentPreviewStatus = 'available' | 'not-enabled' | 'unavailable'

async function readPreviewProbe(response: Response): Promise<string> {
  if (response.body === null) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  try {
    while (text.length < 16_384) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return text
}

export async function probeCosDocumentPreview(url: string): Promise<CosDocumentPreviewStatus> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-16383' },
      redirect: 'follow',
      signal: controller.signal,
    })
    const body = await readPreviewProbe(response)
    if (/FunctionNotEnabled|function used is not enabled/i.test(body)) return 'not-enabled'
    if (!response.ok || /<Code>|<Error>/i.test(body)) return 'unavailable'
    return 'available'
  } catch {
    return 'unavailable'
  } finally {
    clearTimeout(timeout)
  }
}

export async function getCosObjectUrl(
  config: Config,
  credentials: CosCredentials,
  key: string,
  download: boolean,
  expiresSeconds: number,
  customDomain?: string,
  query?: Record<string, string>,
): Promise<string> {
  const cos = createCosClient(credentials)
  const name = key.split('/').filter(Boolean).pop() || 'download'
  return await new Promise<string>((resolve, reject) => {
    cos.getObjectUrl({
      Bucket: config.bucket,
      Region: config.region,
      Key: key,
      Sign: true,
      Expires: expiresSeconds,
      ...(customDomain === undefined ? {} : { Domain: customDomain }),
      ...(query === undefined ? {} : { Query: query }),
      ...(download ? {
        QueryString: `response-content-disposition=${encodeURIComponent(`attachment; filename*=UTF-8''${encodeURIComponent(name)}`)}`,
      } : {}),
    }, (error, data) => {
      if (error) reject(error)
      else resolve(data.Url)
    })
  })
}

export async function deleteCosObject(
  config: Config,
  credentials: CosCredentials,
  key: string,
  kind: 'folder' | 'file',
): Promise<number> {
  const cos = createCosClient(credentials)
  if (kind === 'file') {
    await cos.deleteObject({ Bucket: config.bucket, Region: config.region, Key: key })
    return 1
  }

  let marker: string | undefined
  let deleted = 0
  do {
    const data = await cos.getBucket({
      Bucket: config.bucket,
      Region: config.region,
      Prefix: key,
      ...(marker === undefined ? {} : { Marker: marker }),
      MaxKeys: 1000,
    })
    const keys = (data.Contents ?? []).map(item => item.Key).filter(itemKey => itemKey.startsWith(key))
    for (let index = 0; index < keys.length; index += 1000) {
      const batch = keys.slice(index, index + 1000)
      const result = await cos.deleteMultipleObject({
        Bucket: config.bucket,
        Region: config.region,
        Objects: batch.map(Key => ({ Key })),
        Quiet: false,
      })
      if ((result.Error?.length ?? 0) > 0) throw new Error('部分对象删除失败')
      deleted += result.Deleted?.length ?? batch.length
    }
    marker = data.IsTruncated === 'true' ? data.NextMarker : undefined
    if (keys.length === 0) marker = undefined
  } while (marker !== undefined)
  return deleted
}

interface CosSdkError {
  code?: unknown
  statusCode?: unknown
  message?: unknown
  error?: unknown
}

export function isCosNotFoundError(error: unknown): boolean {
  const value = error as CosSdkError | undefined
  return value?.statusCode === 404 || value?.code === 'NoSuchKey' || value?.code === 'NotFound'
}

export function describeCosError(error: unknown): string {
  const value = error as CosSdkError | undefined
  const code = typeof value?.code === 'string' ? value.code : ''
  const statusCode = typeof value?.statusCode === 'number' ? value.statusCode : undefined

  if (code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch' || statusCode === 403) {
    return '访问被拒绝，请检查密钥是否正确且具有该存储桶的读取权限。'
  }
  if (code === 'NoSuchBucket' || statusCode === 404) {
    return '未找到该存储桶，请检查存储桶名称和地域。'
  }
  if (code === 'RequestTimeout' || code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
    return '连接 COS 超时，请检查网络后重试。'
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return '无法解析 COS 服务地址，请检查网络和地域。'
  }
  if (typeof value?.message === 'string' && value.message.trim() !== '') {
    return `COS 请求失败（${code || '未知错误'}）。`
  }
  return 'COS 请求失败，请检查配置和网络后重试。'
}
