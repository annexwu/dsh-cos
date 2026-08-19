import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CosUploadTask } from '../src/protocol.ts'
import type { UploadCandidate } from '../src/client/upload-selection.ts'

vi.mock('../src/client/api.ts', () => {
  class CosStorageApiError extends Error {
    constructor(message: string, readonly code: string) {
      super(message)
      this.name = 'CosStorageApiError'
    }
  }
  return {
    CosStorageApiError,
    createUploadTask: vi.fn(),
    listUploadTasks: vi.fn(),
    uploadTaskContent: vi.fn(),
    pauseUploadTask: vi.fn(),
    resumeUploadTask: vi.fn(),
    cancelUploadTask: vi.fn(),
    retryUploadTask: vi.fn(),
    removeUploadTask: vi.fn(),
    clearCompletedUploadTasks: vi.fn(),
  }
})

import * as api from '../src/client/api.ts'
import { UploadCoordinator } from '../src/client/upload-coordinator.ts'

interface PendingUpload {
  resolve(task: CosUploadTask): void
  reject(error: unknown): void
}

let sequence = 0
let serverTasks: CosUploadTask[]
let pending: Map<string, PendingUpload>
let activeUploads: number
let maxActiveUploads: number
let rejectNextForConcurrency: boolean

function clone(task: CosUploadTask): CosUploadTask {
  return { ...task }
}

function findTask(taskId: string): CosUploadTask {
  const task = serverTasks.find(item => item.id === taskId)
  if (!task) throw new Error(`Missing task ${taskId}`)
  return task
}

function updateTask(taskId: string, patch: Partial<CosUploadTask>): CosUploadTask {
  const current = findTask(taskId)
  const next = { ...current, ...patch }
  serverTasks = serverTasks.map(task => task.id === taskId ? next : task)
  return clone(next)
}

function candidate(index: number): UploadCandidate {
  return {
    id: `candidate-${index}`,
    groupId: `group-${index}`,
    groupName: `${index}.txt`,
    file: new File([`content-${index}`], `${index}.txt`, { type: 'text/plain' }),
    relativeDirectory: '',
    displayPath: `${index}.txt`,
  }
}

async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function complete(taskId: string): void {
  activeUploads -= 1
  const task = updateTask(taskId, {
    status: 'completed',
    uploadedBytes: findTask(taskId).size,
    speedBytesPerSecond: 0,
  })
  pending.get(taskId)?.resolve(task)
  pending.delete(taskId)
}

