import { isIP } from 'node:net'
import { DEFAULT_ATTACHMENT_DIRECTORY, type Config } from './config.ts'

const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{0,49}-[0-9]{5,20}$/
const REGION_PATTERN = /^[a-z][a-z0-9-]{1,31}$/
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

export function normalizeBucket(value: string): string {
  const bucket = value.trim().toLowerCase()
  if (!BUCKET_PATTERN.test(bucket)) {
    throw new ConfigValidationError('存储桶格式不正确，应为 bucket-appid，例如 example-1250000000。')
  }
  return bucket
}

export function normalizeRegion(value: string): string {
  const region = value.trim().toLowerCase()
  if (!REGION_PATTERN.test(region)) {
    throw new ConfigValidationError('地域格式不正确，例如 ap-guangzhou。')
  }
  return region
}

export function normalizePrefix(value: string | undefined): string {
  const input = (value ?? '').trim().replace(/\\/g, '/')
  if (input === '') return ''
  if (input.length > 1024) throw new ConfigValidationError('目录前缀不能超过 1024 个字符。')
  if (CONTROL_CHARACTER_PATTERN.test(input)) throw new ConfigValidationError('目录前缀不能包含控制字符。')
  const segments = input.replace(/^\/+/, '').split('/').filter(Boolean)
  if (segments.some(segment => segment === '.' || segment === '..')) {
    throw new ConfigValidationError('目录前缀不能包含 . 或 .. 路径段。')
  }
  if (segments.length === 0) return ''
  return `${segments.join('/')}/`
}

function isRestrictedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  const ipVersion = isIP(host)
  if (ipVersion === 6) {
    return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')
  }
  if (ipVersion !== 4) return false
  const [first, second] = host.split('.').map(Number)
  return first === 0
    || first === 9
    || first === 10
    || first === 11
    || first === 21
    || first === 30
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
}

export function normalizeCustomDomain(value: string | undefined): string {
  const input = (value ?? '').trim()
  if (input === '') return ''
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new ConfigValidationError('自定义域名必须是完整的 HTTP 或 HTTPS 地址。')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ConfigValidationError('自定义域名只支持 HTTP 或 HTTPS。')
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new ConfigValidationError('自定义域名不能包含账号、密码、查询参数或锚点。')
  }
  if (url.pathname !== '' && url.pathname !== '/') {
    throw new ConfigValidationError('自定义域名不能包含路径。')
  }
  if (isRestrictedHost(url.hostname)) {
    throw new ConfigValidationError('自定义域名不能指向本机或内网地址。')
  }
  return url.origin
}

export function normalizeAttachmentDirectory(value: string | undefined): string {
  const directory = normalizePrefix(value ?? DEFAULT_ATTACHMENT_DIRECTORY)
  if (directory === '') throw new ConfigValidationError('附件子目录不能为空。')
  return directory
}

export function attachmentRootPrefix(config: Pick<Config, 'prefix' | 'attachmentDirectory'>): string {
  return `${config.prefix}${normalizeAttachmentDirectory(config.attachmentDirectory)}`
}

const MAX_ATTACHMENT_READ_ORIGINS = 8

export interface AttachmentReadOrigin {
  bucket: string
  region: string
  root: string
}

function sameAttachmentOrigin(left: AttachmentReadOrigin, right: AttachmentReadOrigin): boolean {
  return left.bucket === right.bucket && left.region === right.region && left.root === right.root
}

export function normalizeAttachmentReadRoots(value: string | undefined): string {
  const roots: string[] = []
  for (const entry of (value ?? '').split(/\r?\n/)) {
    if (entry.trim() === '') continue
    const root = normalizePrefix(entry)
    if (root !== '' && !roots.includes(root)) roots.push(root)
  }
  return roots.slice(0, MAX_ATTACHMENT_READ_ORIGINS).join('\n')
}

function parseAttachmentReadOrigins(value: string | undefined): AttachmentReadOrigin[] {
  if (value?.trim() === '') return []
  try {
    const parsed: unknown = JSON.parse(value ?? '[]')
    if (!Array.isArray(parsed)) return []
    const origins: AttachmentReadOrigin[] = []
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
      const { bucket, region, root } = entry as Record<string, unknown>
      if (typeof bucket !== 'string' || typeof region !== 'string' || typeof root !== 'string') continue
      try {
        const origin = { bucket: normalizeBucket(bucket), region: normalizeRegion(region), root: normalizePrefix(root) }
        if (origin.root !== '' && !origins.some(item => sameAttachmentOrigin(item, origin))) origins.push(origin)
      } catch {}
    }
    return origins.slice(0, MAX_ATTACHMENT_READ_ORIGINS)
  } catch {
    return []
  }
}

export function attachmentReadOrigins(config: Pick<Config, 'bucket' | 'region' | 'prefix' | 'attachmentDirectory' | 'attachmentReadRoots' | 'attachmentReadOrigins'>): readonly AttachmentReadOrigin[] {
  const current = { bucket: config.bucket, region: config.region, root: attachmentRootPrefix(config) }
  const legacy = normalizeAttachmentReadRoots(config.attachmentReadRoots)
    .split('\n')
    .filter(Boolean)
    .map(root => ({ bucket: config.bucket, region: config.region, root }))
  const historical = [...parseAttachmentReadOrigins(config.attachmentReadOrigins), ...legacy]
  return [current, ...historical.filter(origin => !sameAttachmentOrigin(origin, current))]
    .filter((origin, index, origins) => origins.findIndex(item => sameAttachmentOrigin(item, origin)) === index)
    .slice(0, MAX_ATTACHMENT_READ_ORIGINS + 1)
}

