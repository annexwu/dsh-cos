import React, { useEffect, useState } from 'react'
import type { CosUploadTask } from '../protocol.ts'
import type { StorageCopy } from './storage-copy.ts'
import type { UploadBatchProgress, UploadRegistrationProgress } from './upload-coordinator.ts'
import { formatBytes, formatDuration } from './storage-format.ts'

interface TaskDrawerProps {
  tasks: CosUploadTask[]
  registration?: UploadRegistrationProgress
  batch?: UploadBatchProgress
  copy: StorageCopy
  canRetry: (taskId: string) => boolean
  hasBrowserFile?: (taskId: string) => boolean
  onPause: (taskId: string) => Promise<void>
  onResume: (taskId: string) => Promise<void>
  onCancel: (taskId: string) => Promise<void>
  onRetry: (taskId: string) => Promise<void>
  onRemove: (taskId: string) => Promise<void>
  onClearCompleted: () => Promise<void>
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onClose: () => void
}

function progressOf(task: CosUploadTask): number {
  if (task.status === 'completed') return 100
  if (task.size === 0) return 0
  return Math.max(0, Math.min(99, Math.floor((task.uploadedBytes / task.size) * 100)))
}

function ChevronIcon({ direction }: { direction: 'up' | 'down' }): React.JSX.Element {
  return <svg className="dsh-cos-task-header__icon" viewBox="0 0 20 20" aria-hidden="true">
    <path d={direction === 'up' ? 'M5 12l5-5 5 5' : 'M5 8l5 5 5-5'} />
  </svg>
}

function CloseIcon(): React.JSX.Element {
  return <svg className="dsh-cos-task-header__icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
}

