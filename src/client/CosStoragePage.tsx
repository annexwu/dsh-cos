import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CosStorageItem, CosStorageListResponse, CosObjectUrlDomain } from '../protocol.ts'
import {
  CosStorageApiError,
  createFolder,
  deleteObject as deleteCosObject,
  getObjectUrl,
  listObjects,
} from './api.ts'
import type { CosStorageController } from './controller.ts'
import { getCopy } from './copy.ts'
import { getStorageCopy } from './storage-copy.ts'
import { ConfirmModal } from './ConfirmModal.tsx'
import { formatBytes, formatDate, formatStorageClass } from './storage-format.ts'
import { StorageIcon } from './StorageIcon.tsx'
import { LinkModal } from './LinkModal.tsx'
import { NewFolderModal } from './NewFolderModal.tsx'
import { ObjectDetailModal } from './ObjectDetailModal.tsx'
import { PreviewModal } from './PreviewModal.tsx'
import { TaskDrawer } from './TaskDrawer.tsx'
import { UploadCoordinator, type UploadConflictPolicy } from './upload-coordinator.ts'
import { UploadModal } from './UploadModal.tsx'
import type { UploadCandidate } from './upload-selection.ts'

export interface CosStoragePageProps {
  controller: CosStorageController
  onStartConversation?: (item: CosStorageItem) => Promise<void>
}

interface SelectionLayout {
  firstLeft: number
  firstTop: number
  itemWidth: number
  itemHeight: number
  columnGap: number
  rowGap: number
  columns: number
  keys: string[]
  baseKeys: Set<string>
  mode: 'replace' | 'add' | 'invert'
}

function ToolbarIcon({ kind }: { kind: 'upload' | 'folder' | 'tasks' | 'refresh' | 'grid' | 'list' | 'delete' }): React.JSX.Element {
  if (kind === 'upload') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 11v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" /></svg>
  if (kind === 'folder') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 5.5h6l1.5 2h7.5v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9Zm8 5v4m-2-2h4" /></svg>
  if (kind === 'tasks') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5V3.5m0 0L2.8 5.7M5 3.5l2.2 2.2M15 12.5v4m0 0 2.2-2.2M15 16.5l-2.2-2.2M4 8h12M4 12h12" /></svg>
  if (kind === 'delete') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12m-8 3v6m4-6v6M7 6l.7-2h4.6l.7 2m-8 0 .6 11h8.8L15 6" /></svg>
  if (kind === 'grid') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z" /></svg>
  if (kind === 'list') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4h11M6 10h11M6 16h11M3 4h.1M3 10h.1M3 16h.1" /></svg>
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 7a6.5 6.5 0 1 0 .3 5M16 3v4h-4" /></svg>
}

function errorMessage(error: unknown): string {
  return error instanceof CosStorageApiError ? error.message : 'COS 云存储暂时不可用，请稍后重试。'
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const input = document.createElement('textarea')
  input.value = value
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('无法复制链接，请检查浏览器权限。')
}

