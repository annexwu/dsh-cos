import type {
  CosStorageApiResponse,
  CosStorageConfigResponse,
  CosStorageConnectionResponse,
  CosStorageListRequest,
  CosStorageListResponse,
  CosObjectActionRequest,
  CosObjectPreviewRequest,
  CosObjectPreviewResponse,
  CosObjectUrlResponse,
  CosUploadCompleteResponse,
  CosUploadTaskActionResponse,
  CosUploadTaskListResponse,
  BrowseLocalUploadRequest,
  BrowseLocalUploadResponse,
  CreateLocalAttachmentResponse,
  DeleteSessionAttachmentRequest,
  ImportCosAttachmentRequest,
  ImportCosAttachmentResponse,
  ListCosAttachmentRequest,
  ListCosAttachmentResponse,
  CreateCosFolderRequest,
  CreateCosFolderResponse,
  CreateCosUploadTaskRequest,
  CreateCosUploadTaskResponse,
  DeleteCosObjectResponse,
  SaveCosStorageConfigRequest,
  StartLocalUploadRequest,
  StartLocalUploadResponse,
  TestCosStorageConnectionRequest,
} from '../protocol.ts'

const API_CONFIG = '/api/dsh-cos/config'
const API_TEST_CONNECTION = '/api/dsh-cos/test-connection'
const API_LIST_OBJECTS = '/api/dsh-cos/objects/list'
const API_CREATE_FOLDER = '/api/dsh-cos/objects/folder'
const API_DOWNLOAD_OBJECT = '/api/dsh-cos/objects/download'
const API_OBJECT_URL = '/api/dsh-cos/objects/url'
const API_OBJECT_PREVIEW = '/api/dsh-cos/objects/preview'
const API_DELETE_OBJECT = '/api/dsh-cos/objects/delete'
const API_CREATE_UPLOAD = '/api/dsh-cos/uploads/create'
const API_LIST_UPLOADS = '/api/dsh-cos/uploads/list'
const API_PAUSE_UPLOAD = '/api/dsh-cos/uploads/pause'
const API_RESUME_UPLOAD = '/api/dsh-cos/uploads/resume'
const API_CANCEL_UPLOAD = '/api/dsh-cos/uploads/cancel'
const API_RETRY_UPLOAD = '/api/dsh-cos/uploads/retry'
const API_REMOVE_UPLOAD = '/api/dsh-cos/uploads/remove'
const API_CLEAR_UPLOADS = '/api/dsh-cos/uploads/clear-completed'
const API_LOCAL_ATTACHMENT = '/api/dsh-cos/attachments/local'
const API_LIST_COS_ATTACHMENT = '/api/dsh-cos/attachments/cos/list'
const API_IMPORT_COS_ATTACHMENT = '/api/dsh-cos/attachments/cos/import'
const API_DELETE_ATTACHMENT = '/api/dsh-cos/attachments/delete'
const API_BROWSE_LOCAL_UPLOAD = '/api/dsh-cos/local-upload/browse'
const API_START_LOCAL_UPLOAD = '/api/dsh-cos/local-upload/start'
const REQUEST_TIMEOUT_MS = 20_000
const ATTACHMENT_REQUEST_TIMEOUT_MS = 10 * 60_000

export class CosStorageApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'CosStorageApiError'
  }
}

async function request<T extends { ok: true }>(
  url: string,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
      signal: controller.signal,
    })
    let payload: CosStorageApiResponse<T>
    try {
      payload = await response.json() as CosStorageApiResponse<T>
    } catch {
      throw new CosStorageApiError('服务返回了无法识别的响应。', 'invalid-response')
    }
    if (!response.ok || ('ok' in payload && payload.ok === false)) {
      const error = 'error' in payload ? payload.error : undefined
      throw new CosStorageApiError(error?.message ?? '请求失败，请稍后重试。', error?.code ?? 'request-failed')
    }
    return payload as T
  } catch (error) {
    if (error instanceof CosStorageApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new CosStorageApiError('请求超时，请检查 DSH 服务状态。', 'request-timeout')
    }
    throw new CosStorageApiError('无法连接到 COS 云存储服务。', 'network-error')
  } finally {
    window.clearTimeout(timeout)
  }
}

export function loadConfig(): Promise<CosStorageConfigResponse> {
  return request<CosStorageConfigResponse>(API_CONFIG)
}

