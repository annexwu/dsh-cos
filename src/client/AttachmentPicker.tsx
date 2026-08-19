import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { CosStorageItem, ListCosAttachmentResponse } from '../protocol.ts'
import { CosStorageApiError, createFolder, createUploadTask, listCosAttachmentObjects, uploadTaskContent } from './api.ts'
import type { AttachmentCopy } from './attachment-copy.ts'
import { StorageIcon } from './StorageIcon.tsx'
import { formatBytes, formatDate, formatStorageClass } from './storage-format.ts'

interface AttachmentPickerProps {
  sessionId: string
  copy: AttachmentCopy
  onPick: (items: CosStorageItem[]) => Promise<void>
  onClose: () => void
}

function errorMessage(error: unknown, copy: AttachmentCopy): string {
  return error instanceof CosStorageApiError ? error.message : copy.cosAttachmentFailed
}

export function AttachmentPicker({ sessionId, copy, onPick, onClose }: AttachmentPickerProps): React.JSX.Element {
  const [path, setPath] = useState('')
  const [markers, setMarkers] = useState<Array<string | undefined>>([undefined])
  const [pageIndex, setPageIndex] = useState(0)
  const [data, setData] = useState<ListCosAttachmentResponse>()
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [attaching, setAttaching] = useState(false)
  const [error, setError] = useState<string>()
  const [refreshKey, setRefreshKey] = useState(0)
  const [folderName, setFolderName] = useState('')
  const [folderEditorOpen, setFolderEditorOpen] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number }>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const marker = markers[pageIndex]
  const files = useMemo(() => data?.items.filter(item => item.kind === 'file') ?? [], [data])
  const selected = useMemo(() => files.filter(item => selectedKeys.has(item.key)), [files, selectedKeys])
  const allCurrentPageSelected = files.length > 0 && files.every(item => selectedKeys.has(item.key))
  const hasCurrentPageSelection = selected.length > 0
  const breadcrumbs = useMemo(() => {
    const values = [{ label: copy.allFiles, path: '' }]
    const segments = path.split('/').filter(Boolean)
    let current = ''
    for (const segment of segments) {
      current += `${segment}/`
      values.push({ label: segment, path: current })
    }
    return values
  }, [copy.allFiles, path])
  const busy = loading || attaching || creatingFolder || uploadProgress !== undefined

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(undefined)
    void listCosAttachmentObjects({ sessionId, path, ...(marker === undefined ? {} : { marker }) }).then((response) => {
      if (!controller.signal.aborted) {
        setData(response)
        setSelectedKeys(new Set())
      }
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(loadError, copy))
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [copy, marker, path, refreshKey, sessionId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const refresh = () => {
    setMarkers([undefined])
    setPageIndex(0)
    setRefreshKey(value => value + 1)
  }
  const navigate = (nextPath: string) => {
    setPath(nextPath)
    setMarkers([undefined])
    setPageIndex(0)
  }
  const enter = (item: CosStorageItem) => {
    if (item.kind === 'folder') navigate(item.path)
  }
  const toggleSelection = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleCurrentPageSelection = () => {
    setSelectedKeys((current) => {
      const next = new Set(current)
      for (const item of files) {
        if (allCurrentPageSelected) next.delete(item.key)
        else next.add(item.key)
      }
      return next
    })
  }
  const attach = async () => {
    if (selected.length === 0 || busy) return
    setAttaching(true)
    setError(undefined)
    try {
      await onPick(selected)
      onClose()
    } catch (attachError) {
      setError(errorMessage(attachError, copy))
    } finally {
      setAttaching(false)
    }
  }
  const createNewFolder = async () => {
    const name = folderName.trim()
    if (name === '' || busy) return
    setCreatingFolder(true)
    setError(undefined)
    try {
      await createFolder({ path, name })
      setFolderName('')
      setFolderEditorOpen(false)
      refresh()
    } catch (createError) {
      setError(errorMessage(createError, copy))
    } finally {
      setCreatingFolder(false)
    }
  }
  const uploadFiles = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0 || busy) return
    setUploadProgress({ completed: 0, total: filesToUpload.length })
    setError(undefined)
    let completed = 0
    try {
      for (const file of filesToUpload) {
        const task = await createUploadTask({ path, name: file.name, size: file.size, contentType: file.type || undefined })
        await uploadTaskContent(task.uploadUrl, file, () => {}).promise
        completed += 1
        setUploadProgress({ completed, total: filesToUpload.length })
      }
      refresh()
    } catch (uploadError) {
      setError(errorMessage(uploadError, copy))
    } finally {
      setUploadProgress(undefined)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="dsh-cos-attachment-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section className="dsh-cos-attachment-picker" role="dialog" aria-modal="true" aria-labelledby="dsh-cos-attachment-title">
        <header>
          <div><h2 id="dsh-cos-attachment-title">{copy.cosPickerTitle}</h2><p>{copy.cosPickerDescription}</p></div>
          <button type="button" aria-label={copy.close} disabled={busy} onClick={onClose}>×</button>
        </header>
        <div className="dsh-cos-attachment-toolbar">
          <nav className="dsh-cos-attachment-breadcrumbs" aria-label={copy.allFiles}>
            {breadcrumbs.map((item, index) => <React.Fragment key={item.path}>
              {index > 0 && <span className="dsh-cos-attachment-breadcrumbs__separator" aria-hidden="true">/</span>}
              <button type="button" className={index === breadcrumbs.length - 1 ? 'is-current' : ''} disabled={busy || index === breadcrumbs.length - 1} onClick={() => navigate(item.path)}>{item.label}</button>
            </React.Fragment>)}
          </nav>
          <div className="dsh-cos-attachment-toolbar__actions">
            <input ref={fileInputRef} className="dsh-cos-attachment-file-input" type="file" multiple onChange={(event) => void uploadFiles(Array.from(event.currentTarget.files ?? []))} />
            <button type="button" disabled={busy} onClick={() => setFolderEditorOpen(true)}>{copy.newFolder}</button>
            <button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>{copy.uploadFiles}</button>
            <button type="button" disabled={busy} onClick={refresh}>{copy.refresh}</button>
          </div>
        </div>
        {folderEditorOpen && <div className="dsh-cos-attachment-folder-create">
          <input autoFocus value={folderName} disabled={busy} placeholder={copy.folderName} onChange={event => setFolderName(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter') void createNewFolder()
            if (event.key === 'Escape') {
              setFolderName('')
              setFolderEditorOpen(false)
            }
          }} />
          <button type="button" disabled={folderName.trim() === '' || busy} onClick={() => void createNewFolder()}>{copy.create}</button>
          <button type="button" disabled={busy} onClick={() => { setFolderName(''); setFolderEditorOpen(false) }}>{copy.cancel}</button>
          {uploadProgress && <span role="status">{copy.uploading(uploadProgress.completed, uploadProgress.total)}</span>}
        </div>}
        {!folderEditorOpen && uploadProgress && <div className="dsh-cos-attachment-upload-progress" role="status">{copy.uploading(uploadProgress.completed, uploadProgress.total)}</div>}
        <div className="dsh-cos-attachment-body">
          {loading && <div className="dsh-cos-attachment-state">{copy.loading}</div>}
          {!loading && error && <div className="dsh-cos-attachment-error" role="alert">{error}</div>}
          {!loading && !error && data?.items.length === 0 && <div className="dsh-cos-attachment-state">{copy.empty}</div>}
          {!loading && !error && data !== undefined && data.items.length > 0 && (
            <div className="dsh-cos-attachment-list" role="table">
              <div className="dsh-cos-attachment-list__header" role="row">
                <button type="button" className="dsh-cos-attachment-list__select-all" aria-label={allCurrentPageSelected ? copy.clearCurrentPageSelection : copy.selectCurrentPage} aria-pressed={allCurrentPageSelected} data-indeterminate={!allCurrentPageSelected && hasCurrentPageSelection} disabled={busy || files.length === 0} onClick={toggleCurrentPageSelection}>{allCurrentPageSelected ? '✓' : hasCurrentPageSelection ? '−' : ''}</button>
                <span aria-hidden="true" /><span>{copy.name}</span><span>{copy.storageClass}</span><span>{copy.size}</span><span>{copy.modified}</span>
              </div>
              {data.items.map(item => {
                const selectable = item.kind === 'file'
                const selectedItem = selectable && selectedKeys.has(item.key)
                return <article key={item.key} className={`dsh-cos-attachment-item${selectedItem ? ' is-selected' : ''}${selectable ? '' : ' is-folder'}`} role="row" onClick={() => {
                  if (selectable) toggleSelection(item.key)
                }}>
                  {selectable ? <button type="button" className="dsh-cos-attachment-item__select" aria-label={copy.select} aria-pressed={selectedItem} disabled={busy} onClick={(event) => { event.stopPropagation(); toggleSelection(item.key) }}>{selectedItem ? '✓' : ''}</button> : <span className="dsh-cos-attachment-item__select is-placeholder" aria-hidden="true" />}
                  <span className="dsh-cos-attachment-item__icon"><StorageIcon item={item} /></span>
                  {item.kind === 'folder' ? <button type="button" className="dsh-cos-attachment-item__name is-folder" disabled={busy} onClick={(event) => { event.stopPropagation(); enter(item) }}>{item.name}</button> : <span className="dsh-cos-attachment-item__name">{item.name}</span>}
                  <span className="dsh-cos-attachment-item__storage">{item.kind === 'file' ? formatStorageClass(item.storageClass) : '—'}</span>
                  <span className="dsh-cos-attachment-item__size">{item.kind === 'file' ? formatBytes(item.size) : '—'}</span>
                  <span className="dsh-cos-attachment-item__modified">{formatDate(item.lastModified)}</span>
                </article>
              })}
            </div>
          )}
        </div>
        <footer>
          <div><button type="button" disabled={pageIndex === 0 || busy} onClick={() => setPageIndex(index => index - 1)}>{copy.previousPage}</button><button type="button" disabled={!data?.nextMarker || busy} onClick={() => { if (data?.nextMarker === undefined) return; setMarkers(current => [...current.slice(0, pageIndex + 1), data.nextMarker]); setPageIndex(index => index + 1) }}>{copy.nextPage}</button></div>
          <div><button type="button" disabled={busy} onClick={onClose}>{copy.cancel}</button><button type="button" className="is-primary" disabled={selected.length === 0 || busy} onClick={() => void attach()}>{attaching ? copy.attaching : copy.attach}</button></div>
        </footer>
      </section>
    </div>
  )
}
