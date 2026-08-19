import type { Context } from '@deepseek-ai/cordis'
import type { CredentialInfo } from '@deepseek-ai/dsh-credentials'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { Config } from './config.ts'
import { SECRET_ID_REF, SECRET_KEY_REF } from './config.ts'
import {
  normalizeConfig,
  normalizeStoragePath,
  normalizeListMarker,
  normalizeSecret,
} from './cos-config.ts'
import { describeCosError, listCosObjects, testCosConnection } from './cos-client.ts'
import { HttpError, assertSafeRequest, readJsonBody, sendError, sendJson } from './http.ts'
import { registerLocalUploadRoutes } from './local-upload-routes.ts'
import { registerOperationRoutes } from './operation-routes.ts'
import { UploadTaskManager } from './upload-tasks.ts'
import type {
  CosStorageConfigResponse,
  CosStorageConfigView,
  CosStorageConnectionResponse,
  CosStorageListRequest,
  CosStorageListResponse,
  SaveCosStorageConfigRequest,
  TestCosStorageConnectionRequest,
} from './protocol.ts'

const SECRET_ID = credentialRef(SECRET_ID_REF)
const SECRET_KEY = credentialRef(SECRET_KEY_REF)
const API_CONFIG = '/api/dsh-cos/config'
const API_TEST_CONNECTION = '/api/dsh-cos/test-connection'
const API_LIST_OBJECTS = '/api/dsh-cos/objects/list'

interface HostDependencies extends Context {
  credentials: Context['credentials']
  webServer: Context['webServer']
}

interface ConfigSource {
  get(): Config
  replace(config: Config): Promise<void>
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

function parseSaveRequest(value: unknown): SaveCosStorageConfigRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  return {
    bucket: stringField(value, 'bucket', true)!,
    region: stringField(value, 'region', true)!,
    prefix: stringField(value, 'prefix', false),
    customDomain: stringField(value, 'customDomain', false),
    secretId: stringField(value, 'secretId', false),
    secretKey: stringField(value, 'secretKey', false),
  }
}

function parseTestRequest(value: unknown): TestCosStorageConnectionRequest {
  return parseSaveRequest(value)
}

function parseListRequest(value: unknown): CosStorageListRequest {
  if (!isRecord(value)) throw new HttpError(400, 'invalid-request', '请求内容格式不正确。')
  return {
    path: stringField(value, 'path', false),
    marker: stringField(value, 'marker', false),
  }
}

function requireConfiguredConfig(source: ConfigSource): Config {
  const config = source.get()
  if (config.bucket.trim() === '' || config.region.trim() === '') {
    throw new HttpError(409, 'config-required', '请先在“设置 > 插件 > COS 云存储”中配置 COS 存储桶和地域。')
  }
  return normalizeConfig(config)
}

function configView(config: Config, secretId: CredentialInfo, secretKey: CredentialInfo): CosStorageConfigView {
  const sameSource = secretId.source !== undefined && secretId.source === secretKey.source
  return {
    ...config,
    secretIdConfigured: secretId.configured,
    secretKeyConfigured: secretKey.configured,
    credentialsWritable: secretId.writable && secretKey.writable,
    ...(sameSource ? { credentialSource: secretId.source } : {}),
  }
}

async function describeConfig(ctx: HostDependencies, source: ConfigSource): Promise<CosStorageConfigResponse> {
  const [secretId, secretKey] = await Promise.all([
    ctx.credentials.describe(SECRET_ID),
    ctx.credentials.describe(SECRET_KEY),
  ])
  return { ok: true, config: configView(source.get(), secretId, secretKey) }
}

async function resolveCredentials(
  ctx: HostDependencies,
  input: { secretId?: string; secretKey?: string },
): Promise<{ secretId: string; secretKey: string }> {
  const suppliedSecretId = normalizeSecret(input.secretId, 'SecretId')
  const suppliedSecretKey = normalizeSecret(input.secretKey, 'SecretKey')
  const [storedSecretId, storedSecretKey] = await Promise.all([
    suppliedSecretId === undefined ? ctx.credentials.resolve(SECRET_ID) : Promise.resolve(undefined),
    suppliedSecretKey === undefined ? ctx.credentials.resolve(SECRET_KEY) : Promise.resolve(undefined),
  ])
  const secretId = suppliedSecretId ?? storedSecretId?.value
  const secretKey = suppliedSecretKey ?? storedSecretKey?.value
  if (!secretId || !secretKey) {
    throw new HttpError(400, 'credentials-missing', '请填写 SecretId 和 SecretKey。')
  }
  return { secretId, secretKey }
}

