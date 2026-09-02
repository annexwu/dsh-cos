import z from '@deepseek-ai/schemastery'

export const SETTINGS_NAMESPACE = 'dsh-cos'
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

export const Config: z<Config> = z.object({
  bucket: z.string().default(''),
  region: z.string().default(''),
  prefix: z.string().default(''),
  customDomain: z.string().default(''),
  attachmentEnabled: z.boolean().default(true),
  attachmentDirectory: z.string().default(DEFAULT_ATTACHMENT_DIRECTORY),
  attachmentReadRoots: z.string().default(''),
  attachmentReadOrigins: z.string().default(''),
})

export const DEFAULT_CONFIG: Config = {
  bucket: '',
  region: '',
  prefix: '',
  customDomain: '',
  attachmentEnabled: true,
  attachmentDirectory: DEFAULT_ATTACHMENT_DIRECTORY,
}
