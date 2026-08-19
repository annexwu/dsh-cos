import z from '@deepseek-ai/schemastery'

export const SETTINGS_NAMESPACE = 'dsh-cos'
export const SECRET_ID_REF = 'DSH_COS_SECRET_ID'
export const SECRET_KEY_REF = 'DSH_COS_SECRET_KEY'

export interface Config {
  bucket: string
  region: string
  prefix: string
  customDomain: string
}

export const Config: z<Config> = z.object({
  bucket: z.string().default(''),
  region: z.string().default(''),
  prefix: z.string().default(''),
  customDomain: z.string().default(''),
})

export const DEFAULT_CONFIG: Config = {
  bucket: '',
  region: '',
  prefix: '',
  customDomain: '',
}