async function saveConfig(ctx: HostDependencies, source: ConfigSource, input: SaveCosStorageConfigRequest): Promise<void> {
  const config = normalizeConfig(input)
  await resolveCredentials(ctx, input)
  const secretId = normalizeSecret(input.secretId, 'SecretId')
  const secretKey = normalizeSecret(input.secretKey, 'SecretKey')
  const [oldSecretId, oldSecretKey] = await Promise.all([
    secretId === undefined ? Promise.resolve(undefined) : ctx.credentials.resolve(SECRET_ID),
    secretKey === undefined ? Promise.resolve(undefined) : ctx.credentials.resolve(SECRET_KEY),
  ])

  let secretIdChanged = false
  let secretKeyChanged = false
  try {
    if (secretId !== undefined) {
      await ctx.credentials.set(SECRET_ID, secretId)
      secretIdChanged = true
    }
    if (secretKey !== undefined) {
      await ctx.credentials.set(SECRET_KEY, secretKey)
      secretKeyChanged = true
    }
    await source.replace(config)
  } catch (error) {
    await Promise.allSettled([
      secretIdChanged
        ? (oldSecretId === undefined ? ctx.credentials.unset(SECRET_ID) : ctx.credentials.set(SECRET_ID, oldSecretId.value))
        : Promise.resolve(),
      secretKeyChanged
        ? (oldSecretKey === undefined ? ctx.credentials.unset(SECRET_KEY) : ctx.credentials.set(SECRET_KEY, oldSecretKey.value))
        : Promise.resolve(),
    ])
    throw error
  }
}

export function registerHostRoutes(ctx: HostDependencies, source: ConfigSource): () => void {
  const disposers: Array<() => void> = []
  const uploadTasks = new UploadTaskManager()
  try {
    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: API_CONFIG,
      handler: async (request, response) => {
        try {
          const method = (request.method ?? 'GET').toUpperCase()
          if (method === 'GET') {
            assertSafeRequest(request, 'GET')
            sendJson(response, 200, await describeConfig(ctx, source))
            return
          }
          assertSafeRequest(request, 'POST')
          await saveConfig(ctx, source, parseSaveRequest(await readJsonBody(request)))
          sendJson(response, 200, await describeConfig(ctx, source))
        } catch (error) {
          sendError(response, error)
        }
      },
    }))

    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: API_TEST_CONNECTION,
      handler: async (request, response) => {
        try {
          assertSafeRequest(request, 'POST')
          const input = parseTestRequest(await readJsonBody(request))
          const config = normalizeConfig(input)
          const credentials = await resolveCredentials(ctx, input)
          try {
            await testCosConnection(config, credentials)
          } catch (error) {
            throw new HttpError(502, 'cos-connection-failed', describeCosError(error))
          }
          const body: CosStorageConnectionResponse = { ok: true, message: '连接成功，可以访问该存储桶。' }
          sendJson(response, 200, body)
        } catch (error) {
          sendError(response, error)
        }
      },
    }))

    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: API_LIST_OBJECTS,
      handler: async (request, response) => {
        try {
          assertSafeRequest(request, 'POST')
          const input = parseListRequest(await readJsonBody(request))
          const config = requireConfiguredConfig(source)
          const path = normalizeStoragePath(input.path)
          const marker = normalizeListMarker(input.marker, `${config.prefix}${path}`)
          const credentials = await resolveCredentials(ctx, {})
          let result
          try {
            result = await listCosObjects(config, credentials, path, marker)
          } catch (error) {
            throw new HttpError(502, 'cos-list-failed', describeCosError(error))
          }
          const body: CosStorageListResponse = {
            ok: true,
            bucket: config.bucket,
            region: config.region,
            rootPrefix: config.prefix,
            customDomain: config.customDomain,
            path,
            items: result.items,
            ...(result.nextMarker === undefined ? {} : { nextMarker: result.nextMarker }),
          }
          sendJson(response, 200, body)
        } catch (error) {
          sendError(response, error)
        }
      },
    }))

    const uploadServices = {
      getConfig: () => requireConfiguredConfig(source),
      getCredentials: () => resolveCredentials(ctx, {}),
    }
    disposers.push(registerOperationRoutes(ctx, uploadServices, uploadTasks))
    disposers.push(registerLocalUploadRoutes(ctx, uploadServices, uploadTasks))
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    throw error
  }
  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}
