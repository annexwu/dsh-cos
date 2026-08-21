import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { link, lstat, mkdir, realpath, rm, stat, unlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { Config } from './config.ts'
import type { CosCredentials } from './cos-client.ts'

const MAX_PARAMETER_COUNT = 50
const MAX_PARAMETER_VALUE_BYTES = 256 * 1024
const MAX_CHILD_OUTPUT_BYTES = 2 * 1024 * 1024
const ACTION_PATTERN = /^[a-z][a-z0-9-]{0,80}$/
const PARAMETER_PATTERN = /^[a-z][a-z0-9-]{0,80}$/
const SENSITIVE_PARAMETER_PATTERN = /(?:^|[-_])(secret|authorization|password|cookie|skey|access[-_]?key|security[-_]?token|session[-_]?token)(?:$|[-_])/i
const SENSITIVE_OUTPUT_PATTERN = /(?:secret|authorization|password|cookie|skey|signature|private[-_]?key|access[-_]?key|security[-_]?token|session[-_]?token)/i
const LOCAL_PATH_OUTPUT_KEYS = new Set(['cwd', 'savedTo', 'envFile', 'encFile'])
const RESTRICTED_LOCAL_KEYS = new Set(['file', 'output'])

type InitiatingAgent = NonNullable<ToolRunContext['agent']>
type ActionRisk = 'read' | 'write' | 'configuration' | 'destructive'
type RuntimeScript = 'cos_node.mjs' | 'ci_api.mjs'

type CliParameter = string | true

interface ToolServices {
  getConfig(): Config
  getCredentials(): Promise<CosCredentials>
}

interface ActionSpec {
  action: string
  script: RuntimeScript
  category: string
  risk: ActionRisk
  summary: string
}

interface PreparedCommand {
  parameters: Record<string, CliParameter>
  cwd?: string
  finish(succeeded: boolean): Promise<Record<string, JsonValue>>
}

function specs(actions: readonly string[], script: RuntimeScript, category: string, risk: ActionRisk, summary: string): ActionSpec[] {
  return actions.map(action => ({ action, script, category, risk, summary }))
}

const STORAGE_ACTIONS: ActionSpec[] = [
  ...specs([
    'list-buckets', 'head-bucket', 'list', 'head', 'sign-url',
    'get-bucket-acl', 'get-bucket-cors', 'get-bucket-tagging', 'get-bucket-versioning', 'get-bucket-lifecycle', 'get-bucket-location',
    'get-bucket-policy', 'get-bucket-replication', 'get-bucket-website', 'get-bucket-referer', 'get-bucket-domain', 'get-bucket-origin',
    'get-bucket-logging', 'get-bucket-inventory', 'list-bucket-inventory', 'get-bucket-accelerate', 'get-bucket-encryption',
    'get-bucket-intelligent-tiering', 'get-bucket-access-monitor', 'get-bucket-logging-analysis', 'get-bucket-notification',
    'get-bucket-object-lock', 'get-bucket-domain-certificate', 'get-bucket-strict-signature', 'get-bucket-bandwidth-quota', 'get-bucket-response-control',
    'list-object-versions', 'get-object-acl', 'get-object-tagging', 'get-object-retention', 'get-symlink',
    'list-multipart-uploads', 'list-multipart-parts', 'options-object',
  ], 'cos_node.mjs', 'COS storage read', 'read', 'Read account, bucket, object, and configuration state.'),
  ...specs(['download'], 'cos_node.mjs', 'COS workspace transfer', 'write', 'Download one object into the current Agent workspace without overwriting an existing file.'),
  ...specs(['upload', 'put-string', 'copy-object', 'create-bucket'], 'cos_node.mjs', 'COS storage mutation', 'write', 'Create or write COS resources.'),
  ...specs(['put-bucket-acl', 'put-bucket-cors', 'put-bucket-tagging'], 'cos_node.mjs', 'COS configuration change', 'configuration', 'Change bucket access, CORS, or tags.'),
  ...specs(['delete', 'delete-multiple'], 'cos_node.mjs', 'COS deletion', 'destructive', 'Irreversibly delete exact COS objects.'),
]

const CI_ACTIONS: ActionSpec[] = [
  ...specs([
    'ci-service-status', 'simple-query', 'image-search', 'doc-search', 'video-search', 'face-search', 'face-clip-search',
    'get-ai-media-info', 'image-analysis', 'image-exif', 'list-datasets', 'list-bindings', 'find-datasets-by-bucket',
  ], 'ci_api.mjs', 'CI and MetaInsight read', 'read', 'Read CI service state or query account-level MetaInsight datasets.'),
  ...specs([
    'describe-async-image-process-buckets', 'describe-ai-process-buckets', 'image-info', 'watermark-font',
    'image-thumbnail', 'image-crop', 'image-rotate', 'image-format', 'assess-quality', 'ai-super-resolution', 'ai-pic-matting', 'ai-qrcode',
    'recognize-image', 'ocr-general', 'describe-doc-job', 'doc-preview', 'doc-preview-html-url',
    'describe-media-job', 'media-snapshot', 'media-info', 'audit-image', 'describe-audit-job',
    'describe-file-job', 'describe-dataset', 'describe-dataset-bindings', 'describe-file-meta-index',
    'image-search-pic', 'image-search-text', 'dataset-simple-query', 'hybrid-search',
  ], 'cos_node.mjs', 'CI and MetaInsight read', 'read', 'Read CI processing state, process an object without creating a persistent job, or query a MetaInsight resource.'),
  ...specs([
    'create-ci-bucket', 'create-doc-process-bucket', 'create-media-bucket', 'create-asr-bucket', 'create-file-process-bucket',
    'create-async-image-process-bucket', 'create-ai-process-bucket', 'create-doc-to-pdf-job', 'create-media-smart-cover-job',
    'media-transcode-job', 'audit-image-job', 'audit-video-job', 'audit-audio-job', 'audit-text-job', 'audit-document-job',
    'speech-recognition-job', 'tts-job', 'noise-reduction-job', 'voice-separate-job', 'file-hash', 'file-compress-job', 'file-uncompress-job',
    'create-dataset', 'create-dataset-binding', 'create-file-meta-index', 'create-knowledge-base',
  ], 'cos_node.mjs', 'CI and MetaInsight mutation', 'write', 'Enable a service, create an asynchronous processing job, or create MetaInsight resources.'),
  ...specs([
    'delete-ci-bucket', 'delete-doc-process-bucket', 'delete-media-bucket', 'delete-asr-bucket', 'delete-file-process-bucket',
    'delete-async-image-process-bucket', 'delete-ai-process-bucket', 'delete-file-meta-index',
  ], 'cos_node.mjs', 'CI and MetaInsight deletion', 'destructive', 'Disable a CI service or delete an exact MetaInsight index entry.'),
]

const STORAGE_BY_ACTION = new Map(STORAGE_ACTIONS.map(spec => [spec.action, spec]))
const CI_BY_ACTION = new Map(CI_ACTIONS.map(spec => [spec.action, spec]))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonValue(value: unknown): JsonValue {
  const encoded = JSON.stringify(value)
  if (encoded === undefined) throw new Error('Tencent Cloud tool result is not JSON serializable.')
  return JSON.parse(encoded) as JsonValue
}

function render(value: JsonValue): Array<{ type: 'text'; text: string }> {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function requireAgent(agent: InitiatingAgent | undefined): InitiatingAgent {
  if (agent === undefined) throw new Error('Tencent Cloud management tools require an initiating Agent session.')
  return agent
}

function parseAction(value: unknown): string {
  if (typeof value !== 'string' || !ACTION_PATTERN.test(value)) throw new Error('Action must be a lowercase kebab-case identifier.')
  return value
}

function stringifyParameter(value: unknown, name: string): CliParameter | undefined {
  if (value === undefined || value === null || value === false) return undefined
  if (value === true) return true
  if (typeof value === 'string') {
    if (value.startsWith('--')) throw new Error(`Parameters.${name} cannot start with "--".`)
    if (Buffer.byteLength(value, 'utf8') > MAX_PARAMETER_VALUE_BYTES) throw new Error(`Parameters.${name} is too large.`)
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Parameters.${name} must be finite.`)
    return String(value)
  }
  if (typeof value === 'object') {
    const encoded = JSON.stringify(value)
    if (encoded === undefined || Buffer.byteLength(encoded, 'utf8') > MAX_PARAMETER_VALUE_BYTES) throw new Error(`Parameters.${name} is too large.`)
    return encoded
  }
  throw new Error(`Parameters.${name} must be a JSON value.`)
}

function isRestrictedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4 === null) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')
  const [first, second] = ipv4.slice(1).map(Number)
  return first === 0 || first === 9 || first === 10 || first === 11 || first === 21 || first === 30 || first === 127
    || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)
}

function validateExternalUrl(value: string, field: string): void {
  if (!/^https?:\/\//i.test(value)) return
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Parameters.${field} must be a valid HTTP or HTTPS URL.`)
  }
  if (url.username !== '' || url.password !== '' || isRestrictedHost(url.hostname)) {
    throw new Error(`Parameters.${field} cannot target a local or private network address.`)
  }
}

function validateNestedUrls(value: unknown, field = 'body'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNestedUrls(item, `${field}[${index}]`))
    return
  }
  if (!isRecord(value)) return
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && /(?:^|[-_])url$/i.test(key)) validateExternalUrl(child, `${field}.${key}`)
    else validateNestedUrls(child, `${field}.${key}`)
  }
}