export function TaskDrawer(props: TaskDrawerProps): React.JSX.Element {
  const { tasks, copy, onClose, collapsed, onCollapsedChange } = props
  const [actionError, setActionError] = useState<string>()
  const [busyAction, setBusyAction] = useState<string>()
  const [now, setNow] = useState(Date.now())
  const [visibleCount, setVisibleCount] = useState(30)
  const hasUploading = tasks.some(task => task.status === 'uploading')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  useEffect(() => {
    if (!hasUploading) return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [hasUploading])

  const terminalCount = tasks.filter(task => task.status === 'completed' || task.status === 'cancelled').length
  const totalSize = props.batch?.totalBytes ?? tasks.reduce((sum, task) => sum + task.size, 0)
  const totalUploaded = props.batch?.uploadedBytes ?? tasks.reduce((sum, task) => sum + (task.status === 'failed' || task.status === 'cancelled' ? 0 : task.uploadedBytes), 0)
  const allCompleted = props.batch
    ? props.batch.accepted > 0 && props.batch.completed === props.batch.accepted && props.batch.failed === 0
      && props.batch.failedTasks === 0 && props.registration === undefined
    : tasks.length > 0 && tasks.every(task => task.status === 'completed')
  const overallProgress = allCompleted ? 100
    : totalSize === 0 ? 0 : Math.max(0, Math.min(99, Math.floor((totalUploaded / totalSize) * 100)))
  const shownTasks = [...tasks].sort((left, right) => {
    const priority = { uploading: 0, paused: 1, queued: 2, failed: 3, cancelled: 4, completed: 5 }
    return priority[left.status] - priority[right.status]
  }).slice(0, visibleCount)
  const run = async (key: string, action: () => Promise<void>) => {
    if (busyAction !== undefined) return
    setBusyAction(key)
    setActionError(undefined)
    try { await action() } catch (error) { setActionError(error instanceof Error ? error.message : '操作失败，请稍后重试。') } finally { setBusyAction(undefined) }
  }

  return <aside className={`dsh-cos-task-drawer${collapsed ? ' is-collapsed' : ''}`} role="dialog" aria-labelledby="dsh-cos-task-title">
    <header className="dsh-cos-task-header">
      <div><h2 id="dsh-cos-task-title">{copy.tasksTitle}</h2><span>{copy.taskCount(tasks.length)} · {overallProgress}%{props.batch && ` · 本批已完成 ${props.batch.completed}/${props.batch.accepted}`}{props.registration && ` · 准备中 ${props.registration.processed}/${props.registration.total}`}</span></div>
      <div className="dsh-cos-task-header__actions">
        <button type="button" aria-label={collapsed ? copy.expandTasks : copy.collapseTasks} aria-expanded={!collapsed} onClick={() => onCollapsedChange(!collapsed)}><ChevronIcon direction={collapsed ? 'up' : 'down'} /></button>
        <button type="button" aria-label={copy.close} onClick={onClose}><CloseIcon /></button>
      </div>
    </header>
    {!collapsed && <>
      {props.registration && <div className="dsh-cos-task-registration" role="status">
        正在准备文件：{props.registration.processed}/{props.registration.total} · 已加入 {props.registration.accepted} · 跳过 {props.registration.skipped} · 失败 {props.registration.failed}
      </div>}
      <div className="dsh-cos-task-summary"><div className="dsh-cos-task-summary__bar"><span style={{ width: `${overallProgress}%` }} /></div><span>{formatBytes(totalUploaded)} / {formatBytes(totalSize)}</span></div>
      <div className="dsh-cos-task-actions"><button type="button" disabled={terminalCount === 0 || busyAction !== undefined} onClick={() => void run('clear', props.onClearCompleted)}>{copy.clearCompleted}</button></div>
      {actionError && <div className="dsh-cos-task-action-error" role="alert">{actionError}</div>}
      <div className="dsh-cos-task-list">
        {shownTasks.map(task => {
          const progress = progressOf(task)
          const startedAt = task.startedAt ? new Date(task.startedAt).getTime() : undefined
          const elapsed = startedAt === undefined ? 0 : Math.max(0, (task.finishedAt ? new Date(task.finishedAt).getTime() : now) - startedAt)
          const retryAvailable = props.canRetry(task.id)
          const missingQueuedFile = task.status === 'queued' && task.source !== 'local' && props.hasBrowserFile?.(task.id) === false
          return <article key={task.id} className={`dsh-cos-task-item is-${task.status}`}>
            <div className="dsh-cos-task-item__top"><strong title={task.name}>{task.name}</strong><span>{copy.taskStatus[task.status]} · {progress}%</span></div>
            <div className="dsh-cos-task-progress" aria-label={`${progress}%`}><span style={{ width: `${progress}%` }} /></div>
            <div className="dsh-cos-task-item__meta"><span>{formatBytes(task.uploadedBytes)} / {formatBytes(task.size)}</span>{task.status === 'uploading' && <span>{formatBytes(task.speedBytesPerSecond)}/s · {formatDuration(elapsed)}</span>}</div>
            {task.error && <div className="dsh-cos-task-item__error">{task.error}</div>}
            {missingQueuedFile && <div className="dsh-cos-task-item__hint">{copy.queuedFileMissing}</div>}
            {(task.status === 'failed' || task.status === 'cancelled') && !retryAvailable && task.source !== 'local' && <div className="dsh-cos-task-item__hint">{copy.localFileMissing}</div>}
            <div className="dsh-cos-task-item__buttons">
              {task.status === 'uploading' && <button type="button" disabled={busyAction !== undefined} onClick={() => void run(`pause:${task.id}`, () => props.onPause(task.id))}>{copy.pauseTask}</button>}
              {task.status === 'paused' && <button type="button" disabled={busyAction !== undefined} onClick={() => void run(`resume:${task.id}`, () => props.onResume(task.id))}>{copy.resumeTask}</button>}
              {(task.status === 'queued' || task.status === 'uploading' || task.status === 'paused') && <button type="button" disabled={busyAction !== undefined} onClick={() => void run(`cancel:${task.id}`, () => props.onCancel(task.id))}>{copy.cancelTask}</button>}
              {(task.status === 'failed' || task.status === 'cancelled') && <button type="button" disabled={!retryAvailable || busyAction !== undefined} onClick={() => void run(`retry:${task.id}`, () => props.onRetry(task.id))}>{copy.retryTask}</button>}
              {(task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') && <button type="button" disabled={busyAction !== undefined} onClick={() => void run(`remove:${task.id}`, () => props.onRemove(task.id))}>{copy.removeTask}</button>}
            </div>
          </article>
        })}
        {tasks.length > visibleCount && <button type="button" className="dsh-cos-task-show-more" onClick={() => setVisibleCount(count => count + 30)}>
          显示更多（剩余 {tasks.length - visibleCount} 项）
        </button>}
      </div>
    </>}
  </aside>
}
