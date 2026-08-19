import type { Context } from '@deepseek-ai/cordis'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-tools'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  Config as ConfigSchema,
  DEFAULT_CONFIG,
  SECRET_ID_REF,
  SECRET_KEY_REF,
  SETTINGS_NAMESPACE,
  type Config,
} from './config.ts'
import { registerAttachmentRoutes } from './attachment-routes.ts'
import { registerHostRoutes } from './host.ts'
import { registerTencentCloudCosSkill } from './tencentcloud-skill.ts'
import { registerTencentCloudManagementTools } from './tencentcloud-tools.ts'

export { ConfigSchema as Config }

export const inject = ['credentials', 'settings', 'webServer', 'sessions', 'skills', 'tools']

const NAMESPACE = settingsNamespace(SETTINGS_NAMESPACE)

export function apply(ctx: Context, entry: Config = DEFAULT_CONFIG): void {
  let getConfig = (): Config => ({ ...DEFAULT_CONFIG, ...entry })

  installSettingsSection(ctx, NAMESPACE, ConfigSchema, getConfig(), {
    setSource(source) {
      getConfig = source
    },
    onChange() {},
  })

  ctx.inject(['credentials', 'settings', 'webServer', 'sessions', 'skills', 'tools'], (hostCtx) => {
    const services = {
      get: () => ({ ...DEFAULT_CONFIG, ...getConfig() }),
      replace: (config: Config) => hostCtx.settings.replace(NAMESPACE, config),
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
    hostCtx.effect(() => registerAttachmentRoutes(hostCtx, {
      getConfig: services.get,
      getCredentials: async () => {
        const secretId = await hostCtx.credentials.resolve(SECRET_ID_REF as CredentialRef)
        const secretKey = await hostCtx.credentials.resolve(SECRET_KEY_REF as CredentialRef)
        if (secretId?.value === undefined || secretKey?.value === undefined) {
          throw new Error('COS credentials are not configured')
        }
        return { secretId: secretId.value, secretKey: secretKey.value }
      },
    }), 'dsh-cos: Session attachment routes')
  })
}
