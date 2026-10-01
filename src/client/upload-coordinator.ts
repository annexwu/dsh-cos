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
const MAX_REGISTERED_BROWSER_TASKS = 48
const CONCURRENCY_RETRY_DELAY_MS = 500

export interface UploadRegistrationProgress {
  total: number
  processed: number
  accepted: number
  skipped: number
  failed: number
}

export interface UploadBatchProgress extends UploadRegistrationProgress {
  completed: number
  failedTasks: number
  totalBytes: number
  uploadedBytes: number
}

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
  private registration?: UploadRegistrationProgress
  private batch?: UploadBatchProgress
  private readonly batchTaskIds = new Set<string>()
  private readonly batchTasks = new Map<string, CosUploadTask>()
  private readonly files = new Map<string, File>()
  private readonly uploadUrls = new Map<string, string>()
  private readonly requests = new Map<string, BrowserUploadRequest>()
  private readonly taskRevisions = new Map<string, number>()
  private revision = 0
  private readonly listeners = new Set<() => void>()
  private retryTimer?: ReturnType<typeof setTimeout>
  private refreshPromise?: Promise<void>
  private disposed = false

  constructor(private readonly onUploadCompleted: () => void) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): CosUploadTask[] => this.tasks
  readonly getRegistrationSnapshot = (): UploadRegistrationProgress | undefined => this.registration
  readonly getBatchSnapshot = (): UploadBatchProgress | undefined => this.batch

  refresh(schedule = true): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise
    const revision = this.revision
    const request = (async () => {
      const response = await listUploadTasks()
      if (this.disposed) return
      const incoming = new Map(response.tasks.map(task => [task.id, task]))
      const known = new Set(this.tasks.map(task => task.id))
      const next = [
        ...this.tasks.map(task => (this.taskRevisions.get(task.id) ?? 0) > revision ? task : incoming.get(task.id))
          .filter((task): task is CosUploadTask => task !== undefined),
        ...response.tasks.filter(task => !known.has(task.id) && (this.taskRevisions.get(task.id) ?? 0) <= revision),
      ]
      const live = new Set(next.map(task => task.id))
      for (const taskId of this.taskRevisions.keys()) if (!live.has(taskId)) this.taskRevisions.delete(taskId)
      for (const taskId of this.files.keys()) {
        if (live.has(taskId) || this.requests.has(taskId)) continue
        this.files.delete(taskId)
        this.uploadUrls.delete(taskId)
      }
      for (const task of next) this.trackBatchTask(task)
      if (next.length !== this.tasks.length || next.some((task, index) => !this.sameTask(task, this.tasks[index]))) {
        this.tasks = next
        this.emit()
      }
      if (schedule) this.pump()
    })()
    this.refreshPromise = request.finally(() => { this.refreshPromise = undefined })
    return this.refreshPromise
  }

  async addFiles(
    path: string,
    candidates: UploadCandidate[],
    conflictPolicy: UploadConflictPolicy,
  ): Promise<UploadFilesResult> {
    if (this.disposed || this.registration) throw new Error('当前上传批次仍在准备中，请稍后再添加文件。')
    const errors: string[] = []
    let accepted = 0
    let skipped = 0
    let processed = 0
    this.batchTaskIds.clear()
    this.batchTasks.clear()
    this.registration = { total: candidates.length, processed, accepted, skipped, failed: 0 }
    this.batch = { ...this.registration, completed: 0, failedTasks: 0, totalBytes: 0, uploadedBytes: 0 }
    this.emit()
    for (const candidate of candidates) {
      if (this.disposed) break
      await this.waitForCapacity()
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
          this.batchTaskIds.add(response.task.id)
          this.setTask(response.task)
          this.pump()
          accepted += 1
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
      processed += 1
      if (processed === 1 || processed % 8 === 0 || processed === candidates.length) {
        this.registration = { total: candidates.length, processed, accepted, skipped, failed: errors.length }
        if (this.batch) this.batch = { ...this.batch, ...this.registration }
        this.emit()
        if (processed % 8 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0))
      }
    }
    this.registration = undefined
    this.emit()
    return { accepted, skipped, errors }
  }

  private pendingBrowserCount(): number {
    return this.tasks.filter(task => task.source !== 'local' && this.files.has(task.id)
      && (task.status === 'queued' || task.status === 'uploading' || task.status === 'paused')).length
  }

  private async waitForCapacity(): Promise<void> {
    if (this.pendingBrowserCount() < MAX_REGISTERED_BROWSER_TASKS) return
    await new Promise<void>(resolve => {
      const unsubscribe = this.subscribe(() => {
        if (!this.disposed && this.pendingBrowserCount() >= MAX_REGISTERED_BROWSER_TASKS) return
        unsubscribe()
        resolve()
      })
    })
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

  hasBrowserFile(taskId: string): boolean {
    return this.files.has(taskId)
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
    this.taskRevisions.set(taskId, ++this.revision)
    this.emit()
  }

  async clearCompleted(): Promise<void> {
    await clearCompletedUploadTasks()
    const removed = new Set(this.tasks.filter(task => task.status === 'completed' || task.status === 'cancelled').map(task => task.id))
    for (const taskId of removed) {
      this.files.delete(taskId)
      this.uploadUrls.delete(taskId)
      this.taskRevisions.set(taskId, ++this.revision)
    }
    this.tasks = this.tasks.filter(task => !removed.has(task.id))
    this.emit()
    await this.refresh()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer)
    for (const request of this.requests.values()) request.abort()
    this.requests.clear()
    this.registration = undefined
    this.emit()
    this.listeners.clear()
    this.files.clear()
    this.uploadUrls.clear()
  }

  private pump(): void {
    if (this.disposed) return
    const localActive = this.tasks.filter(task => task.source === 'local'
      && (task.status === 'uploading' || task.status === 'paused')).length
    let available = MAX_BROWSER_CONCURRENT_UPLOADS - localActive - this.requests.size
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
    const request = uploadTaskContent(uploadUrl, file)
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
      if (this.disposed) return
      concurrencyLimited = error instanceof CosStorageApiError && error.code === 'upload-concurrency-limit'
      if (concurrencyLimited) {
        this.patchTask(taskId, { status: 'queued', uploadedBytes: 0, speedBytesPerSecond: 0, error: undefined })
      } else if (this.tasks.find(task => task.id === taskId)?.status !== 'cancelled') {
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
    const updated = this.tasks.find(task => task.id === taskId)
    if (updated) this.trackBatchTask(updated)
    this.taskRevisions.set(taskId, ++this.revision)
    this.emit()
  }

  private setTask(task: CosUploadTask): void {
    const existing = this.tasks.findIndex(item => item.id === task.id)
    this.tasks = existing < 0
      ? [...this.tasks, task]
      : this.tasks.map(item => item.id === task.id ? task : item)
    this.trackBatchTask(task)
    this.taskRevisions.set(task.id, ++this.revision)
    this.emit()
  }

  private trackBatchTask(task: CosUploadTask): void {
    if (!this.batchTaskIds.has(task.id) || !this.batch) return
    const previous = this.batchTasks.get(task.id)
    if (previous && this.sameTask(task, previous)) return
    const amount = (entry: CosUploadTask) => entry.status === 'failed' || entry.status === 'cancelled' ? 0 : entry.uploadedBytes
    this.batchTasks.set(task.id, task)
    this.batch = {
      ...this.batch,
      completed: this.batch.completed + Number(task.status === 'completed') - Number(previous?.status === 'completed'),
      failedTasks: this.batch.failedTasks + Number(task.status === 'failed') - Number(previous?.status === 'failed'),
      totalBytes: this.batch.totalBytes + (previous ? 0 : task.size),
      uploadedBytes: this.batch.uploadedBytes + amount(task) - (previous ? amount(previous) : 0),
    }
  }

  private sameTask(left: CosUploadTask, right?: CosUploadTask): boolean {
    return right !== undefined && left.id === right.id && left.name === right.name
      && left.path === right.path && left.key === right.key && left.size === right.size
      && left.source === right.source && left.status === right.status
      && left.uploadedBytes === right.uploadedBytes && left.speedBytesPerSecond === right.speedBytesPerSecond
      && left.error === right.error && left.createdAt === right.createdAt
      && left.updatedAt === right.updatedAt && left.startedAt === right.startedAt
      && left.finishedAt === right.finishedAt
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}
