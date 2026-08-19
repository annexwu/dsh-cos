import type { CosUploadTask } from '../protocol.ts'
import {
  CosStorageApiError,
  cancelUploadTask,
  clearCompletedUploadTasks,
  createUploadTask,
  listUploadTasks,
  pauseUploadTask,
  removeUploadTask,
  resumeUploadTask,
  retryUploadTask,
  uploadTaskContent,
  type BrowserUploadRequest,
} from './api.ts'
import type { UploadCandidate } from './upload-selection.ts'

export type UploadConflictPolicy = 'overwrite' | 'skip' | 'rename'

export interface UploadFilesResult {
  accepted: number
  skipped: number
  errors: string[]
}

const MAX_BROWSER_CONCURRENT_UPLOADS = 3
const CONCURRENCY_RETRY_DELAY_MS = 500

function message(error: unknown): string {
  return error instanceof Error ? error.message : '上传失败，请稍后重试。'
}

function taskName(candidate: UploadCandidate): string {
  return candidate.file.name
}

function taskPath(basePath: string, candidate: UploadCandidate): string {
  return `${basePath}${candidate.relativeDirectory}`
}

function renamed(name: string, attempt: number): string {
  const extensionIndex = name.lastIndexOf('.')
  if (extensionIndex <= 0) return `${name} (${attempt})`
  return `${name.slice(0, extensionIndex)} (${attempt})${name.slice(extensionIndex)}`
}

export class UploadCoordinator {
  private tasks: CosUploadTask[] = []
  private readonly files = new Map<string, File>()
  private readonly uploadUrls = new Map<string, string>()
  private readonly requests = new Map<string, BrowserUploadRequest>()
  private readonly listeners = new Set<() => void>()
  private retryTimer?: ReturnType<typeof setTimeout>
  private disposed = false

