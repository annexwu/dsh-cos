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

const MAX_BROWSER_CONCURRENCY = 3

export type UploadConflictPolicy = 'overwrite' | 'skip' | 'rename'

export interface UploadFilesResult {
  accepted: number
  skipped: number
  errors: string[]
}

function renamedFileName(name: string, attempt: number): string {
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
  private disposed = false

  constructor(private readonly onUploadCompleted: () => void) {}

  getSnapshot = (): CosUploadTask[] => this.tasks

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async refresh(): Promise<void> {
    const response = await listUploadTasks()
    if (this.disposed) return
    this.setTasks(Array.isArray(response.tasks) ? response.tasks : [])
    this.schedule()
  }

  async addFiles(
    path: string,
    candidates: UploadCandidate[],
    conflictPolicy: UploadConflictPolicy,
  ): Promise<UploadFilesResult> {
    const errors: string[] = []
    let accepted = 0
    let skipped = 0
    for (const candidate of candidates) {
      const file = candidate.file
      const destinationPath = `${path}${candidate.relativeDirectory}`
      try {
        let response
        try {
          response = await createUploadTask({
            path: destinationPath,
            name: file.name,
            size: file.size,
            contentType: file.type || undefined,
          })
        } catch (error) {
          if (!(error instanceof CosStorageApiError) || error.code !== 'object-exists') throw error
          if (conflictPolicy === 'skip') {
            skipped += 1
            continue
          }
          if (conflictPolicy === 'overwrite') {
            response = await createUploadTask({
              path: destinationPath,
              name: file.name,
              size: file.size,
              contentType: file.type || undefined,
              overwrite: true,
            })
          } else {
            let attempt = 1
            while (true) {
              try {
                response = await createUploadTask({
                  path: destinationPath,
                  name: renamedFileName(file.name, attempt),
                  size: file.size,
                  contentType: file.type || undefined,
                })
                break
              } catch (renameError) {
                if (!(renameError instanceof CosStorageApiError) || renameError.code !== 'object-exists' || attempt >= 999) throw renameError
                attempt += 1
              }
            }
          }
        }
        if (this.disposed) break
        this.files.set(response.task.id, file)
        this.uploadUrls.set(response.task.id, response.uploadUrl)
        this.upsert(response.task)
        accepted += 1
        this.schedule()
      } catch (error) {
        errors.push(`${candidate.displayPath}: ${messageOf(error)}`)
      }
    }
    return { accepted, skipped, errors }
  }

  async pause(taskId: string): Promise<void> {
    const response = await pauseUploadTask(taskId)
    if (response.task) this.upsert(response.task)
    this.schedule()
  }

  async resume(taskId: string): Promise<void> {
    const response = await resumeUploadTask(taskId)
    if (response.task) this.upsert(response.task)
  }

  async cancel(taskId: string): Promise<void> {
    const response = await cancelUploadTask(taskId)
    this.requests.get(taskId)?.abort()
    if (response.task) this.upsert(response.task)
  }

  async retry(taskId: string): Promise<void> {
    const task = this.tasks.find(item => item.id === taskId)
    if (task?.source !== 'local' && !this.canRetry(taskId)) {
      throw new CosStorageApiError('本地文件已不可用，请重新选择文件上传。', 'local-file-missing')
    }
    const response = await retryUploadTask(taskId)
    if (response.task) this.upsert(response.task)
    if (task?.source !== 'local') this.schedule()
  }

  async remove(taskId: string): Promise<void> {
    await removeUploadTask(taskId)
    this.files.delete(taskId)
    this.uploadUrls.delete(taskId)
    this.requests.delete(taskId)
    this.setTasks(this.tasks.filter(task => task.id !== taskId))
  }

  async clearCompleted(): Promise<void> {
    await clearCompletedUploadTasks()
    await this.refresh()
  }

  canRetry(taskId: string): boolean {
    const task = this.tasks.find(item => item.id === taskId)
    return task?.source === 'local' || (this.files.has(taskId) && this.uploadUrls.has(taskId))
  }

  dispose(): void {
    this.disposed = true
    for (const request of this.requests.values()) request.abort()
    this.requests.clear()
    this.listeners.clear()
  }

  private schedule(): void {
    if (this.disposed) return
    const activeCount = this.tasks.filter(task => task.status === 'uploading').length
    const available = MAX_BROWSER_CONCURRENCY - activeCount
    if (available <= 0) return
    const queued = this.tasks.filter(task => (
      task.status === 'queued'
      && this.files.has(task.id)
      && this.uploadUrls.has(task.id)
      && !this.requests.has(task.id)
    )).slice(0, available)
    for (const task of queued) this.start(task)
  }

  private start(task: CosUploadTask): void {
    const file = this.files.get(task.id)
    const uploadUrl = this.uploadUrls.get(task.id)
    if (!file || !uploadUrl) return
    const request = uploadTaskContent(uploadUrl, file, () => {})
    this.requests.set(task.id, request)
    this.upsert({ ...task, status: 'uploading', updatedAt: new Date().toISOString() })
    void request.promise.then((response) => {
      if (this.disposed) return
      this.upsert(response.task)
      this.files.delete(task.id)
      this.uploadUrls.delete(task.id)
      this.onUploadCompleted()
    }).catch((error: unknown) => {
      if (this.disposed) return
      const current = this.tasks.find(item => item.id === task.id)
      if (!current || current.status === 'cancelled') return
      this.upsert({
        ...current,
        status: error instanceof CosStorageApiError && error.code === 'upload-cancelled' ? 'cancelled' : 'failed',
        error: messageOf(error),
        updatedAt: new Date().toISOString(),
      })
    }).finally(() => {
      this.requests.delete(task.id)
      if (!this.disposed) {
        this.schedule()
        void this.refresh().catch(() => {})
      }
    })
  }

  private upsert(task: CosUploadTask): void {
    const index = this.tasks.findIndex(item => item.id === task.id)
    const tasks = [...this.tasks]
    if (index === -1) tasks.unshift(task)
    else tasks[index] = task
    this.setTasks(tasks)
  }

  private setTasks(tasks: CosUploadTask[]): void {
    this.tasks = tasks
    for (const listener of this.listeners) listener()
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。'
}
