import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '../src/http.ts'
import { UploadTaskManager } from '../src/upload-tasks.ts'

const config = {
  bucket: 'example-1250000000',
  region: 'ap-guangzhou',
  prefix: 'root/',
  customDomain: '',
}

function createManager(): UploadTaskManager {
  let id = 0
  let now = 0
  return new UploadTaskManager(
    () => `task-${++id}`,
    () => new Date(++now * 1000),
  )
}

function controls(cancel = vi.fn()) {
  return { cancel, pause: vi.fn(), resume: vi.fn() }
}

describe('UploadTaskManager', () => {
  it('tracks upload lifecycle and progress', () => {
    const manager = createManager()
    const task = manager.create({
      name: 'report.pdf',
      path: 'docs/',
      key: 'root/docs/report.pdf',
      size: 100,
      contentType: 'application/pdf',
      config,
    })
    expect(task.status).toBe('queued')
    manager.begin(task.id, controls())
    manager.progress(task.id, 45)
    expect(manager.get(task.id)).toMatchObject({ status: 'uploading', uploadedBytes: 45 })
    expect(manager.complete(task.id)).toMatchObject({ status: 'completed', uploadedBytes: 100 })
    expect(manager.fail(task.id, 'response socket closed')).toMatchObject({ status: 'completed', uploadedBytes: 100 })
  })

  it('cancels an active upload exactly once', () => {
    const manager = createManager()
    const cancel = vi.fn()
    const task = manager.create({ name: 'a.txt', path: '', key: 'root/a.txt', size: 1, contentType: 'text/plain', config })
    manager.begin(task.id, controls(cancel))
    expect(manager.cancel(task.id).status).toBe('cancelled')
    expect(cancel).toHaveBeenCalledOnce()
    expect(() => manager.cancel(task.id)).toThrow(HttpError)
  })

  it('pauses and resumes an active multipart upload', () => {
    const manager = createManager()
    const taskControls = controls()
    const task = manager.create({ name: 'large.bin', path: '', key: 'root/large.bin', size: 6 * 1024 ** 3, contentType: 'application/octet-stream', config })
    manager.begin(task.id, taskControls)
    expect(manager.pause(task.id).status).toBe('paused')
    expect(taskControls.pause).toHaveBeenCalledOnce()
    expect(manager.resume(task.id).status).toBe('uploading')
    expect(taskControls.resume).toHaveBeenCalledOnce()
  })

  it('allows failed tasks to retry and preserves their destination snapshot', () => {
    const manager = createManager()
    const task = manager.create({ name: 'a.txt', path: '', key: 'root/a.txt', size: 1, contentType: 'text/plain', config })
    manager.begin(task.id, controls())
    manager.fail(task.id, 'network error')
    expect(manager.retry(task.id)).toMatchObject({ status: 'queued', uploadedBytes: 0 })
    expect(manager.getUploadInput(task.id).config).toEqual(config)
  })

  it('enforces three concurrent uploads', () => {
    const manager = createManager()
    const ids = Array.from({ length: 4 }, (_, index) => manager.create({
      name: `${index}.txt`, path: '', key: `root/${index}.txt`, size: 1, contentType: 'text/plain', config,
    }).id)
    for (const id of ids.slice(0, 3)) manager.begin(id, controls())
    expect(() => manager.begin(ids[3], controls())).toThrow('当前已有 3 个文件正在上传')
  })

  it('only removes terminal tasks and clears completed records', () => {
    const manager = createManager()
    const completed = manager.create({ name: 'done', path: '', key: 'done', size: 0, contentType: 'text/plain', config })
    manager.begin(completed.id, controls())
    manager.complete(completed.id)
    const active = manager.create({ name: 'active', path: '', key: 'active', size: 1, contentType: 'text/plain', config })
    expect(() => manager.remove(active.id)).toThrow('请先取消任务')
    expect(manager.clearCompleted()).toBe(1)
    expect(manager.list()).toHaveLength(1)
  })
})