  constructor(private readonly onUploadCompleted: () => void) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): CosUploadTask[] => this.tasks

  async refresh(schedule = true): Promise<void> {
    const response = await listUploadTasks()
    if (this.disposed) return
    const incoming = new Map(response.tasks.map(task => [task.id, task]))
    const known = new Set(this.tasks.map(task => task.id))
    this.tasks = [
      ...this.tasks.map(task => incoming.get(task.id)).filter((task): task is CosUploadTask => task !== undefined),
      ...response.tasks.filter(task => !known.has(task.id)),
    ]
    this.emit()
    if (schedule) this.pump()
  }

  async addFiles(path: string, candidates: UploadCandidate[], conflictPolicy: UploadConflictPolicy): Promise<UploadFilesResult> {
    const errors: string[] = []
    let accepted = 0
    let skipped = 0
    for (const candidate of candidates) {
      if (this.disposed) break
      const baseName = taskName(candidate)
      const targetPath = taskPath(path, candidate)
      let name = baseName
      let attempt = 0
      while (true) {
        try {
          const response = await createUploadTask({
            path: targetPath,
            name,
            size: candidate.file.size,
            contentType: candidate.file.type || undefined,
            overwrite: conflictPolicy === 'overwrite',
          })
          this.files.set(response.task.id, candidate.file)
          this.uploadUrls.set(response.task.id, response.uploadUrl)
          this.setTask(response.task)
          accepted += 1
          this.pump()
          break
        } catch (error) {
          if (error instanceof CosStorageApiError && error.code === 'object-exists') {
            if (conflictPolicy === 'skip') {
              skipped += 1
              break
            }
            if (conflictPolicy === 'rename') {
              attempt += 1
              name = renamed(baseName, attempt)
              if (attempt <= 9999) continue
            }
          }
          errors.push(`${candidate.displayPath}: ${message(error)}`)
          break
        }
      }
    }
    return { accepted, skipped, errors }
  }

  async pause(taskId: string): Promise<void> {
    const response = await pauseUploadTask(taskId)
    if (response.task) this.setTask(response.task)
  }

  async resume(taskId: string): Promise<void> {
    const response = await resumeUploadTask(taskId)
    if (response.task) this.setTask(response.task)
  }

  async cancel(taskId: string): Promise<void> {
    const response = await cancelUploadTask(taskId)
    if (response.task) this.setTask(response.task)
    this.requests.get(taskId)?.abort()
    this.pump()
  }

  async retry(taskId: string): Promise<void> {
    const task = this.tasks.find(item => item.id === taskId)
    if (task?.source !== 'local' && !this.files.has(taskId)) {
      throw new CosStorageApiError('页面刷新后本地文件不可恢复，请重新选择文件上传。', 'local-file-missing')
    }
    const response = await retryUploadTask(taskId)
    if (response.task) this.setTask(response.task)
    if (task?.source !== 'local') this.pump()
  }

  canRetry(taskId: string): boolean {
    const task = this.tasks.find(item => item.id === taskId)
    return task !== undefined
      && (task.status === 'failed' || task.status === 'cancelled')
      && (task.source === 'local' || (this.files.has(taskId) && this.uploadUrls.has(taskId)))
  }

  async remove(taskId: string): Promise<void> {
    await removeUploadTask(taskId)
    this.files.delete(taskId)
    this.uploadUrls.delete(taskId)
    this.tasks = this.tasks.filter(task => task.id !== taskId)
    this.emit()
  }

  async clearCompleted(): Promise<void> {
    await clearCompletedUploadTasks()
    const removed = new Set(this.tasks.filter(task => task.status === 'completed' || task.status === 'cancelled').map(task => task.id))
    for (const taskId of removed) {
      this.files.delete(taskId)
      this.uploadUrls.delete(taskId)
    }
    await this.refresh()
  }

  dispose(): void {
    this.disposed = true
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer)
    for (const request of this.requests.values()) request.abort()
    this.requests.clear()
    this.listeners.clear()
  }

  private pump(): void {
    if (this.disposed) return
    const active = this.tasks.filter(task => task.status === 'uploading' || task.status === 'paused').length
    let available = MAX_BROWSER_CONCURRENT_UPLOADS - active
    if (available <= 0) return
    for (const task of this.tasks) {
      if (available <= 0) break
      if (task.status !== 'queued' || task.source === 'local' || this.requests.has(task.id)) continue
      if (!this.files.has(task.id) || !this.uploadUrls.has(task.id)) continue
      available -= 1
      this.start(task.id)
    }
  }

  private start(taskId: string): void {
    const file = this.files.get(taskId)
    const uploadUrl = this.uploadUrls.get(taskId)
    if (!file || !uploadUrl || this.requests.has(taskId) || this.disposed) return
    this.patchTask(taskId, { status: 'uploading', error: undefined })
    const request = uploadTaskContent(uploadUrl, file, (uploadedBytes) => {
      const task = this.tasks.find(item => item.id === taskId)
      if (task?.status !== 'uploading') return
      this.patchTask(taskId, { uploadedBytes })
    })
    this.requests.set(taskId, request)
    void this.waitForUpload(taskId, request)
  }

  private async waitForUpload(taskId: string, request: BrowserUploadRequest): Promise<void> {
    let concurrencyLimited = false
    try {
      const response = await request.promise
      this.setTask(response.task)
      this.files.delete(taskId)
      this.uploadUrls.delete(taskId)
      this.onUploadCompleted()
    } catch (error) {
      concurrencyLimited = error instanceof CosStorageApiError && error.code === 'upload-concurrency-limit'
      if (concurrencyLimited) {
        this.patchTask(taskId, { status: 'queued', uploadedBytes: 0, speedBytesPerSecond: 0, error: undefined })
      } else if (!(error instanceof CosStorageApiError && error.code === 'upload-cancelled')) {
        this.patchTask(taskId, { status: 'failed', error: message(error), speedBytesPerSecond: 0 })
      }
    } finally {
      this.requests.delete(taskId)
      if (this.disposed) return
      try {
        await this.refresh(false)
      } catch {}
      if (concurrencyLimited) this.schedulePump()
      else this.pump()
    }
  }

  private schedulePump(): void {
    if (this.disposed || this.retryTimer !== undefined) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined
      this.pump()
    }, CONCURRENCY_RETRY_DELAY_MS)
  }

  private patchTask(taskId: string, patch: Partial<CosUploadTask>): void {
    this.tasks = this.tasks.map(task => task.id === taskId ? { ...task, ...patch } : task)
    this.emit()
  }

  private setTask(task: CosUploadTask): void {
    const existing = this.tasks.findIndex(item => item.id === task.id)
    this.tasks = existing < 0
      ? [...this.tasks, task]
      : this.tasks.map(item => item.id === task.id ? task : item)
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}
