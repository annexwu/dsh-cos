import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

interface PackageManifest {
  version?: unknown
}

const require = createRequire(import.meta.url)

function manifestVersion(manifest: unknown): string | undefined {
  if (typeof manifest !== 'object' || manifest === null) return undefined
  const version = (manifest as PackageManifest).version
  return typeof version === 'string' && version.trim() !== '' ? version.trim() : undefined
}

function readPluginVersion(): string {
  const manifests: Array<URL | string> = [
    new URL('../package.json', import.meta.url),
    resolve(process.cwd(), 'package.json'),
  ]
  for (const manifest of manifests) {
    try {
      const version = manifestVersion(JSON.parse(readFileSync(manifest, 'utf8')))
      if (version !== undefined) return version
    } catch {
      // Try the next runtime-compatible manifest location.
    }
  }
  return 'unknown'
}

function readDependencyVersion(packageName: string): string {
  try {
    return manifestVersion(require(`${packageName}/package.json`)) ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

function operatingSystem(platform: NodeJS.Platform): string {
  if (platform === 'win32') return 'windows'
  if (platform === 'darwin') return 'macos'
  if (platform === 'linux') return 'linux'
  return platform
}

export function buildDshCosUserAgent(
  pluginVersion = readPluginVersion(),
  dshVersion = readDependencyVersion('@deepseek-ai/dsh-tools'),
  sdkVersion = readDependencyVersion('cos-nodejs-sdk-v5'),
  platform: NodeJS.Platform = process.platform,
  architecture = process.arch,
): string {
  return `dsh-cos/${pluginVersion} dsh/${dshVersion} cos-nodejs-sdk-v5/${sdkVersion} os/${operatingSystem(platform)}-${architecture}`
}

export const DSH_COS_USER_AGENT = buildDshCosUserAgent()
