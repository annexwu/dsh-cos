export interface CosStorageConfigView {
  bucket: string
  region: string
  prefix: string
  customDomain: string
  secretIdConfigured: boolean
  secretKeyConfigured: boolean
  credentialsWritable: boolean
  credentialSource?: string
}

export interface SaveCosStorageConfigRequest {
  bucket: string
  region: string
  prefix?: string
  customDomain?: string
  secretId?: string
  secretKey?: string
}

export interface TestCosStorageConnectionRequest {
  bucket: string
  region: string
  prefix?: string
  customDomain?: string
  secretId?: string
  secretKey?: string
}

export interface CosStorageConfigResponse {
  ok: true
  config: CosStorageConfigView
}

export interface CosStorageConnectionResponse {
  ok: true
  message: string
}

export interface CosStorageListRequest {
  path?: string
  marker?: string
}

export interface CosStorageItem {
  kind: 'folder' | 'file'
  name: string
  key: string
  path: string
  size: number
  lastModified?: string
  eTag?: string
  storageClass?: string
}

export interface CosStorageListResponse {
  ok: true
  bucket: string
  region: string
  rootPrefix: string
  customDomain: string
  path: string
  items: CosStorageItem[]
  nextMarker?: string
}

export interface CreateCosFolderRequest {
  path?: string
  name: string
}

export interface CreateCosFolderResponse {
  ok: true
  name: string
  key: string
  path: string
}

export type CosUploadStatus = 'queued' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled'

export type CosUploadSource = 'browser' | 'local'

export interface CosUploadTask {
  id: string
  name: string
  path: string
  key: string
  size: number
  source?: CosUploadSource
  uploadedBytes: number
  status: CosUploadStatus
  speedBytesPerSecond: number
  error?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  finishedAt?: string
}

export interface CreateCosUploadTaskRequest {
  path?: string
  name: string
  size: number
  contentType?: string
  overwrite?: boolean
}

export interface CreateCosUploadTaskResponse {
  ok: true
  task: CosUploadTask
  uploadUrl: string
}

export interface CosUploadTaskListResponse {
  ok: true
  tasks: CosUploadTask[]
}

export interface CosUploadTaskActionRequest {
  taskId: string
}

export interface CosUploadTaskActionResponse {
  ok: true
  task?: CosUploadTask
  removed?: number
}

export interface CosUploadCompleteResponse {
  ok: true
  task: CosUploadTask
}

export type CosObjectUrlDomain = 'default' | 'custom'

export interface CosObjectActionRequest {
  kind: 'folder' | 'file'
  key: string
  download?: boolean
  expiresSeconds?: number
  domain?: CosObjectUrlDomain
}

export interface CosObjectUrlResponse {
  ok: true
  url: string
  expiresAt: string
}

export type CosPreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'ci-document' | 'ci-unavailable' | 'unsupported'

export interface CosObjectPreviewRequest {
  kind: 'file'
  key: string
}

export interface CosObjectPreviewResponse {
  ok: true
  kind: CosPreviewKind
  url?: string
  text?: string
  message?: string
}

export interface DeleteCosObjectResponse {
  ok: true
  deleted: number
}

export interface CosAttachmentOrigin {
  bucket: string
  region: string
  key: string
}

export interface SessionAttachment {
  path: string
  name: string
  size: number
  source: 'local' | 'cos'
  isDirectory: boolean
  cos?: CosAttachmentOrigin
}

export interface CreateLocalAttachmentResponse {
  ok: true
  attachment: SessionAttachment
}

export interface CreateLocalAttachmentRequest {
  sessionId: string
}

export interface ListCosAttachmentRequest {
  sessionId: string
  path?: string
  marker?: string
}

export interface ListCosAttachmentResponse {
  ok: true
  path: string
  items: CosStorageItem[]
  nextMarker?: string
}

export interface ImportCosAttachmentRequest {
  sessionId: string
  key: string
  kind: 'file' | 'folder'
}

export interface ImportCosAttachmentResponse {
  ok: true
  attachment: SessionAttachment
}

export interface DeleteSessionAttachmentRequest {
  sessionId: string
  path: string
}

export type LocalUploadEntryKind = 'file' | 'folder'

export interface LocalUploadEntry {
  id: string
  name: string
  kind: LocalUploadEntryKind
  size: number
  modifiedAt?: string
}

export interface BrowseLocalUploadRequest {
  sessionId: string
  currentPath?: string
  action: 'current' | 'up' | 'enter' | 'root'
  name?: string
  root?: string
}

export interface BrowseLocalUploadResponse {
  ok: true
  currentPath: string
  roots: string[]
  entries: LocalUploadEntry[]
}

export type LocalUploadConflictMode = 'ask' | 'overwrite' | 'skip'

export interface StartLocalUploadRequest {
  sessionId: string
  currentPath: string
  itemIds: string[]
  destinationPath?: string
  conflictMode: LocalUploadConflictMode
}

export interface StartLocalUploadResponse {
  ok: true
  accepted: number
  skipped: number
  conflicts: string[]
  tasks: CosUploadTask[]
}

export interface CosStorageErrorResponse {
  ok: false
  error: {
    code: string
    message: string
  }
}

export type CosStorageApiResponse<T> = T | CosStorageErrorResponse
