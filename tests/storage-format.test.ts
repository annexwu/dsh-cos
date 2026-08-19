import { describe, expect, it } from 'vitest'
import { fileExtension, formatBytes, formatDuration, formatStorageClass } from '../src/client/storage-format.ts'

describe('storage display formatting', () => {
  it('formats byte sizes without losing unit context', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(2048)).toBe('2.00 KB')
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.00 GB')
  })

  it('maps known storage classes and preserves unknown values', () => {
    expect(formatStorageClass('STANDARD_IA')).toBe('低频存储')
    expect(formatStorageClass('CUSTOM')).toBe('CUSTOM')
  })

  it('formats elapsed upload time for both languages', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(62_000)).toBe('01:02')
    expect(formatDuration(3_662_000)).toBe('01:01:02')
  })

  it('extracts normalized file extensions', () => {
    expect(fileExtension('photo.JPG')).toBe('jpg')
    expect(fileExtension('.gitignore')).toBe('')
  })
})