function normalizeParameterName(name: string): string {
  const normalized = /^[A-Z][a-z0-9-]{0,80}$/.test(name)
    ? `${name[0].toLowerCase()}${name.slice(1)}`
    : name
  if (!PARAMETER_PATTERN.test(normalized)) throw new Error(`Parameters.${name} is not a valid CLI-style option name.`)
  return normalized
}

export function parseTencentCloudManagementParameters(value: unknown): Record<string, CliParameter> {
  if (!isRecord(value)) throw new Error('Parameters must be a JSON object.')
  const entries = Object.entries(value)
  if (entries.length > MAX_PARAMETER_COUNT) throw new Error(`Parameters supports at most ${MAX_PARAMETER_COUNT} entries.`)
  const parameters: Record<string, CliParameter> = {}
  const submittedNames = new Map<string, string>()
  for (const [submittedName, raw] of entries) {
    const name = normalizeParameterName(submittedName)
    const previousName = submittedNames.get(name)
    if (previousName !== undefined) throw new Error(`Parameters.${submittedName} conflicts with Parameters.${previousName}.`)
    submittedNames.set(name, submittedName)
    if (SENSITIVE_PARAMETER_PATTERN.test(name)) throw new Error(`Parameters.${submittedName} is prohibited. Credentials are supplied by the plugin.`)
    if (typeof raw === 'string' && /(?:^|[-_])url$/i.test(name)) validateExternalUrl(raw, submittedName)
    if ((name === 'body' || name === 'query') && typeof raw === 'string' && /^[\[{]/.test(raw.trim())) {
      try {
        validateNestedUrls(JSON.parse(raw), submittedName)
      } catch (error) {
        if (error instanceof SyntaxError) throw new Error(`Parameters.${submittedName} must be valid JSON when it starts with "{" or "[".`)
        throw error
      }
    } else if (name === 'body' || name === 'query') {
      validateNestedUrls(raw, submittedName)
    }
    const normalized = stringifyParameter(raw, submittedName)
    if (normalized !== undefined) parameters[name] = normalized
  }
  return parameters
}

function contains(root: string, target: string): boolean {
  const relation = relative(root, target)
  return relation === '' || (!relation.startsWith(`..${sep}`) && relation !== '..' && !isAbsolute(relation))
}

function safeWorkspaceRelativePath(value: CliParameter, name: string): string {
  if (value === true || value.length === 0 || value.length > 1024 || value.includes('\\') || value.startsWith('/') || isAbsolute(value)) {
    throw new Error(`Parameters.${name} must be a workspace-relative path using '/'.`)
  }
  const segments = value.split('/')
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..' || /[\u0000-\u001f\u007f]/.test(segment))) {
    throw new Error(`Parameters.${name} is not a safe workspace-relative path.`)
  }
  return segments.join('/')
}

async function workspaceRoot(agent: InitiatingAgent): Promise<string> {
  const cwd = agent.session.header.cwd
  if (cwd === undefined || cwd === '') throw new Error('This action requires an initiating session with a workspace.')
  const root = await realpath(cwd)
  if (!(await stat(root)).isDirectory()) throw new Error('The current workspace directory is unavailable.')
  return root
}

async function ensureSafeDirectory(root: string, directory: string): Promise<void> {
  const resolvedRoot = await realpath(root)
  if (!contains(resolvedRoot, directory)) throw new Error('Workspace output escapes the current workspace.')
  let current = resolvedRoot
  const relation = relative(resolvedRoot, directory)
  for (const segment of relation === '' ? [] : relation.split(sep)) {
    if (segment === '' || segment === '.') continue
    const next = resolve(current, segment)
    if (!contains(resolvedRoot, next)) throw new Error('Workspace output escapes the current workspace.')
    try {
      const info = await lstat(next)
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Workspace output contains a symbolic link or non-directory path.')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await mkdir(next)
      const info = await lstat(next)
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Workspace output contains a symbolic link or non-directory path.')
    }
    const actual = await realpath(next)
    if (!contains(resolvedRoot, actual)) throw new Error('Workspace output resolves outside the current workspace.')
    current = actual
  }
}

async function prepareWorkspaceTransfer(action: string, parameters: Record<string, CliParameter>, agent: InitiatingAgent): Promise<PreparedCommand> {
  if (action !== 'upload' && action !== 'download') {
    if ([...RESTRICTED_LOCAL_KEYS].some(key => key in parameters)) throw new Error('Only upload and download actions may use local workspace paths.')
    return { parameters, async finish() { return {} } }
  }

  const root = await workspaceRoot(agent)
  if (action === 'upload') {
    const file = safeWorkspaceRelativePath(parameters.file ?? '', 'file')
    const candidate = resolve(root, ...file.split('/'))
    if (!contains(root, candidate)) throw new Error('Parameters.file escapes the current workspace.')
    const candidateInfo = await lstat(candidate)
    if (!candidateInfo.isFile() || candidateInfo.isSymbolicLink()) {
      throw new Error('Parameters.file must be a regular non-symbolic-link file inside the current workspace.')
    }
    const source = await realpath(candidate)
    const sourceInfo = await lstat(source)
    if (!contains(root, source) || !sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
      throw new Error('Parameters.file must resolve to a regular non-symbolic-link file inside the current workspace.')
    }
    return {
      parameters: { ...parameters, file: source },
      cwd: root,
      async finish() { return { WorkspaceFile: relative(root, source).split(sep).join('/') } },
    }
  }

  const output = safeWorkspaceRelativePath(parameters.output ?? '', 'output')
  const target = resolve(root, ...output.split('/'))
  if (!contains(root, target)) throw new Error('Parameters.output escapes the current workspace.')
  await ensureSafeDirectory(root, dirname(target))
  try {
    await lstat(target)
    throw new Error(`Workspace output already exists: ${output}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const temporary = resolve(dirname(target), `.${basename(target)}.dsh-cos-${randomUUID()}.part`)
  return {
    parameters: { ...parameters, output: temporary },
    cwd: root,
    async finish(succeeded): Promise<Record<string, JsonValue>> {
      if (!succeeded) {
        await rm(temporary, { force: true }).catch(() => {})
        return {}
      }
      try {
        await link(temporary, target)
        await unlink(temporary)
      } catch (error) {
        await rm(temporary, { force: true }).catch(() => {})
        throw new Error(`Unable to safely save the downloaded workspace file: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
      return { WorkspaceOutputPath: output }
    },
  }
}

export function applyTencentCloudManagementDefaults(action: string, parameters: Record<string, CliParameter>, config: Config): Record<string, CliParameter> {
  if (action === 'list-buckets') {
    const { bucket: _bucket, region: _region, appid: _appid, ...accountParameters } = parameters
    return accountParameters
  }

  const result = { ...parameters }
  const shouldDefaultBucket = action !== 'create-bucket'
  if (shouldDefaultBucket && result.bucket === undefined && config.bucket !== '') result.bucket = config.bucket
  if (result.region === undefined && config.region !== '') result.region = config.region
  if (result.appid === undefined) {
    const bucket = result.bucket
    if (typeof bucket === 'string') {
      const appId = bucket.slice(bucket.lastIndexOf('-') + 1)
      if (/^\d{5,20}$/.test(appId)) result.appid = appId
    }
  }
  return result
}

function toCliArgs(action: string, parameters: Record<string, CliParameter>): string[] {
  const args = [action]
  for (const name of Object.keys(parameters).sort()) {
    const value = parameters[name]
    if (value === undefined) continue
    args.push(`--${name}`)
    if (value !== true) args.push(value)
  }
  return args
}

function scriptPath(script: RuntimeScript): string {
  return fileURLToPath(new URL(`../runtime/tencentcloud-cos/scripts/${script}`, import.meta.url))
}

export function createTencentCloudChildEnvironment(credentials: CosCredentials, config: Config, useElectronNodeRuntime = process.versions.electron !== undefined): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    ...(process.platform === 'win32'
      ? {
          SystemRoot: process.env.SystemRoot,
          WINDIR: process.env.WINDIR,
          ComSpec: process.env.ComSpec,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
        }
      : {}),
    TENCENTCLOUD_SECRET_ID: credentials.secretId,
    TENCENTCLOUD_SECRET_KEY: credentials.secretKey,
    KIKI: '0',
  }
  if (useElectronNodeRuntime) environment.ELECTRON_RUN_AS_NODE = '1'
  if (config.bucket !== '') environment.TENCENT_COS_BUCKET = config.bucket
  if (config.region !== '') environment.TENCENT_COS_REGION = config.region
  return environment
}

