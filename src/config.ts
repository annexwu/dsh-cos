import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export const SETTINGS_NAMESPACE = 'ui-dsh-cos'
export const LEGACY_SETTINGS_NAMESPACE = 'dsh-cos'
export const SECRET_ID_REF = 'DSH_COS_SECRET_ID'
export const SECRET_KEY_REF = 'DSH_COS_SECRET_KEY'

export const DEFAULT_ATTACHMENT_DIRECTORY = 'dsh-attachments/'

export interface Config {
  bucket: string
  region: string
  prefix: string
  customDomain: string
  attachmentEnabled: boolean
  attachmentDirectory: string
  /** Legacy same-bucket fallback roots, migrated to attachmentReadOrigins on save. */
  attachmentReadRoots?: string
  /** Internal JSON record of previous attachment storage locations. */
  attachmentReadOrigins?: string
}

export interface LiveConfig {
  bucket: Volatile<string>
  region: Volatile<string>
  prefix: Volatile<string>
  customDomain: Volatile<string>
  attachmentEnabled: Volatile<boolean>
  attachmentDirectory: Volatile<string>
  attachmentReadRoots: Volatile<string>
  attachmentReadOrigins: Volatile<string>
}

export const Config = z.object({
  bucket: z.string().default('').volatile(),
  region: z.string().default('').volatile(),
  prefix: z.string().default('').volatile(),
  customDomain: z.string().default('').volatile(),
  attachmentEnabled: z.boolean().default(true).volatile(),
  attachmentDirectory: z.string().default(DEFAULT_ATTACHMENT_DIRECTORY).volatile(),
  attachmentReadRoots: z.string().default('').volatile(),
  attachmentReadOrigins: z.string().default('').volatile(),
})

export function snapshotConfig(config: LiveConfig): Config {
  return {
    bucket: config.bucket.get(),
    region: config.region.get(),
    prefix: config.prefix.get(),
    customDomain: config.customDomain.get(),
    attachmentEnabled: config.attachmentEnabled.get(),
    attachmentDirectory: config.attachmentDirectory.get(),
    attachmentReadRoots: config.attachmentReadRoots.get(),
    attachmentReadOrigins: config.attachmentReadOrigins.get(),
  }
}

export const DEFAULT_CONFIG: Config = {
  bucket: '',
  region: '',
  prefix: '',
  customDomain: '',
  attachmentEnabled: true,
  attachmentDirectory: DEFAULT_ATTACHMENT_DIRECTORY,
}