export function CosStoragePage({ controller, onStartConversation }: CosStoragePageProps): React.JSX.Element {
  const copy = useMemo(getCopy, [])
  const storageCopy = useMemo(getStorageCopy, [])
  const [open, setOpen] = useState(controller.getSnapshot().open)
  const [path, setPath] = useState('')
  const [markers, setMarkers] = useState<Array<string | undefined>>([undefined])
  const [pageIndex, setPageIndex] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CosStorageListResponse>()
  const [error, setError] = useState<string>()
  const [detailItem, setDetailItem] = useState<CosStorageItem>()
  const [previewItem, setPreviewItem] = useState<CosStorageItem>()
  const [menuKey, setMenuKey] = useState<string>()
  const [itemActionKey, setItemActionKey] = useState<string>()
  const [linkItem, setLinkItem] = useState<CosStorageItem>()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false)
  const [taskDrawerCollapsed, setTaskDrawerCollapsed] = useState(false)
  const [transferQueueEnabled, setTransferQueueEnabled] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string }>()
  const [confirmRequest, setConfirmRequest] = useState<{ message: string; danger?: boolean; resolve: (confirmed: boolean) => void }>()
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; x: number; y: number }>()
  const marker = markers[pageIndex]
  const hadActiveUploadRef = useRef(false)
  const selectionStartedRef = useRef(false)
  const selectionLayoutRef = useRef<SelectionLayout>()
  const gridRef = useRef<HTMLDivElement>(null)
  const suppressItemClickRef = useRef(false)
  const uploadCoordinator = useMemo(() => new UploadCoordinator(() => undefined), [])
  const uploadTasks = useSyncExternalStore(uploadCoordinator.subscribe, uploadCoordinator.getSnapshot)
  const activeTransferCount = uploadTasks.filter(task => task.status === 'queued' || task.status === 'uploading' || task.status === 'paused').length
  const hasTransferQueue = transferQueueEnabled && uploadTasks.length > 0

  useEffect(() => {
    if (notice?.kind !== 'success') return
    const timeout = window.setTimeout(() => setNotice(undefined), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => controller.subscribe(() => setOpen(controller.getSnapshot().open)), [controller])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!open || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a' || data === undefined) return
      const target = event.target instanceof HTMLElement ? event.target : undefined
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      event.preventDefault()
      setSelectedKeys(new Set(data.items.map(item => item.key)))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [data, open])

  useEffect(() => {
    const showTaskDrawer = () => {
      if (hasTransferQueue) setTaskDrawerOpen(true)
    }
    document.addEventListener('dsh-cos:show-task-drawer', showTaskDrawer)
    return () => document.removeEventListener('dsh-cos:show-task-drawer', showTaskDrawer)
  }, [hasTransferQueue])

  useEffect(() => {
    if (!hasTransferQueue) setTaskDrawerOpen(false)
  }, [hasTransferQueue])

  useEffect(() => {
    if (hasTransferQueue && activeTransferCount === 0 && taskDrawerOpen) setTaskDrawerCollapsed(true)
  }, [activeTransferCount, hasTransferQueue, taskDrawerOpen])

  useEffect(() => () => uploadCoordinator.dispose(), [uploadCoordinator])

  useEffect(() => {
    const hasActiveUpload = uploadTasks.some(task => task.status === 'queued' || task.status === 'uploading' || task.status === 'paused')
    if (hasActiveUpload) {
      hadActiveUploadRef.current = true
      return
    }
    if (hadActiveUploadRef.current) {
      hadActiveUploadRef.current = false
      setRefreshKey(value => value + 1)
    }
  }, [uploadTasks])

  useEffect(() => {
    if (!open) return
    void uploadCoordinator.refresh().catch(() => {})
    const interval = window.setInterval(() => {
      const active = uploadCoordinator.getSnapshot().some(task => task.status === 'queued' || task.status === 'uploading')
      if (active || taskDrawerOpen) void uploadCoordinator.refresh().catch(() => {})
    }, 800)
    return () => window.clearInterval(interval)
  }, [open, taskDrawerOpen, uploadCoordinator])

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError(undefined)
    void listObjects({
      path,
      ...(marker === undefined ? {} : { marker }),
    }).then((response) => {
      if (active) setData(response)
    }).catch((loadError: unknown) => {
      if (active) setError(errorMessage(loadError))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [open, path, marker, refreshKey])

  const navigate = (nextPath: string) => {
    setPath(nextPath)
    setMarkers([undefined])
    setPageIndex(0)
    setData(undefined)
    setError(undefined)
    setDetailItem(undefined)
    setMenuKey(undefined)
    setSelectedKeys(new Set())
  }

  const openItem = (item: CosStorageItem) => {
    if (item.kind === 'folder') {
      navigate(item.path)
      return
    }
    setPreviewItem(item)
  }

  const breadcrumbs = useMemo(() => {
    const values = [{ label: storageCopy.allFiles, path: '' }]
    const segments = path.split('/').filter(Boolean)
    let current = ''
    for (const segment of segments) {
      current += `${segment}/`
      values.push({ label: segment, path: current })
    }
    return values
  }, [storageCopy.allFiles, path])

  const selectedItems = data?.items.filter(item => selectedKeys.has(item.key)) ?? []
  const allCurrentPageSelected = data !== undefined && data.items.length > 0 && data.items.every(item => selectedKeys.has(item.key))
  const hasCurrentPageSelection = selectedItems.length > 0
  const toggleCurrentPageSelection = () => {
    if (data === undefined) return
    setSelectedKeys((current) => {
      const next = new Set(current)
      for (const item of data.items) {
        if (allCurrentPageSelected) next.delete(item.key)
        else next.add(item.key)
      }
      return next
    })
  }
  const toggleSelection = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectByClick = (key: string, event: React.MouseEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey) {
      toggleSelection(key)
      return
    }
    if (event.shiftKey) {
      setSelectedKeys(current => new Set([...current, key]))
      return
    }
    setSelectedKeys(new Set([key]))
  }

  const selectedKeysForBox = (box: { startX: number; startY: number; x: number; y: number }, layout: SelectionLayout): Set<string> => {
    const left = Math.min(box.startX, box.x)
    const right = Math.max(box.startX, box.x)
    const top = Math.min(box.startY, box.y)
    const bottom = Math.max(box.startY, box.y)
    const hitKeys = new Set<string>()
    for (let index = 0; index < layout.keys.length; index += 1) {
      const column = index % layout.columns
      const row = Math.floor(index / layout.columns)
      const itemLeft = layout.firstLeft + column * (layout.itemWidth + layout.columnGap)
      const itemTop = layout.firstTop + row * (layout.itemHeight + layout.rowGap)
      if (itemLeft < right && itemLeft + layout.itemWidth > left && itemTop < bottom && itemTop + layout.itemHeight > top) hitKeys.add(layout.keys[index])
    }
    if (layout.mode === 'replace') return hitKeys
    const next = new Set(layout.baseKeys)
    for (const key of hitKeys) {
      if (layout.mode === 'add') next.add(key)
      else if (next.has(key)) next.delete(key)
      else next.add(key)
    }
    return next
  }

  const beginSelection = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || data === undefined || (event.target as HTMLElement).closest('button, a, input, select, textarea, label, [contenteditable="true"], [role="button"]')) return
    const target = event.target as HTMLElement
    if (target.closest('[data-dsh-cos-storage-item-key]') === null) setSelectedKeys(new Set())
    const grid = gridRef.current
    if (grid === null) return
    const firstItem = grid.querySelector<HTMLElement>('[data-dsh-cos-storage-item-key]')
    if (firstItem === null) return
    const firstRect = firstItem.getBoundingClientRect()
    const gridStyle = window.getComputedStyle(grid)
    const columnGap = viewMode === 'list' ? 0 : Number.parseFloat(gridStyle.columnGap) || 0
    const rowGap = viewMode === 'list' ? 0 : Number.parseFloat(gridStyle.rowGap) || 0
    const columns = viewMode === 'list' ? 1 : Math.max(1, Math.round((grid.getBoundingClientRect().width + columnGap) / (firstRect.width + columnGap)))
    selectionLayoutRef.current = {
      firstLeft: firstRect.left,
      firstTop: firstRect.top,
      itemWidth: firstRect.width,
      itemHeight: firstRect.height,
      columnGap,
      rowGap,
      columns,
      keys: data.items.map(item => item.key),
      baseKeys: new Set(selectedKeys),
      mode: event.ctrlKey || event.metaKey ? 'invert' : event.shiftKey ? 'add' : 'replace',
    }
    selectionStartedRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectionBox({ startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY })
  }

  const updateSelection = (event: React.PointerEvent<HTMLElement>) => {
    const layout = selectionLayoutRef.current
    const panel = event.currentTarget
    if (!selectionStartedRef.current || layout === undefined || panel === null) return
    const bounds = panel.getBoundingClientRect()
    const pointerX = event.clientX
    const pointerY = event.clientY
    setSelectionBox((current) => {
      if (current === undefined) return current
      const next = {
        ...current,
        x: Math.min(Math.max(pointerX, bounds.left), bounds.right),
        y: Math.min(Math.max(pointerY, bounds.top), bounds.bottom),
      }
      setSelectedKeys(selectedKeysForBox(next, layout))
      return next
    })
  }

  const goNext = () => {
    if (!data?.nextMarker) return
    const nextMarker = data.nextMarker
    setMarkers(current => [...current.slice(0, pageIndex + 1), nextMarker])
    setPageIndex(current => current + 1)
    setMenuKey(undefined)
  }

  const requestConfirmation = (message: string, danger = false): Promise<boolean> => new Promise((resolve) => {
    setConfirmRequest({ message, danger, resolve })
  })

  const handleUpload = (candidates: UploadCandidate[], conflictPolicy: UploadConflictPolicy) => {
    if (candidates.length === 0) return
    setNotice(undefined)
    void uploadCoordinator.addFiles(path, candidates, conflictPolicy).then((result) => {
      if (result.errors.length > 0) setNotice({ kind: 'error', text: result.errors.join('\n') })
      else if (result.accepted > 0) {
        setTransferQueueEnabled(true)
        setTaskDrawerCollapsed(false)
        setTaskDrawerOpen(true)
        setNotice({ kind: 'success', text: result.skipped > 0 ? `${storageCopy.uploadAccepted(result.accepted)} ${storageCopy.uploadSkipped(result.skipped)}` : storageCopy.uploadAccepted(result.accepted) })
      } else if (result.skipped > 0) {
        setNotice({ kind: 'success', text: storageCopy.uploadSkipped(result.skipped) })
      }
    }).catch((uploadError: unknown) => {
      setNotice({ kind: 'error', text: errorMessage(uploadError) })
    })
  }

  const handleCreateFolder = async (name: string) => {
    await createFolder({ path, name })
    setNotice({ kind: 'success', text: storageCopy.folderCreated })
    setRefreshKey(value => value + 1)
  }

  const runItemAction = async (item: CosStorageItem, action: () => Promise<void>) => {
    if (itemActionKey !== undefined) return
    setItemActionKey(item.key)
    setMenuKey(undefined)
    setNotice(undefined)
    try {
      await action()
    } catch (actionError) {
      setNotice({ kind: 'error', text: errorMessage(actionError) })
    } finally {
      setItemActionKey(undefined)
    }
  }

  const handleDownload = async (item: CosStorageItem) => {
    await runItemAction(item, async () => {
      const response = await getObjectUrl({ kind: 'file', key: item.key, download: true })
      const anchor = document.createElement('a')
      anchor.href = response.url
      anchor.download = item.name
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    })
  }

  const handleGetLink = (item: CosStorageItem) => {
    setMenuKey(undefined)
    setLinkItem(item)
  }

  const handleStartConversation = async (item: CosStorageItem) => {
    if (onStartConversation === undefined) throw new Error('当前没有可用的会话，请先打开或新建一个会话。')
    await runItemAction(item, () => onStartConversation(item))
  }

  const createLink = async (item: CosStorageItem, expiresSeconds: number, domain: CosObjectUrlDomain) => {
    const response = await getObjectUrl({ kind: 'file', key: item.key, expiresSeconds, domain })
    await copyText(response.url)
    setNotice({ kind: 'success', text: storageCopy.linkCopied(expiresSeconds) })
  }

  const handleDelete = async (item: CosStorageItem) => {
    if (!await requestConfirmation(storageCopy.deleteConfirm(item.name, item.kind === 'folder'), true)) return
    await runItemAction(item, async () => {
      const response = await deleteCosObject({ kind: item.kind, key: item.key })
      setNotice({ kind: 'success', text: storageCopy.deleted(response.deleted) })
      setRefreshKey(value => value + 1)
    })
  }

  const finishSelection = (event?: React.PointerEvent<HTMLElement>) => {
    if (!selectionStartedRef.current || selectionBox === undefined) return
    const moved = Math.abs(selectionBox.x - selectionBox.startX) > 4 || Math.abs(selectionBox.y - selectionBox.startY) > 4
    if (moved) suppressItemClickRef.current = true
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setSelectionBox(undefined)
    selectionStartedRef.current = false
    selectionLayoutRef.current = undefined
  }

  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0 || !await requestConfirmation(storageCopy.deleteSelectedConfirm(selectedItems.length), true)) return
    setItemActionKey('__batch__')
    setNotice(undefined)
    try {
      let deleted = 0
      for (const item of selectedItems) {
        const response = await deleteCosObject({ kind: item.kind, key: item.key })
        deleted += response.deleted
      }
      setSelectedKeys(new Set())
      setNotice({ kind: 'success', text: storageCopy.deleted(deleted) })
      setRefreshKey(value => value + 1)
    } catch (actionError) {
      setNotice({ kind: 'error', text: errorMessage(actionError) })
      setRefreshKey(value => value + 1)
    } finally {
      setItemActionKey(undefined)
    }
  }

  return (
    <main className="dsh-cos-storage-page" aria-label={copy.title} onClick={() => setMenuKey(undefined)}>
      <header className="dsh-cos-storage-page-header">
        <div className="dsh-cos-storage-page-heading">
          <h1 className="dsh-cos-storage-page-title">{copy.title}</h1>
          <p className="dsh-cos-storage-page-subtitle">
            {data
              ? [`存储桶：${data.bucket}`, data.region, data.rootPrefix ? `${storageCopy.rootPrefix}: ${data.rootPrefix}` : ''].filter(Boolean).join(' · ')
              : copy.subtitle}
          </p>
        </div>
        <button className="dsh-cos-storage-back" type="button" onClick={() => controller.close()}>{copy.back}</button>
      </header>

      <section className="dsh-cos-storage-toolbar" aria-label="toolbar">
        <div className="dsh-cos-storage-toolbar__group">
          <button type="button" className="is-primary" disabled={!data} onClick={(event) => {
            event.stopPropagation()
            setUploadModalOpen(true)
          }}><ToolbarIcon kind="upload" />{storageCopy.upload}</button>
          <button type="button" disabled={!data} onClick={(event) => {
            event.stopPropagation()
            setFolderDialogOpen(true)
          }}><ToolbarIcon kind="folder" />{storageCopy.newFolder}</button>
          <button
            type="button"
            className="is-danger"
            disabled={selectedItems.length === 0 || itemActionKey !== undefined}
            onClick={() => void handleDeleteSelected()}
          ><ToolbarIcon kind="delete" />{storageCopy.delete}</button>
          {selectedItems.length > 0 && <span className="dsh-cos-storage-toolbar__divider" />}
          {selectedItems.length > 0 && (
            <span className="dsh-cos-storage-toolbar__selection">
              <strong>{storageCopy.selectedCount(selectedItems.length)}</strong>
              <button type="button" aria-label={storageCopy.clearSelection} onClick={() => setSelectedKeys(new Set())}>×</button>
            </span>
          )}
        </div>
        <div className="dsh-cos-storage-toolbar__group">
          {hasTransferQueue && <button
            type="button"
            className="dsh-cos-storage-transfer-button"
            title={storageCopy.tasks}
            aria-label={storageCopy.tasks}
            onClick={() => {
              setTaskDrawerCollapsed(false)
              setTaskDrawerOpen(true)
            }}
          >
            <ToolbarIcon kind="tasks" />
            <span>{activeTransferCount > 99 ? '99+' : activeTransferCount}</span>
          </button>}
          <button
            type="button"
            className={`dsh-cos-storage-refresh-button${loading ? ' is-loading' : ''}`}
            disabled={loading}
            aria-label={loading ? storageCopy.refreshing : storageCopy.refresh}
            title={loading ? storageCopy.refreshing : storageCopy.refresh}
            onClick={(event) => {
              event.stopPropagation()
              setRefreshKey(value => value + 1)
            }}
          >
            <ToolbarIcon kind="refresh" />
            <span className="dsh-cos-storage-refresh-button__label" aria-hidden="true">
              <span className="dsh-cos-storage-refresh-button__idle">{storageCopy.refresh}</span>
              <span className="dsh-cos-storage-refresh-button__loading">{storageCopy.refreshing}</span>
            </span>
          </button>
          <div className="dsh-cos-storage-view-switcher" role="group">
            <button
              type="button"
              className={viewMode === 'grid' ? 'is-active' : ''}
              title={storageCopy.gridView}
              aria-label={storageCopy.gridView}
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
            ><ToolbarIcon kind="grid" /></button>
            <button
              type="button"
              className={viewMode === 'list' ? 'is-active' : ''}
              title={storageCopy.listView}
              aria-label={storageCopy.listView}
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            ><ToolbarIcon kind="list" /></button>
          </div>
        </div>
      </section>

      {notice && (
        <div className={`dsh-cos-storage-notice is-${notice.kind}`} role="status">
          <span>{notice.text}</span>
          <button type="button" aria-label={storageCopy.close} onClick={() => setNotice(undefined)}>×</button>
        </div>
      )}

      <nav className="dsh-cos-storage-breadcrumb" aria-label="breadcrumb">
        {breadcrumbs.map((item, index) => (
          <React.Fragment key={item.path}>
            {index > 0 && <span aria-hidden="true">/</span>}
            <button
              type="button"
              className={index === breadcrumbs.length - 1 ? 'is-current' : ''}
              disabled={index === breadcrumbs.length - 1}
              onClick={(event) => {
                event.stopPropagation()
                navigate(item.path)
              }}
            >{item.label}</button>
          </React.Fragment>
        ))}
      </nav>

      <section
        className={`dsh-cos-storage-content${viewMode === 'list' ? ' is-list' : ''}`}
        onPointerDown={beginSelection}
        onPointerMove={updateSelection}
        onPointerUp={finishSelection}
        onPointerCancel={finishSelection}
      >
        {selectionBox && <div className="dsh-cos-storage-selection-box" style={{
          left: Math.min(selectionBox.startX, selectionBox.x),
          top: Math.min(selectionBox.startY, selectionBox.y),
          width: Math.abs(selectionBox.x - selectionBox.startX),
          height: Math.abs(selectionBox.y - selectionBox.startY),
        }} />}

        {loading && data === undefined && (
          <div className="dsh-cos-storage-state" role="status">
            <span className="dsh-cos-storage-spinner" />
            <strong>{storageCopy.loading}</strong>
          </div>
        )}

        {!loading && error && data === undefined && (
          <div className="dsh-cos-storage-state is-error" role="alert">
            <span className="dsh-cos-storage-state__icon">!</span>
            <strong>{storageCopy.loadFailed}</strong>
            <p>{error}</p>
            <button type="button" onClick={() => setRefreshKey(value => value + 1)}>{storageCopy.retry}</button>
          </div>
        )}

        {!loading && !error && data?.items.length === 0 && (
          <div className="dsh-cos-storage-state">
            <span className="dsh-cos-storage-empty-icon"><ToolbarIcon kind="folder" /></span>
            <strong>{storageCopy.emptyTitle}</strong>
            <p>{storageCopy.emptyDescription}</p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <div
            ref={gridRef}
            className={`dsh-cos-storage-grid${viewMode === 'list' ? ' is-list' : ''}`}
          >
            {viewMode === 'list' && (
              <div className="dsh-cos-storage-list-header" role="row">
                <button
                  type="button"
                  className="dsh-cos-storage-list-select-all"
                  aria-label={allCurrentPageSelected ? storageCopy.clearCurrentPageSelection : storageCopy.selectCurrentPage}
                  aria-pressed={allCurrentPageSelected}
                  data-indeterminate={!allCurrentPageSelected && hasCurrentPageSelection}
                  onClick={toggleCurrentPageSelection}
                >{allCurrentPageSelected ? '✓' : hasCurrentPageSelection ? '−' : ''}</button>
                <span aria-hidden="true" />
                <span>{storageCopy.name}</span>
                <span aria-hidden="true" />
                <span>{storageCopy.storageClass}</span>
                <span>{storageCopy.size}</span>
                <span>{storageCopy.modified}</span>
                <span aria-hidden="true" />
              </div>
            )}
            {data.items.map(item => (
              <article
                key={`${item.kind}:${item.key}`}
                className={`dsh-cos-storage-item${selectedKeys.has(item.key) ? ' is-selected' : ''}`}
                data-dsh-cos-storage-item-key={item.key}
                tabIndex={0}
                title={item.name}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  if (suppressItemClickRef.current) suppressItemClickRef.current = false
                }}
                onClick={(event) => selectByClick(item.key, event)}
                onDoubleClick={() => openItem(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') openItem(item)
                  if (event.key === ' ') {
                    event.preventDefault()
                    toggleSelection(item.key)
                  }
                }}
              >
                <button
                  type="button"
                  className="dsh-cos-storage-item__select"
                  aria-label={storageCopy.selectedCount(selectedKeys.has(item.key) ? 1 : 0)}
                  aria-pressed={selectedKeys.has(item.key)}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleSelection(item.key)
                  }}
                >{selectedKeys.has(item.key) ? '✓' : ''}</button>
                <button
                  type="button"
                  className="dsh-cos-storage-item__more"
                  aria-label={`${item.name} ${storageCopy.details}`}
                  aria-expanded={menuKey === item.key}
                  onClick={(event) => {
                    event.stopPropagation()
                    setMenuKey(current => current === item.key ? undefined : item.key)
                  }}
                >⋯</button>
                {menuKey === item.key && (
                  <div className="dsh-cos-storage-item__menu" onClick={event => event.stopPropagation()}>
                    {item.kind === 'file' && (
                      <>
                        <button type="button" disabled={itemActionKey !== undefined} onClick={() => void handleStartConversation(item)}>{storageCopy.startConversation}</button>
                        <button type="button" disabled={itemActionKey !== undefined} onClick={() => {
                          setPreviewItem(item)
                          setMenuKey(undefined)
                        }}>{storageCopy.preview}</button>
                        <button type="button" disabled={itemActionKey !== undefined} onClick={() => void handleDownload(item)}>{storageCopy.download}</button>
                        <button type="button" disabled={itemActionKey !== undefined} onClick={() => void handleGetLink(item)}>{storageCopy.getLink}</button>
                      </>
                    )}
                    <button type="button" disabled={itemActionKey !== undefined} onClick={() => {
                      setDetailItem(item)
                      setMenuKey(undefined)
                    }}>{storageCopy.details}</button>
                    <button
                      type="button"
                      className="is-danger"
                      disabled={itemActionKey !== undefined}
                      onClick={() => void handleDelete(item)}
                    >{itemActionKey === item.key ? storageCopy.deleting : storageCopy.delete}</button>
                  </div>
                )}
                <div className="dsh-cos-storage-item__icon"><StorageIcon item={item} /></div>
                {viewMode === 'list' ? (
                  <button
                    type="button"
                    className="dsh-cos-storage-item__name is-interactive"
                    onClick={(event) => {
                      event.stopPropagation()
                      openItem(item)
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                    }}
                  >{item.name}</button>
                ) : <div className="dsh-cos-storage-item__name">{item.name}</div>}
                <div className="dsh-cos-storage-item__spacer" aria-hidden="true" />
                <div className="dsh-cos-storage-item__meta">
                  {item.kind === 'folder' ? storageCopy.folder : formatBytes(item.size)}
                </div>
                <div className="dsh-cos-storage-item__storage">{item.kind === 'file' ? formatStorageClass(item.storageClass) : '—'}</div>
                <div className="dsh-cos-storage-item__size">{item.kind === 'file' ? formatBytes(item.size) : '—'}</div>
                <div className="dsh-cos-storage-item__modified">{formatDate(item.lastModified)}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="dsh-cos-storage-pagination">
        <span>{storageCopy.pageSummary(pageIndex + 1, data?.items.length ?? 0)}</span>
        <div>
          <button type="button" disabled={loading || pageIndex === 0} onClick={() => {
            setPageIndex(current => Math.max(0, current - 1))
            setMenuKey(undefined)
          }}>{storageCopy.previousPage}</button>
          <button type="button" disabled={loading || !data?.nextMarker} onClick={goNext}>{storageCopy.nextPage}</button>
        </div>
      </footer>

      {detailItem && <ObjectDetailModal item={detailItem} copy={storageCopy} onClose={() => setDetailItem(undefined)} />}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          items={data?.items.filter(item => item.kind === 'file') ?? []}
          copy={storageCopy}
          onDownload={item => void handleDownload(item)}
          onSelect={setPreviewItem}
          onClose={() => setPreviewItem(undefined)}
        />
      )}
      {linkItem && (
        <LinkModal
          item={linkItem}
          customDomain={data?.customDomain ?? ''}
          copy={storageCopy}
          onCreate={(expiresSeconds, domain) => createLink(linkItem, expiresSeconds, domain)}
          onClose={() => setLinkItem(undefined)}
        />
      )}
      {uploadModalOpen && (
        <UploadModal
          copy={storageCopy}
          onUpload={handleUpload}
          onClose={() => setUploadModalOpen(false)}
        />
      )}
      {folderDialogOpen && (
        <NewFolderModal
          copy={storageCopy}
          onCreate={handleCreateFolder}
          onClose={() => setFolderDialogOpen(false)}
        />
      )}
      {taskDrawerOpen && hasTransferQueue && (
        <TaskDrawer
          tasks={uploadTasks}
          copy={storageCopy}
          collapsed={taskDrawerCollapsed}
          onCollapsedChange={setTaskDrawerCollapsed}
          canRetry={taskId => uploadCoordinator.canRetry(taskId)}
          onPause={taskId => uploadCoordinator.pause(taskId)}
          onResume={taskId => uploadCoordinator.resume(taskId)}
          onCancel={taskId => uploadCoordinator.cancel(taskId)}
          onRetry={taskId => uploadCoordinator.retry(taskId)}
          onRemove={taskId => uploadCoordinator.remove(taskId)}
          onClearCompleted={() => uploadCoordinator.clearCompleted()}
          onClose={() => setTaskDrawerOpen(false)}
        />
      )}
      {confirmRequest && <ConfirmModal
        title={storageCopy.confirmTitle}
        message={confirmRequest.message}
        confirmLabel={confirmRequest.danger ? storageCopy.delete : storageCopy.overwrite}
        cancelLabel={storageCopy.cancel}
        danger={confirmRequest.danger}
        onConfirm={() => {
          confirmRequest.resolve(true)
          setConfirmRequest(undefined)
        }}
        onCancel={() => {
          confirmRequest.resolve(false)
          setConfirmRequest(undefined)
        }}
      />}
    </main>
  )
}