async function runCli(script: RuntimeScript, action: string, parameters: Record<string, CliParameter>, credentials: CosCredentials, config: Config, signal: AbortSignal, cwd?: string): Promise<unknown> {
  const location = scriptPath(script)
  const args = [location, ...toCliArgs(action, parameters)]
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(process.execPath, args, {
      cwd: cwd ?? dirname(location),
      env: createTencentCloudChildEnvironment(credentials, config),
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const terminate = (): void => { child.kill() }
    const reject = (error: Error): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', terminate)
      rejectResult(error)
    }
    const append = (stream: 'stdout' | 'stderr', chunk: Buffer): void => {
      const next = stream === 'stdout' ? stdout.length + chunk.length : stderr.length + chunk.length
      if (next > MAX_CHILD_OUTPUT_BYTES) {
        child.kill()
        reject(new Error('Tencent Cloud CLI result exceeded the safety limit. Narrow the request scope.'))
        return
      }
      if (stream === 'stdout') stdout += chunk.toString('utf8')
      else stderr += chunk.toString('utf8')
    }
    child.stdout.on('data', (chunk: Buffer) => append('stdout', chunk))
    child.stderr.on('data', (chunk: Buffer) => append('stderr', chunk))
    child.once('error', () => reject(new Error('Unable to start the bundled Tencent Cloud runtime.')))
    child.once('close', (code) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', terminate)
      if (signal.aborted) {
        rejectResult(new Error('Tencent Cloud action was cancelled.'))
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse((stdout.trim() === '' ? stderr : stdout).trim())
      } catch {
        rejectResult(new Error(`Tencent Cloud ${action} returned an invalid result${code === 0 ? '' : ` (exit ${code ?? 'unknown'})`}.`))
        return
      }
      if (code !== 0) {
        const sanitized = sanitizeTencentCloudManagementOutput(parsed)
        rejectResult(new Error(formatTencentCloudManagementFailure(action, sanitized)))
        return
      }
      resolveResult(parsed)
    })
    if (signal.aborted) terminate()
    else signal.addEventListener('abort', terminate, { once: true })
  })
}

