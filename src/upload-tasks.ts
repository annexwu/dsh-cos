import { randomUUID } from 'node:crypto'
import type { Config } from './config.ts'
import { HttpError } from './http.ts'
import type { CosUploadTask } from './protocol.ts'

const MAX_TASKS = 200
const MAX_CONCURRENT_UPLOADS = 3

export interface UploadControls {
  cancel(): void
  pause(): void
  resume(): void
}

interface UploadTaskRecord {
  task: CosUploadTask
  contentType: string
  config: Config
  controls?: UploadControls
  lastProgressBytes: number
  lastProgressAt: number
}

export interface NewUploadTask {
  name: string
  path: string
  key: string
  size: number
  source?: CosUploadTask['source']
  contentType: string
  config: Config
}

export class UploadTaskManager {
  private readonly tasks = new Map<string, UploadTaskRecord>()
  private localTaskScheduler?: () => void

  constructor(
    private readonly createId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}

  setLocalTaskScheduler(scheduler: (() => void) | undefined): void {
    this.localTaskScheduler = scheduler
  }

  create(input: NewUploadTask): CosUploadTask {
    this.makeRoom()
    if (this.tasks.size >= MAX_TASKS) {
      throw new HttpError(429, 'too-many-tasks', '任务记录已达上限，请先清理已完成任务。')
    }
    const timestamp = this.now().toISOString()
    const task: CosUploadTask = {
      id: this.createId(),
      name: input.name,
      path: input.path,
      key: input.key,
      size: input.size,
      source: input.source ?? 'browser',
      uploadedBytes: 0,
      status: 'queued',
      speedBytesPerSecond: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.tasks.set(task.id, {
      task,
      contentType: input.contentType,
      config: { ...input.config },
      lastProgressBytes: 0,
      lastProgressAt: this.now().getTime(),
    })
    return this.copy(task)
  }

  list(): CosUploadTask[] {
    return Array.from(this.tasks.values())
      .map(record => this.copy(record.task))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  get(taskId: string): CosUploadTask {
    return this.copy(this.require(taskId).task)
  }

  getUploadInput(taskId: string): { task: CosUploadTask; contentType: string; config: Config } {
    const record = this.require(taskId)
    return { task: this.copy(record.task), contentType: record.contentType, config: { ...record.config } }
  }

  begin(taskId: string, controls: UploadControls): CosUploadTask {
    const record = this.require(taskId)
    if (record.task.status !== 'queued') {
      throw new HttpError(409, 'task-not-queued', '上传任务当前不能开始。')
    }
    this.assertConcurrency()
    const timestamp = this.now()
    record.controls = controls
    record.lastProgressBytes = 0
    record.lastProgressAt = timestamp.getTime()
    this.patch(record, {
      status: 'uploading',
      uploadedBytes: 0,
      speedBytesPerSecond: 0,
      startedAt: timestamp.toISOString(),
      finishedAt: undefined,
      error: undefined,
    })
    return this.copy(record.task)
  }

  pause(taskId: string): CosUploadTask {
    const record = this.require(taskId)
    if (record.task.status !== 'uploading') throw new HttpError(409, 'task-not-pausable', '该任务当前不能暂停。')
    record.controls?.pause()
    this.patch(record, { status: 'paused', speedBytesPerSecond: 0 })
    return this.copy(record.task)
  }

  resume(taskId: string): CosUploadTask {
    const record = this.require(taskId)
    if (record.task.status !== 'paused') throw new HttpError(409, 'task-not-resumable', '该任务当前不能继续。')
    this.assertConcurrency()
    record.lastProgressBytes = record.task.uploadedBytes
    record.lastProgressAt = this.now().getTime()
    record.controls?.resume()
    this.patch(record, { status: 'uploading', speedBytesPerSecond: 0 })
    return this.copy(record.task)
  }

  progress(taskId: string, uploadedBytes: number): void {
    const record = this.tasks.get(taskId)
    if (record?.task.status !== 'uploading') return
    const loaded = Math.max(0, Math.min(record.task.size, Math.floor(uploadedBytes)))
    if (loaded === record.task.uploadedBytes) return
    const now = this.now().getTime()
    const elapsed = now - record.lastProgressAt
    const speed = elapsed > 0
      ? Math.max(0, Math.round(((loaded - record.lastProgressBytes) * 1000) / elapsed))
      : record.task.speedBytesPerSecond
    record.lastProgressBytes = loaded
    record.lastProgressAt = now
    this.patch(record, { uploadedBytes: loaded, speedBytesPerSecond: speed })
  }

  complete(taskId: string): CosUploadTask {
    const record = this.require(taskId)
    if (record.task.status === 'cancelled') return this.copy(record.task)
    if (record.task.status !== 'uploading' && record.task.status !== 'paused') {
      throw new HttpError(409, 'task-not-uploading', '上传任务状态异常。')
    }
    record.controls = undefined
    this.patch(record, {
      status: 'completed',
      uploadedBytes: record.task.size,
      speedBytesPerSecond: 0,
      finishedAt: this.now().toISOString(),
      error: undefined,
    })
    return this.copy(record.task)
  }

  fail(taskId: string, message: string): CosUploadTask {
    const record = this.require(taskId)
    if (record.task.status === 'cancelled' || record.task.status === 'completed') return this.copy(record.task)
    record.controls = undefined
    this.patch(record, {
      status: 'failed',
      speedBytesPerSecond: 0,
      finishedAt: this.now().toISOString(),
      error: message,
    })
    return this.copy(record.task)
  }

  cancel(taskId: string): CosUploadTask {
    const record = this.require(taskId)
    if (record.task.status !== 'queued' && record.task.status !== 'uploading' && record.task.status !== 'paused') {
      throw new HttpError(409, 'task-not-cancellable', '该任务当前不能取消。')
    }
    const controls = record.controls
    record.controls = undefined
    this.patch(record, {
      status: 'cancelled',
      speedBytesPerSecond: 0,
      finishedAt: this.now().toISOString(),
      error: undefined,
    })
    try {
      controls?.cancel()
    } catch {}
    return this.copy(record.task)
  }

  retry(taskId: string): CosUploadTask {
    const record = this.require(taskId)
    if (record.task.status !== 'failed' && record.task.status !== 'cancelled') {
      throw new HttpError(409, 'task-not-retryable', '该任务当前不能重试。')
    }
    record.controls = undefined
    record.lastProgressBytes = 0
    record.lastProgressAt = this.now().getTime()
    this.patch(record, {
      status: 'queued',
      uploadedBytes: 0,
      speedBytesPerSecond: 0,
      startedAt: undefined,
      finishedAt: undefined,
      error: undefined,
    })
    if (record.task.source === 'local') queueMicrotask(() => this.localTaskScheduler?.())
    return this.copy(record.task)
  }

  remove(taskId: string): void {
    const record = this.require(taskId)
    if (record.task.status === 'uploading' || record.task.status === 'paused' || record.task.status === 'queued') {
      throw new HttpError(409, 'task-active', '请先取消任务，再删除任务记录。')
    }
    this.tasks.delete(taskId)
  }

  clearCompleted(): number {
    let removed = 0
    for (const [taskId, record] of this.tasks) {
      if (record.task.status === 'completed' || record.task.status === 'cancelled') {
        this.tasks.delete(taskId)
        removed += 1
      }
    }
    return removed
  }

  dispose(): void {
    for (const record of this.tasks.values()) {
      if (record.task.status === 'uploading' || record.task.status === 'paused' || record.task.status === 'queued') {
        try {
          record.controls?.cancel()
        } catch {}
        record.controls = undefined
        this.patch(record, {
          status: 'cancelled',
          speedBytesPerSecond: 0,
          finishedAt: this.now().toISOString(),
          error: undefined,
        })
      }
    }
  }

  private require(taskId: string): UploadTaskRecord {
    const record = this.tasks.get(taskId)
    if (record === undefined) throw new HttpError(404, 'task-not-found', '未找到上传任务。')
    return record
  }

  private patch(record: UploadTaskRecord, patch: Partial<CosUploadTask>): void {
    record.task = {
      ...record.task,
      ...patch,
      updatedAt: this.now().toISOString(),
    }
    if (patch.error === undefined && 'error' in patch) delete record.task.error
  }

  private assertConcurrency(): void {
    const activeCount = Array.from(this.tasks.values()).filter(item => item.task.status === 'uploading').length
    if (activeCount >= MAX_CONCURRENT_UPLOADS) {
      throw new HttpError(429, 'upload-concurrency-limit', '当前已有 3 个文件正在上传，请稍后重试。')
    }
  }

  private makeRoom(): void {
    if (this.tasks.size < MAX_TASKS) return
    const terminal = Array.from(this.tasks.entries())
      .filter(([, record]) => record.task.status === 'completed' || record.task.status === 'cancelled')
      .sort(([, left], [, right]) => left.task.updatedAt.localeCompare(right.task.updatedAt))
    for (const [taskId] of terminal) {
      this.tasks.delete(taskId)
      if (this.tasks.size < MAX_TASKS) break
    }
  }

  private copy(task: CosUploadTask): CosUploadTask {
    return { ...task }
  }
}
