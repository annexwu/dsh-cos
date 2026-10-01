import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-settings'
import {
  Config as ConfigSchema,
  DEFAULT_CONFIG,
  SECRET_ID_REF,
  SECRET_KEY_REF,
  SETTINGS_NAMESPACE,
  snapshotConfig,
  type Config,
  type LiveConfig,
} from './config.ts'
import { registerAttachmentRoutes } from './attachment-routes.ts'
import { CosAttachmentStore } from './cos-attachment-store.ts'
import { registerHostRoutes } from './host.ts'
import { legacyCosSettings } from './legacy-settings.ts'
import { registerTencentCloudCosSkill } from './tencentcloud-skill.ts'
import { registerTencentCloudManagementTools } from './tencentcloud-tools.ts'

export { ConfigSchema as Config }

export const inject = ['credentials']

export function apply(ctx: Context, entry: LiveConfig): void {
  const getConfig = (): Config => ({ ...DEFAULT_CONFIG, ...snapshotConfig(entry) })

  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber), 'dsh-cos: custom settings page')
    settingsCtx.effect(() => {
      let disposed = false
      void ctx.root.loader.await().then(async () => {
        if (disposed) return
        const legacy = await legacyCosSettings(resolveDshHome(), getConfig())
        if (disposed || Object.keys(legacy).length === 0) return
        const descriptor = settingsCtx.settings.describe().find(item => item.ns === SETTINGS_NAMESPACE)
        if (descriptor === undefined) return
        const own = descriptor.user
        const user = typeof own === 'object' && own !== null ? own as Record<string, unknown> : {}
        const fields = Object.fromEntries(Object.entries(legacy).filter(([key]) => !Object.hasOwn(user, key)))
        if (Object.keys(fields).length > 0) await settingsCtx.settings.update(SETTINGS_NAMESPACE, fields)
      }).catch(() => { ctx.logger.warn('dsh-cos: legacy settings migration failed; check profile configuration manually') })
      return () => { disposed = true }
    }, 'dsh-cos: legacy settings migration')
  })

  ctx.plugin(CosAttachmentStore, {
    getConfig: () => ({ ...DEFAULT_CONFIG, ...getConfig() }),
    getCredentials: async () => {
      const secretId = await ctx.credentials.resolve(SECRET_ID_REF as CredentialRef)
      const secretKey = await ctx.credentials.resolve(SECRET_KEY_REF as CredentialRef)
      if (secretId?.value === undefined || secretKey?.value === undefined) {
        throw new Error('Configure COS credentials before storing conversation images in COS.')
      }
      return { secretId: secretId.value, secretKey: secretKey.value }
    },
  })

  ctx.inject(['connection', 'credentials', 'settings', 'webServer', 'skills', 'tools'], (hostCtx) => {
    const services = {
      get: () => ({ ...DEFAULT_CONFIG, ...getConfig() }),
      replace: async (config: Config) => { await hostCtx.settings.replace(SETTINGS_NAMESPACE, config) },
    }
    const getCredentials = async () => {
      const secretId = await hostCtx.credentials.resolve(SECRET_ID_REF as CredentialRef)
      const secretKey = await hostCtx.credentials.resolve(SECRET_KEY_REF as CredentialRef)
      if (secretId?.value === undefined || secretKey?.value === undefined) {
        throw new Error('Configure COS credentials before using COS tools.')
      }
      return { secretId: secretId.value, secretKey: secretKey.value }
    }
    const managementToolServices = { getConfig: services.get, getCredentials }
    hostCtx.effect(() => registerTencentCloudManagementTools(hostCtx, managementToolServices), 'dsh-cos: Tencent Cloud management tools')
    hostCtx.effect(() => registerTencentCloudCosSkill(hostCtx), 'dsh-cos: Tencent Cloud COS Skill')
    hostCtx.effect(() => registerHostRoutes(hostCtx, services), 'dsh-cos: Host API routes')
  })

  ctx.inject(['connection', 'credentials', 'webServer', 'sessions'], (sessionCtx) => {
    sessionCtx.effect(() => registerAttachmentRoutes(sessionCtx, {
      getConfig,
      getCredentials: async () => {
        const secretId = await sessionCtx.credentials.resolve(SECRET_ID_REF as CredentialRef)
        const secretKey = await sessionCtx.credentials.resolve(SECRET_KEY_REF as CredentialRef)
        if (secretId?.value === undefined || secretKey?.value === undefined) {
          throw new Error('COS credentials are not configured')
        }
        return { secretId: secretId.value, secretKey: secretKey.value }
      },
    }), 'dsh-cos: Session attachment routes')
  })
}
