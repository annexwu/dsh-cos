export interface UploadCandidate {
  id: string
  groupId: string
  groupName: string
  file: File
  relativeDirectory: string
  displayPath: string
}

interface LegacyFileEntry {
  isFile: true
  isDirectory: false
  name: string
  file(success: (file: File) => void, failure?: (error: DOMException) => void): void
}

interface LegacyDirectoryReader {
  readEntries(success: (entries: LegacyEntry[]) => void, failure?: (error: DOMException) => void): void
}

interface LegacyDirectoryEntry {
  isFile: false
  isDirectory: true
  name: string
  createReader(): LegacyDirectoryReader
}

type LegacyEntry = LegacyFileEntry | LegacyDirectoryEntry

interface LegacyEntryProvider {
  webkitGetAsEntry?: () => LegacyEntry | null
}

function batchId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function cleanRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(segment => segment && segment !== '.' && segment !== '..').join('/')
}

function candidate(file: File, relativePath: string, batch: string): UploadCandidate {
  const cleanPath = cleanRelativePath(relativePath) || file.name
  const segments = cleanPath.split('/')
  const name = segments.pop() || file.name
  const relativeDirectory = segments.length === 0 ? '' : `${segments.join('/')}/`
  const isFolderSelection = segments.length > 0
  const rootName = isFolderSelection ? segments[0] : name
  return {
    id: `${batch}:${cleanPath}:${file.size}:${file.lastModified}`,
    groupId: `${batch}:${isFolderSelection ? `folder:${rootName}` : `file:${cleanPath}`}`,
    groupName: rootName,
    file,
    relativeDirectory,
    displayPath: cleanPath,
  }
}

export function candidatesFromFiles(files: File[], preserveRelativePath = true): UploadCandidate[] {
  const batch = batchId()
  return files.map(file => candidate(
    file,
    preserveRelativePath && file.webkitRelativePath ? file.webkitRelativePath : file.name,
    batch,
  ))
}

async function readFile(entry: LegacyFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

async function readDirectory(entry: LegacyDirectoryEntry): Promise<LegacyEntry[]> {
  const reader = entry.createReader()
  const entries: LegacyEntry[] = []
  while (true) {
    const batch = await new Promise<LegacyEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
    if (batch.length === 0) return entries
    entries.push(...batch)
  }
}

async function walkEntry(entry: LegacyEntry, parent: string, files: Array<{ file: File; path: string }>): Promise<void> {
  const path = parent ? `${parent}/${entry.name}` : entry.name
  if (entry.isFile) {
    files.push({ file: await readFile(entry), path })
    return
  }
  const children = await readDirectory(entry)
  for (const child of children) await walkEntry(child, path, files)
}

export async function candidatesFromDrop(dataTransfer: DataTransfer): Promise<UploadCandidate[]> {
  const entries = Array.from(dataTransfer.items ?? [])
    .map(item => (item as unknown as LegacyEntryProvider).webkitGetAsEntry?.())
    .filter((entry): entry is LegacyEntry => entry !== null && entry !== undefined)
  if (entries.length === 0) return candidatesFromFiles(Array.from(dataTransfer.files), false)

  const files: Array<{ file: File; path: string }> = []
  for (const entry of entries) await walkEntry(entry, '', files)
  const batch = batchId()
  return files.map(item => candidate(item.file, item.path, batch))
}

export interface UploadSelectionGroup {
  id: string
  name: string
  files: number
  size: number
  candidates: UploadCandidate[]
}

export function groupCandidates(candidates: UploadCandidate[]): UploadSelectionGroup[] {
  const groups = new Map<string, UploadSelectionGroup>()
  for (const item of candidates) {
    const group = groups.get(item.groupId)
    if (group) {
      group.files += 1
      group.size += item.file.size
      group.candidates.push(item)
    } else {
      groups.set(item.groupId, {
        id: item.groupId,
        name: item.groupName,
        files: 1,
        size: item.file.size,
        candidates: [item],
      })
    }
  }
  return Array.from(groups.values())
}