export function saveConfig(input: SaveCosStorageConfigRequest): Promise<CosStorageConfigResponse> {
  return request<CosStorageConfigResponse>(API_CONFIG, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function testConnection(input: TestCosStorageConnectionRequest): Promise<CosStorageConnectionResponse> {
  return request<CosStorageConnectionResponse>(API_TEST_CONNECTION, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function listObjects(input: CosStorageListRequest): Promise<CosStorageListResponse> {
  return request<CosStorageListResponse>(API_LIST_OBJECTS, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function createFolder(input: CreateCosFolderRequest): Promise<CreateCosFolderResponse> {
  return request<CreateCosFolderResponse>(API_CREATE_FOLDER, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function downloadObject(input: CosObjectActionRequest): Promise<Response> {
  const response = await fetch(API_DOWNLOAD_OBJECT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (response.ok && response.body !== null) return response
  let error: { error?: { code?: string; message?: string } } | undefined
  try {
    error = await response.json() as { error?: { code?: string; message?: string } }
  } catch {}
  throw new CosStorageApiError(error?.error?.message ?? '下载失败，请稍后重试。', error?.error?.code ?? 'download-failed')
}

export function previewObject(input: CosObjectPreviewRequest): Promise<CosObjectPreviewResponse> {
  return request<CosObjectPreviewResponse>(API_OBJECT_PREVIEW, {
    method: 'POST',
    body: JSON.stringify(input),
  }, ATTACHMENT_REQUEST_TIMEOUT_MS)
}

export function getObjectUrl(input: CosObjectActionRequest): Promise<CosObjectUrlResponse> {
  return request<CosObjectUrlResponse>(API_OBJECT_URL, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteObject(input: CosObjectActionRequest): Promise<DeleteCosObjectResponse> {
  return request<DeleteCosObjectResponse>(API_DELETE_OBJECT, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function createUploadTask(input: CreateCosUploadTaskRequest): Promise<CreateCosUploadTaskResponse> {
  return request<CreateCosUploadTaskResponse>(API_CREATE_UPLOAD, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function listUploadTasks(): Promise<CosUploadTaskListResponse> {
  return request<CosUploadTaskListResponse>(API_LIST_UPLOADS)
}

function taskAction(url: string, taskId: string): Promise<CosUploadTaskActionResponse> {
  return request<CosUploadTaskActionResponse>(url, {
    method: 'POST',
    body: JSON.stringify({ taskId }),
  })
}

export function pauseUploadTask(taskId: string): Promise<CosUploadTaskActionResponse> {
  return taskAction(API_PAUSE_UPLOAD, taskId)
}

export function resumeUploadTask(taskId: string): Promise<CosUploadTaskActionResponse> {
  return taskAction(API_RESUME_UPLOAD, taskId)
}

export function cancelUploadTask(taskId: string): Promise<CosUploadTaskActionResponse> {
  return taskAction(API_CANCEL_UPLOAD, taskId)
}

export function retryUploadTask(taskId: string): Promise<CosUploadTaskActionResponse> {
  return taskAction(API_RETRY_UPLOAD, taskId)
}

export function removeUploadTask(taskId: string): Promise<CosUploadTaskActionResponse> {
  return taskAction(API_REMOVE_UPLOAD, taskId)
}

export function clearCompletedUploadTasks(): Promise<CosUploadTaskActionResponse> {
  return request<CosUploadTaskActionResponse>(API_CLEAR_UPLOADS, {
    method: 'POST',
    body: '{}',
  })
}

export function browseLocalUpload(input: BrowseLocalUploadRequest): Promise<BrowseLocalUploadResponse> {
  return request<BrowseLocalUploadResponse>(API_BROWSE_LOCAL_UPLOAD, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function startLocalUpload(input: StartLocalUploadRequest): Promise<StartLocalUploadResponse> {
  return request<StartLocalUploadResponse>(API_START_LOCAL_UPLOAD, {
    method: 'POST',
    body: JSON.stringify(input),
  }, ATTACHMENT_REQUEST_TIMEOUT_MS)
}

export function listCosAttachmentObjects(input: ListCosAttachmentRequest): Promise<ListCosAttachmentResponse> {
  return request<ListCosAttachmentResponse>(API_LIST_COS_ATTACHMENT, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function importCosAttachment(input: ImportCosAttachmentRequest): Promise<ImportCosAttachmentResponse> {
  return request<ImportCosAttachmentResponse>(API_IMPORT_COS_ATTACHMENT, {
    method: 'POST',
    body: JSON.stringify(input),
  }, ATTACHMENT_REQUEST_TIMEOUT_MS)
}

export function removeSessionAttachment(input: DeleteSessionAttachmentRequest): Promise<{ ok: true }> {
  return request<{ ok: true }>(API_DELETE_ATTACHMENT, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function uploadLocalAttachment(sessionId: string, file: File): Promise<CreateLocalAttachmentResponse> {
  return request<CreateLocalAttachmentResponse>(API_LOCAL_ATTACHMENT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Session-Id': sessionId,
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  }, ATTACHMENT_REQUEST_TIMEOUT_MS)
}

export interface BrowserUploadRequest {
  promise: Promise<CosUploadCompleteResponse>
  abort(): void
}

export function uploadTaskContent(
  uploadUrl: string,
  file: File,
  onProgress: (uploadedBytes: number) => void,
): BrowserUploadRequest {
  const xhr = new XMLHttpRequest()
  const promise = new Promise<CosUploadCompleteResponse>((resolve, reject) => {
    xhr.open('POST', uploadUrl)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.upload.onprogress = event => onProgress(event.loaded)
    xhr.onload = () => {
      let payload: CosStorageApiResponse<CosUploadCompleteResponse>
      try {
        payload = JSON.parse(xhr.responseText) as CosStorageApiResponse<CosUploadCompleteResponse>
      } catch {
        reject(new CosStorageApiError('服务返回了无法识别的响应。', 'invalid-response'))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300 || payload.ok === false) {
        const error = payload.ok === false ? payload.error : undefined
        reject(new CosStorageApiError(error?.message ?? '上传失败，请稍后重试。', error?.code ?? 'upload-failed'))
        return
      }
      resolve(payload)
    }
    xhr.onerror = () => reject(new CosStorageApiError('上传连接已中断。', 'upload-network-error'))
    xhr.onabort = () => reject(new CosStorageApiError('上传已取消。', 'upload-cancelled'))
    xhr.send(file)
  })
  return {
    promise,
    abort: () => xhr.abort(),
  }
}