beforeEach(() => {
  vi.clearAllMocks()
  sequence = 0
  serverTasks = []
  pending = new Map()
  activeUploads = 0
  maxActiveUploads = 0
  rejectNextForConcurrency = false

  vi.mocked(api.createUploadTask).mockImplementation(async input => {
    const id = `task-${++sequence}`
    const task: CosUploadTask = {
      id,
      name: input.name,
      path: input.path ?? '',
      key: `${input.path ?? ''}${input.name}`,
      size: input.size,
      source: 'browser',
      uploadedBytes: 0,
      status: 'queued',
      speedBytesPerSecond: 0,
      createdAt: new Date(sequence * 1000).toISOString(),
      updatedAt: new Date(sequence * 1000).toISOString(),
    }
    serverTasks.push(task)
    return { ok: true, task: clone(task), uploadUrl: `/upload?taskId=${id}` }
  })
  vi.mocked(api.listUploadTasks).mockImplementation(async () => ({ ok: true, tasks: serverTasks.map(clone) }))
  vi.mocked(api.uploadTaskContent).mockImplementation((uploadUrl) => {
    const taskId = new URL(uploadUrl, 'http://localhost').searchParams.get('taskId')!
    if (rejectNextForConcurrency) {
      rejectNextForConcurrency = false
      return {
        promise: Promise.reject(new api.CosStorageApiError('当前上传并发已满，请稍后重试。', 'upload-concurrency-limit')),
        abort: vi.fn(),
      }
    }
    activeUploads += 1
    maxActiveUploads = Math.max(maxActiveUploads, activeUploads)
    updateTask(taskId, { status: 'uploading' })
    let resolve!: (value: { ok: true; task: CosUploadTask }) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<{ ok: true; task: CosUploadTask }>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    pending.set(taskId, {
      resolve: task => resolve({ ok: true, task }),
      reject,
    })
    return { promise, abort: vi.fn() }
  })
  vi.mocked(api.pauseUploadTask).mockImplementation(async taskId => ({ ok: true, task: updateTask(taskId, { status: 'paused' }) }))
  vi.mocked(api.resumeUploadTask).mockImplementation(async taskId => ({ ok: true, task: updateTask(taskId, { status: 'uploading' }) }))
  vi.mocked(api.cancelUploadTask).mockImplementation(async taskId => ({ ok: true, task: updateTask(taskId, { status: 'cancelled' }) }))
  vi.mocked(api.retryUploadTask).mockImplementation(async taskId => ({ ok: true, task: updateTask(taskId, { status: 'queued', error: undefined }) }))
  vi.mocked(api.removeUploadTask).mockImplementation(async taskId => {
    serverTasks = serverTasks.filter(task => task.id !== taskId)
    return { ok: true }
  })
  vi.mocked(api.clearCompletedUploadTasks).mockImplementation(async () => {
    const before = serverTasks.length
    serverTasks = serverTasks.filter(task => task.status !== 'completed' && task.status !== 'cancelled')
    return { ok: true, removed: before - serverTasks.length }
  })
})

describe('UploadCoordinator', () => {
  it('queues large batches and never starts more than three browser uploads', async () => {
    const coordinator = new UploadCoordinator(() => undefined)
    const result = await coordinator.addFiles('', Array.from({ length: 26 }, (_, index) => candidate(index)), 'overwrite')
    await settle()

    expect(result).toEqual({ accepted: 26, skipped: 0, errors: [] })
    expect(pending.size).toBe(3)
    expect(coordinator.getSnapshot().filter(task => task.status === 'queued')).toHaveLength(23)

    while (pending.size > 0) {
      const taskId = pending.keys().next().value as string
      complete(taskId)
      await settle()
    }

    expect(api.uploadTaskContent).toHaveBeenCalledTimes(26)
    expect(maxActiveUploads).toBe(3)
    expect(coordinator.getSnapshot().every(task => task.status === 'completed')).toBe(true)
    coordinator.dispose()
  })

  it('keeps a server concurrency rejection queued and retries it automatically', async () => {
    vi.useFakeTimers()
    rejectNextForConcurrency = true
    const coordinator = new UploadCoordinator(() => undefined)
    try {
      await coordinator.addFiles('', [candidate(1)], 'overwrite')
      await settle()
      expect(coordinator.getSnapshot()[0]?.status).toBe('queued')
      expect(api.uploadTaskContent).toHaveBeenCalledOnce()

      await vi.advanceTimersByTimeAsync(500)
      await settle()
      expect(api.uploadTaskContent).toHaveBeenCalledTimes(2)
      expect(pending.has('task-1')).toBe(true)
      complete('task-1')
      await settle()
      expect(coordinator.getSnapshot()[0]?.status).toBe('completed')
    } finally {
      coordinator.dispose()
      vi.useRealTimers()
    }
  })

  it('does not start a queued task after it is cancelled', async () => {
    const coordinator = new UploadCoordinator(() => undefined)
    await coordinator.addFiles('', Array.from({ length: 4 }, (_, index) => candidate(index)), 'overwrite')
    await settle()

    await coordinator.cancel('task-4')
    complete('task-1')
    await settle()

    expect(api.uploadTaskContent).toHaveBeenCalledTimes(3)
    expect(coordinator.getSnapshot().find(task => task.id === 'task-4')?.status).toBe('cancelled')
    coordinator.dispose()
  })
})