export function attachmentReadRoots(config: Pick<Config, 'bucket' | 'region' | 'prefix' | 'attachmentDirectory' | 'attachmentReadRoots' | 'attachmentReadOrigins'>): readonly string[] {
  return attachmentReadOrigins(config).map(origin => origin.root)
}

export function withAttachmentReadRoots(previous: Config, next: Config): Config {
  const current = { bucket: next.bucket, region: next.region, root: attachmentRootPrefix(next) }
  const historical = attachmentReadOrigins(previous)
    .filter(origin => !sameAttachmentOrigin(origin, current))
    .slice(0, MAX_ATTACHMENT_READ_ORIGINS)
  return {
    ...next,
    attachmentReadRoots: '',
    attachmentReadOrigins: JSON.stringify(historical),
  }
}

export function normalizeConfig(input: {
  bucket: string
  region: string
  prefix?: string
  customDomain?: string
  attachmentEnabled?: boolean
  attachmentDirectory?: string
  attachmentReadRoots?: string
  attachmentReadOrigins?: string
}): Config {
  return {
    bucket: normalizeBucket(input.bucket),
    region: normalizeRegion(input.region),
    prefix: normalizePrefix(input.prefix),
    customDomain: normalizeCustomDomain(input.customDomain),
    attachmentEnabled: input.attachmentEnabled ?? true,
    attachmentDirectory: normalizeAttachmentDirectory(input.attachmentDirectory),
    attachmentReadRoots: normalizeAttachmentReadRoots(input.attachmentReadRoots),
    attachmentReadOrigins: JSON.stringify(parseAttachmentReadOrigins(input.attachmentReadOrigins)),
  }
}

export function normalizeSecret(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined
  const secret = value.trim()
  if (secret === '') return undefined
  if (secret.length > 512 || CONTROL_CHARACTER_PATTERN.test(secret)) {
    throw new ConfigValidationError(`${label} 格式不正确。`)
  }
  return secret
}

export function normalizeStoragePath(value: string | undefined): string {
  const path = value ?? ''
  if (path === '') return ''
  if (path.length > 1024 || CONTROL_CHARACTER_PATTERN.test(path) || path.includes('\\')) {
    throw new ConfigValidationError('目录路径格式不正确。')
  }
  if (path.startsWith('/') || !path.endsWith('/')) {
    throw new ConfigValidationError('目录路径格式不正确。')
  }
  const segments = path.slice(0, -1).split('/')
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw new ConfigValidationError('目录路径格式不正确。')
  }
  return path
}

export function normalizeListMarker(value: string | undefined, fullPrefix: string): string | undefined {
  if (value === undefined || value === '') return undefined
  if (value.length > 2048 || CONTROL_CHARACTER_PATTERN.test(value) || !value.startsWith(fullPrefix)) {
    throw new ConfigValidationError('分页标记无效，请刷新目录后重试。')
  }
  return value
}

export function normalizeObjectName(value: string, label: string): string {
  if (value.trim() === '' || value === '.' || value === '..') {
    throw new ConfigValidationError(`${label}不能为空。`)
  }
  if (value.length > 255 || CONTROL_CHARACTER_PATTERN.test(value) || value.includes('/') || value.includes('\\')) {
    throw new ConfigValidationError(`${label}不能包含斜杠、反斜杠或控制字符，且不能超过 255 个字符。`)
  }
  return value
}

export function buildObjectKey(rootPrefix: string, relativePath: string, name: string, folder = false): string {
  const key = `${rootPrefix}${relativePath}${name}${folder ? '/' : ''}`
  if (Buffer.byteLength(key, 'utf8') > 1024) {
    throw new ConfigValidationError('对象 Key 过长，请缩短文件名或目录层级。')
  }
  return key
}

export function normalizeUploadSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ConfigValidationError('文件大小格式不正确。')
  }
  return value
}

export function normalizeObjectKey(value: string, rootPrefix: string, kind: 'folder' | 'file'): string {
  if (value.length === 0 || value.length > 1024 || CONTROL_CHARACTER_PATTERN.test(value) || !value.startsWith(rootPrefix)) {
    throw new ConfigValidationError('对象 Key 不在当前 COS 云存储根目录内。')
  }
  const relative = value.slice(rootPrefix.length)
  if (relative === '' || relative.startsWith('/') || relative.includes('\\')) {
    throw new ConfigValidationError('对象 Key 格式不正确。')
  }
  if ((kind === 'folder') !== value.endsWith('/')) {
    throw new ConfigValidationError('对象类型与 Key 不匹配。')
  }
  return value
}

export function normalizeContentType(value: string | undefined): string {
  const contentType = (value ?? '').trim()
  if (contentType === '') return 'application/octet-stream'
  if (contentType.length > 255 || CONTROL_CHARACTER_PATTERN.test(contentType)) {
    throw new ConfigValidationError('文件 Content-Type 格式不正确。')
  }
  return contentType
}