export function sanitizeTencentCloudManagementOutput(value: unknown, key?: string): JsonValue {
  if (key !== undefined && (SENSITIVE_OUTPUT_PATTERN.test(key) || LOCAL_PATH_OUTPUT_KEYS.has(key))) return '[redacted]'
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(item => sanitizeTencentCloudManagementOutput(item))
  if (!isRecord(value)) return String(value)
  return Object.fromEntries(Object.entries(value).map(([name, child]) => [name, sanitizeTencentCloudManagementOutput(child, name)])) as JsonValue
}

function errorField(record: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = record[name]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function clippedJson(value: unknown, max = 600): string | undefined {
  if (value === undefined || value === null) return undefined
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  if (!serialized || serialized === '{}') return undefined
  return serialized.length > max ? `${serialized.slice(0, max)}…` : serialized
}

export function formatTencentCloudManagementFailure(action: string, value: unknown): string {
  const root = isRecord(value) ? value : {}
  const error = isRecord(root.error) ? root.error : root
  const message = typeof root.error === 'string'
    ? root.error
    : errorField(error, 'message', 'Message') || `Tencent Cloud ${action} failed.`
  const code = errorField(error, 'code', 'Code') || errorField(root, 'code', 'Code')
  const request = isRecord(error.request) ? error.request : isRecord(root.request) ? root.request : undefined
  const statusCode = errorField(error, 'statusCode', 'status') || errorField(root, 'statusCode', 'status') || (request ? errorField(request, 'statusCode', 'status') : undefined)
  const requestId = errorField(error, 'requestId', 'RequestId') || errorField(root, 'requestId', 'RequestId') || (request ? errorField(request, 'requestId', 'RequestId') : undefined)
  const traceId = errorField(error, 'traceId', 'TraceId') || errorField(root, 'traceId', 'TraceId') || (request ? errorField(request, 'traceId', 'TraceId') : undefined)
  const resource = errorField(error, 'resource', 'Resource') || errorField(root, 'resource', 'Resource')
  const details = clippedJson(error.details)
  const method = request ? errorField(request, 'method') : undefined
  const host = request ? errorField(request, 'host') : undefined
  const pathname = request ? errorField(request, 'pathname') : undefined
  const requestSummary = [method, host ? `${host}${pathname || ''}` : pathname].filter(Boolean).join(' ')
  const headline = `${action} failed${code ? ` [${code}]` : ''}: ${message}`
  const context = [
    statusCode ? `HTTP status: ${statusCode}` : undefined,
    requestId ? `RequestId: ${requestId}` : undefined,
    traceId ? `TraceId: ${traceId}` : undefined,
    resource ? `Resource: ${resource}` : undefined,
    details ? `Details: ${details}` : undefined,
    requestSummary ? `Request: ${requestSummary}` : undefined,
  ].filter((item): item is string => item !== undefined)
  return [headline, ...context].join('\n')
}

export function getTencentCloudManagementActionCatalog(tool: 'storage' | 'ci'): ReadonlyArray<Readonly<{
  action: string
  category: string
  risk: ActionRisk
  summary: string
}>> {
  return (tool === 'storage' ? STORAGE_ACTIONS : CI_ACTIONS)
    .map(({ action, category, risk, summary }) => ({ action, category, risk, summary }))
}

async function cloudStorageDefaults(services: ToolServices): Promise<JsonValue> {
  const config = services.getConfig()
  const credentialsConfigured = await services.getCredentials().then(() => true, () => false)
  const normalizedPrefix = config.prefix.replace(/^\/+/, '')
  const storageRootUri = config.bucket === ''
    ? undefined
    : `cos://${config.bucket}/${normalizedPrefix}`

  return jsonValue({
    Configured: config.bucket !== '' && config.region !== '',
    CredentialsConfigured: credentialsConfigured,
    Bucket: config.bucket,
    Region: config.region,
    Prefix: config.prefix,
    CustomDomain: config.customDomain,
    ...(storageRootUri === undefined ? {} : { StorageRootUri: storageRootUri }),
  })
}

async function helpResponse(services: ToolServices, tool: 'storage' | 'ci'): Promise<JsonValue> {
  const actions = getTencentCloudManagementActionCatalog(tool)
    .map(({ action, category, risk, summary }) => ({ Action: action, Category: category, Risk: risk, Summary: summary }))
  return jsonValue({
    Tool: tool === 'storage' ? 'tencentcloud_cos_storage_manage' : 'tencentcloud_cos_ci_manage',
    Usage: 'Pass the exact Action plus Parameters using the original CLI flag names without leading "--". Nested Parameters are JSON-encoded automatically.',
    Credentials: 'The plugin resolves the configured COS credentials internally. Never provide SecretId, SecretKey, token, cookie, or authorization fields.',
    ...(tool === 'storage' ? { DefaultCloudStorage: await cloudStorageDefaults(services) } : {}),
    Actions: actions,
    ProhibitedActions: ['ci-request', 'encrypt-env', 'decrypt-env'],
  })
}

async function executeAction(services: ToolServices, tool: 'storage' | 'ci', rawAction: unknown, rawParameters: unknown, exec: ToolRunContext): Promise<JsonValue> {
  const action = parseAction(rawAction)
  if (action === 'help') return helpResponse(services, tool)
  const spec = (tool === 'storage' ? STORAGE_BY_ACTION : CI_BY_ACTION).get(action)
  if (spec === undefined) throw new Error(`Action "${action}" is not available from this ${tool === 'storage' ? 'COS storage' : 'COS CI'} tool. Call Action: "help" for the supported allowlist.`)
  const parameters = applyTencentCloudManagementDefaults(action, parseTencentCloudManagementParameters(rawParameters), services.getConfig())
  const prepared = await prepareWorkspaceTransfer(action, parameters, requireAgent(exec.agent))
  try {
    const result = await runCli(spec.script, action, prepared.parameters, await services.getCredentials(), services.getConfig(), exec.signal, prepared.cwd)
    const local = await prepared.finish(true)
    return jsonValue({ Action: action, Category: spec.category, Risk: spec.risk, Result: sanitizeTencentCloudManagementOutput(result), ...local })
  } catch (error) {
    await prepared.finish(false)
    throw error
  }
}

export function registerTencentCloudManagementTools(ctx: Context, services: ToolServices): () => void {
  const output = { schema: { type: 'json' } as const, render: (_args: unknown, value: JsonValue) => render(value) }
  const registered = [
    ctx.tools.register(defineTool({
      name: 'tencentcloud_cos_storage_manage',
      description: 'Manage Tencent Cloud COS storage across every Bucket the configured credentials can access. Action: "help" includes non-sensitive DefaultCloudStorage settings for the plugin COS cloud storage scenario (云存储, with 云盘 as a legacy alias). Actions use the original COS CLI parameter names in Parameters, without leading "--". Credentials are supplied internally and cannot be passed as parameters.',
      parameters: {
        Action: { type: 'string', required: true, description: 'Allowed COS storage Action, or "help" to inspect the action catalog.' },
        Parameters: { type: 'object', required: true, additionalProperties: true, properties: {}, description: 'Action parameters using original CLI flag names without leading "--".' },
      },
      output,
      async execute(args, exec) {
        return executeAction(services, 'storage', args.Action, args.Parameters, exec)
      },
      presentCall: args => ({ card: 'generic', title: `Manage COS storage: ${typeof args.Action === 'string' ? args.Action : 'unknown action'}`, kind: 'execute', rawInput: args }),
    })),
    ctx.tools.register(defineTool({
      name: 'tencentcloud_cos_ci_manage',
      description: 'Manage Tencent Cloud COS CI and MetaInsight capabilities across every permitted Bucket. Use Action: "help" first when the COS Skill does not already specify an action. Actions use the original CI CLI parameter names in Parameters, without leading "--". Credentials are supplied internally and cannot be passed as parameters.',
      parameters: {
        Action: { type: 'string', required: true, description: 'Allowed COS CI or MetaInsight Action, or "help" to inspect the action catalog.' },
        Parameters: { type: 'object', required: true, additionalProperties: true, properties: {}, description: 'Action parameters using original CLI flag names without leading "--".' },
      },
      output,
      async execute(args, exec) {
        return executeAction(services, 'ci', args.Action, args.Parameters, exec)
      },
      presentCall: args => ({ card: 'generic', title: `Manage COS CI: ${typeof args.Action === 'string' ? args.Action : 'unknown action'}`, kind: 'execute', rawInput: args }),
    })),
  ]
  return () => {
    for (const dispose of registered.reverse()) dispose()
  }
}
