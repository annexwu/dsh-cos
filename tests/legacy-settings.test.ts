import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/config.ts'
import { legacyCosSettings } from '../src/legacy-settings.ts'

const directories: string[] = []
async function home(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-cos-settings-'))
  directories.push(dir)
  return dir
}
afterEach(async () => { await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

describe('DSH 0.1.2 COS settings migration', () => {
  it('reads old values from the backup without overwriting existing profile values', async () => {
    const dir = await home()
    await writeFile(join(dir, 'settings.yaml.imported'), 'dsh-cos:\n  bucket: old-bucket\n  region: ap-shanghai\n  prefix: archive/\n  attachmentEnabled: false\n  attachmentReadOrigins: "[\\\"old\\\"]"\n')
    expect(await legacyCosSettings(dir, { ...DEFAULT_CONFIG, region: 'ap-beijing' })).toEqual({
      bucket: 'old-bucket', prefix: 'archive/', attachmentEnabled: false, attachmentReadOrigins: '["old"]',
    })
  })

  it('falls back to the original settings when the imported backup has no COS section', async () => {
    const dir = await home()
    await writeFile(join(dir, 'settings.yaml.imported'), 'ui-theme:\n  preference: dark\n')
    await writeFile(join(dir, 'settings.yaml'), 'dsh-cos:\n  bucket: old-bucket\n  region: ap-guangzhou\n')
    expect(await legacyCosSettings(dir, DEFAULT_CONFIG)).toMatchObject({ bucket: 'old-bucket', region: 'ap-guangzhou' })
  })

  it('does nothing if legacy file or COS section does not exist', async () => {
    const dir = await home()
    expect(await legacyCosSettings(dir, DEFAULT_CONFIG)).toEqual({})
    await writeFile(join(dir, 'settings.yaml'), 'ui-theme:\n  preference: dark\n')
    expect(await legacyCosSettings(dir, DEFAULT_CONFIG)).toEqual({})
  })
})
