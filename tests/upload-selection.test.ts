import { describe, expect, it } from 'vitest'
import { candidatesFromFiles, groupCandidates } from '../src/client/upload-selection.ts'

function folderFile(name: string, relativePath: string, size: number): File {
  const file = new File([new Uint8Array(size)], name, { type: 'text/plain', lastModified: 1 })
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

describe('upload selection', () => {
  it('preserves nested folder paths and groups files by selected root folder', () => {
    const candidates = candidatesFromFiles([
      folderFile('a.txt', 'project/a.txt', 2),
      folderFile('b.txt', 'project/src/b.txt', 3),
    ])
    expect(candidates.map(item => ({ path: item.displayPath, directory: item.relativeDirectory }))).toEqual([
      { path: 'project/a.txt', directory: 'project/' },
      { path: 'project/src/b.txt', directory: 'project/src/' },
    ])
    expect(groupCandidates(candidates)).toMatchObject([{
      name: 'project',
      files: 2,
      size: 5,
    }])
  })

  it('keeps individually selected files as separate upload objects', () => {
    const candidates = candidatesFromFiles([
      new File(['a'], 'a.txt'),
      new File(['b'], 'b.txt'),
    ], false)
    expect(groupCandidates(candidates).map(group => group.name)).toEqual(['a.txt', 'b.txt'])
    expect(candidates.every(item => item.relativeDirectory === '')).toBe(true)
  })

  it('removes traversal segments from browser-provided relative paths', () => {
    const [candidate] = candidatesFromFiles([folderFile('escape.txt', '../safe/escape.txt', 1)])
    expect(candidate.displayPath).toBe('safe/escape.txt')
    expect(candidate.relativeDirectory).toBe('safe/')
  })
})
