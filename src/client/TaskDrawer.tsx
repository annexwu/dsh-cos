import React, { useEffect, useState } from 'react'
import type { CosUploadTask } from '../protocol.ts'
import type { StorageCopy } from './storage-copy.ts'
import { formatBytes, formatDuration } from './storage-format.ts'

interface TaskDrawerProps {
  tasks: CosUploadTask[]
  copy: StorageCopy
  canRetry: (taskId: string) => boolean
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
  if (task.size === 0) return task.status === 'uploading' ? 50 : 0
  return Math.max(0, Math.min(100, Math.round((task.uploadedBytes / task.size) * 100)))
}

export function TaskDrawer(props: TaskDrawerProps): React.JSX.Element {
  const { tasks, copy, onClose, collapsed, onCollapsedChange } = props
  const [actionError, setActionError] = useState<string>()
  const [busyAction, setBusyAction] = useState<string>()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  useEffect(() => {
    setNow(Date.now())
    if (!tasks.some(task => task.status === 'uploading')) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [tasks])

  const terminalCount = tasks.filter(task => task.status === 'completed' || task.status === 'cancelled').length
  const totalSize = tasks.reduce((sum, task) => sum + task.size, 0)
  const totalUploaded = tasks.reduce((sum, task) => sum + task.uploadedBytes, 0)
  const overallProgress = totalSize === 0 ? 0 : Math.round((totalUploaded / totalSize) * 100)
  const run = async (key: string, action: () => Promise<void>) => {
    if (busyAction !== undefined) return
    setBusyAction(key)
    setActionError(undefined)
    try { await action() } catch (error) { setActionError(error instanceof Error ? error.message : '操作失败，请稍后重试。') } finally { setBusyAction(undefined) }
  }

  return <aside className={`dsh-cos-task-drawer${collapsed ? ' is-collapsed' : ''}`} role="dialog" aria-labelledby="dsh-cos-task-title">
    <header className="dsh-cos-task-header">
      <div><h2 id="dsh-cos-task-title">{copy.tasksTitle}</h2><span>{copy.taskCount(tasks.length)} · {overallProgress}%</span></div>
      <div className="dsh-cos-task-header__actions">
        <button type="button" aria-label={collapsed ? copy.expandTasks : copy.collapseTasks} aria-expanded={!collapsed} onClick={() => onCollapsedChange(!collapsed)}>{collapsed ? '⌃' : '⌄'}</button>
        <button type="button" aria-label={copy.close} onClick={onClose}>×</button>
      </div>
    </header>
    {!collapsed && <>
      <div className="dsh-cos-task-summary"><div className="dsh-cos-task-summary__bar"><span style={{ width: `${overallProgress}%` }} /></div><span>{formatBytes(totalUploaded)} / {formatBytes(totalSize)}</span></div>
      <div className="dsh-cos-task-actions"><button type="button" disabled={terminalCount === 0 || busyAction !== undefined} onClick={() => void run('clear', props.onClearCompleted)}>{copy.clearCompleted}</button></div>
      {actionError && <div className="dsh-cos-task-action-error" role="alert">{actionError}</div>}
      <div className="dsh-cos-task-list">
        {tasks.map(task => {
          const progress = progressOf(task)
          const startedAt = task.startedAt ? new Date(task.startedAt).getTime() : undefined
          const elapsed = startedAt === undefined ? 0 : Math.max(0, (task.finishedAt ? new Date(task.finishedAt).getTime() : now) - startedAt)
          const retryAvailable = props.canRetry(task.id)
          return <article key={task.id} className={`dsh-cos-task-item is-${task.status}`}>
            <div className="dsh-cos-task-item__top"><strong title={task.name}>{task.name}</strong><span>{copy.taskStatus[task.status]} · {progress}%</span></div>
            <div className="dsh-cos-task-progress" aria-label={`${progress}%`}><span style={{ width: `${progress}%` }} /></div>
            <div className="dsh-cos-task-item__meta"><span>{formatBytes(task.uploadedBytes)} / {formatBytes(task.size)}</span>{task.status === 'uploading' && <span>{formatBytes(task.speedBytesPerSecond)}/s · {formatDuration(elapsed)}</span>}</div>
            {task.error && <div className="dsh-cos-task-item__error">{task.error}</div>}
            {(task.status === 'failed' || task.status === 'cancelled') && !retryAvailable && <div className="dsh-cos-task-item__hint">{copy.localFileMissing}</div>}
            <div className="dsh-cos-task-item__buttons">
              {task.status === 'uploading' && <button type="button" disabled={busyAction !== undefined} onClick={() => void run(`pause:${task.id}`, () => props.onPause(task.id))}>{copy.pauseTask}</button>}
              {task.status === 'paused' && <button type="button" disabled={busyAction !== undefined} onClick={() => void run(`resume:${task.id}`, () => props.onResume(task.id))}>{copy.resumeTask}</button>}
              {(task.status === 'queued' || task.status === 'uploading' || task.status === 'paused') && <button type="button" disabled={busyAction !== undefined} onClick={() => void run(`cancel:${task.id}`, () => props.onCancel(task.id))}>{copy.cancelTask}</button>}
              {(task.status === 'failed' || task.status === 'cancelled') && <button type="button" disabled={!retryAvailable || busyAction !== undefined} onClick={() => void run(`retry:${task.id}`, () => props.onRetry(task.id))}>{copy.retryTask}</button>}
              {(task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') && <button type="button" disabled={busyAction !== undefined} onClick={() => void run(`remove:${task.id}`, () => props.onRemove(task.id))}>{copy.removeTask}</button>}
            </div>
          </article>
        })}
      </div>
    </>}
  </aside>
}
