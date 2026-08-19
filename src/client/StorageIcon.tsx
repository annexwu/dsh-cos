import React from 'react'
import type { CosStorageItem } from '../protocol.ts'
import { fileExtension } from './storage-format.ts'

interface StorageIconProps {
  item: CosStorageItem
}

const IMAGE_EXTENSIONS = new Set(['bmp', 'gif', 'heic', 'ico', 'jpeg', 'jpg', 'png', 'psd', 'svg', 'tif', 'tiff', 'webp'])
const VIDEO_EXTENSIONS = new Set(['3gp', 'amv', 'avi', 'flv', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'ogv', 'rmvb', 'webm', 'wmv'])
const AUDIO_EXTENSIONS = new Set(['aac', 'aiff', 'ape', 'cda', 'flac', 'm4a', 'mid', 'midi', 'mp3', 'ogg', 'opus', 'wav', 'wma'])
const ARCHIVE_EXTENSIONS = new Set(['7z', 'bz', 'bz2', 'cab', 'dmg', 'gz', 'iso', 'rar', 'tar', 'tgz', 'zip'])
const DOCUMENT_EXTENSIONS = new Set(['doc', 'docm', 'docx', 'dot', 'dotm', 'dotx', 'mht', 'odt', 'rtf', 'wps', 'wpt'])
const SPREADSHEET_EXTENSIONS = new Set(['csv', 'et', 'ett', 'ods', 'xls', 'xlsb', 'xlsm', 'xlsx', 'xlt', 'xltm', 'xltx'])
const PRESENTATION_EXTENSIONS = new Set(['dps', 'dpt', 'odp', 'pot', 'potm', 'potx', 'pps', 'ppsm', 'ppsx', 'ppt', 'pptm', 'pptx'])
const TEXT_EXTENSIONS = new Set(['log', 'readme', 'text', 'txt'])
const CONFIG_EXTENSIONS = new Set(['cfg', 'conf', 'config', 'env', 'ini', 'properties', 'toml'])
const CODE_EXTENSIONS = new Set(['bat', 'c', 'cc', 'cpp', 'cs', 'css', 'go', 'h', 'hpp', 'html', 'java', 'js', 'json', 'jsx', 'md', 'mjs', 'php', 'py', 'rb', 'rs', 'sh', 'sql', 'ts', 'tsx', 'vue', 'xml', 'yaml', 'yml'])

type IconKind = 'folder' | 'pdf' | 'image' | 'video' | 'audio' | 'archive' | 'document' | 'spreadsheet' | 'presentation' | 'text' | 'config' | 'code' | 'file'

function iconKind(item: CosStorageItem): IconKind {
  if (item.kind === 'folder') return 'folder'
  const extension = fileExtension(item.name)
  if (extension === 'pdf' || extension === 'xps') return 'pdf'
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio'
  if (ARCHIVE_EXTENSIONS.has(extension)) return 'archive'
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document'
  if (SPREADSHEET_EXTENSIONS.has(extension)) return 'spreadsheet'
  if (PRESENTATION_EXTENSIONS.has(extension)) return 'presentation'
  if (TEXT_EXTENSIONS.has(extension)) return 'text'
  if (CONFIG_EXTENSIONS.has(extension)) return 'config'
  if (CODE_EXTENSIONS.has(extension)) return 'code'
  return 'file'
}

function FolderIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path fill="#b8c9ff" d="M6 17a6 6 0 0 1 6-6h15l6 7h18a7 7 0 0 1 7 7v22a7 7 0 0 1-7 7H13a7 7 0 0 1-7-7V17Z" />
      <path fill="#8da9ff" d="M6 25h52v22a7 7 0 0 1-7 7H13a7 7 0 0 1-7-7V25Z" />
      <path fill="#7899fb" d="M6 29h52v18a7 7 0 0 1-7 7H13a7 7 0 0 1-7-7V29Z" opacity=".55" />
    </svg>
  )
}

function FileShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path fill="#fff" stroke="#d9dfe8" strokeWidth="1.5" d="M15 5h23l12 12v36a6 6 0 0 1-6 6H15a6 6 0 0 1-6-6V11a6 6 0 0 1 6-6Z" />
      <path fill="#eef2f7" stroke="#d9dfe8" strokeWidth="1.2" d="M38 5v12h12Z" />
      {children}
    </svg>
  )
}

function FileGlyph({ kind }: { kind: Exclude<IconKind, 'folder'> }): React.JSX.Element {
  if (kind === 'pdf') return <FileShell><path fill="#ef6b62" d="M15 36h34v13H15z" /><path fill="#fff" d="M27 39h3c2 0 3 1 3 2s-1 2-3 2h-3zm8 0h7v2h-4v1h3v2h-6z" /></FileShell>
  if (kind === 'document') return <FileShell><path fill="#5b8ee7" d="M17 34h30v15H17z" /><path fill="#fff" d="m22 38 3 7 3-4 3 4 3-7h-3l-1 3-2-3-2 3-1-3zm14 0h7v2h-7zm0 4h6v2h-6z" /></FileShell>
  if (kind === 'spreadsheet') return <FileShell><rect x="18" y="34" width="28" height="15" rx="1" fill="#4caf7a" /><path fill="#fff" d="M22 37h20v2H22zm0 4h20v2H22zm6-5h2v11h-2zm6 0h2v11h-2z" /></FileShell>
  if (kind === 'presentation') return <FileShell><path fill="#ed9b53" d="M17 34h30v15H17z" /><rect x="21" y="37" width="14" height="8" rx="1" fill="#fff" /><path fill="#fff" d="M38 38h5v2h-5zm0 4h5v2h-5z" /></FileShell>
  if (kind === 'image') return <FileShell><rect x="17" y="34" width="30" height="15" rx="1.5" fill="#76b97a" /><circle cx="39" cy="39" r="2.3" fill="#fff" /><path fill="#fff" d="m20 46 7-7 5 4 4-3 8 6z" /></FileShell>
  if (kind === 'video') return <FileShell><circle cx="32" cy="42" r="10" fill="#7388dd" /><path fill="#fff" d="m29 36 9 6-9 6z" /></FileShell>
  if (kind === 'audio') return <FileShell><path fill="#8c74ce" d="M25 35h4v10.5a5 5 0 1 1-3-4.6V37l11-2v8.5a5 5 0 1 1-3-4.6V35l-9 1.5z" /></FileShell>
  if (kind === 'archive') return <FileShell><path fill="#c5a060" d="M23 33h18v18H23z" /><path fill="#f8ebc9" d="M30 33h4v18h-4z" /><path fill="#9f7c40" d="M30 37h4v3h-4zm0 6h4v3h-4z" /></FileShell>
  if (kind === 'code') return <FileShell><path fill="#7494b8" d="m27 36-7 6 7 6 2-2-5-4 5-4zm10 0-2 2 5 4-5 4 2 2 7-6zM30 49h3l4-15h-3z" /></FileShell>
  if (kind === 'text') return <FileShell><path fill="#91a0b3" d="M19 35h26v2H19zm0 5h26v2H19zm0 5h19v2H19z" /></FileShell>
  if (kind === 'config') return <FileShell><path fill="#8c85ba" d="M31 34h3l1 3 3 1 3-1 2 2-1 3 1 3-2 2-3-1-3 1-1 3h-3l-1-3-3-1-3 1-2-2 1-3-1-3 2-2 3 1 3-1zm1.5 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" /></FileShell>
  return <FileShell><path fill="#a2acbc" d="M19 36h26v2H19zm0 5h26v2H19zm0 5h16v2H19z" /></FileShell>
}

export function StorageIcon({ item }: StorageIconProps): React.JSX.Element {
  const kind = iconKind(item)
  return kind === 'folder' ? <FolderIcon /> : <FileGlyph kind={kind} />
}
