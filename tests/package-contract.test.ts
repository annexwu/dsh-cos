import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type PackageManifest = {
  name: string
  repository: { type: string; url: string }
  homepage: string
  bugs: { url: string }
  publishConfig: { access: string; registry: string }
  main: string
  types: string
  exports: Record<string, unknown>
  files: string[]
  scripts: Record<string, string>
  dsh: { bundle: { patch: string } }
}

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as PackageManifest

describe('public npm package contract', () => {
  it('links consumers to the public repository and npm registry', () => {
    expect(manifest.name).toBe('dsh-cos')
    expect(manifest.repository).toEqual({ type: 'git', url: 'git+https://github.com/annexwu/dsh-cos.git' })
    expect(manifest.homepage).toBe('https://github.com/annexwu/dsh-cos#readme')
    expect(manifest.bugs.url).toBe('https://github.com/annexwu/dsh-cos/issues')
    expect(manifest.publishConfig).toEqual({ access: 'public', registry: 'https://registry.npmjs.org/' })
  })

  it('includes all runtime entrypoints and bundled plugin resources in npm releases', () => {
    expect(manifest.main).toBe('lib/index.js')
    expect(manifest.types).toBe('lib/types/index.d.ts')
    expect(manifest.exports).toMatchObject({
      '.': { types: './lib/types/index.d.ts', default: './lib/index.js' },
      './client': { types: './lib/types/client/index.d.ts', default: './lib/client.js' },
    })
    expect(manifest.files).toEqual(expect.arrayContaining([
      'lib/index.js',
      'lib/client.js',
      'lib/types',
      'runtime/tencentcloud-cos',
      'skills/tencentcloud-cos',
      'cordis.patch.yml',
      'README.md',
    ]))
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
  })

  it('builds package artifacts before GitHub or npm installation', () => {
    expect(manifest.scripts.prepare).toBe('pnpm run build')
    expect(manifest.scripts.build).toContain('tsc -p tsconfig.build.json')
    expect(manifest.scripts.build).toContain('tsdown')
  })
})
