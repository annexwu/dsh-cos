import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'
import { DEFAULT_CONFIG, LEGACY_SETTINGS_NAMESPACE, type Config } from './config.ts'

const STRING_FIELDS = ['bucket', 'region', 'prefix', 'customDomain', 'attachmentDirectory', 'attachmentReadRoots', 'attachmentReadOrigins'] as const

export async function legacyCosSettings(home: string, current: Config): Promise<Partial<Config>> {
  for (const path of [join(home, 'settings.yaml.imported'), join(home, 'settings.yaml')]) {
    let document: string
    try {
      document = await readFile(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    let sections: unknown
    try {
      sections = parse(document)
    } catch {
      continue
    }
    if (typeof sections !== 'object' || sections === null || Array.isArray(sections)) continue
    const legacy: unknown = Reflect.get(sections, LEGACY_SETTINGS_NAMESPACE)
    if (typeof legacy !== 'object' || legacy === null || Array.isArray(legacy)) continue
    const result: Partial<Config> = {}
    for (const field of STRING_FIELDS) {
      const value: unknown = Reflect.get(legacy, field)
      if ((current[field] ?? '') === (DEFAULT_CONFIG[field] ?? '') && typeof value === 'string') result[field] = value
    }
    const enabled: unknown = Reflect.get(legacy, 'attachmentEnabled')
    if (current.attachmentEnabled === DEFAULT_CONFIG.attachmentEnabled && typeof enabled === 'boolean') {
      result.attachmentEnabled = enabled
    }
    return result
  }
  return {}
}
