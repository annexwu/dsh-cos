import React, { useEffect, useMemo, useState } from 'react'
import type {
  BrowseLocalUploadResponse,
  CosStorageItem,
  LocalUploadConflictMode,
  StartLocalUploadResponse,
} from '../protocol.ts'
import { browseLocalUpload, CosStorageApiError, listCosAttachmentObjects, startLocalUpload } from './api.ts'
import type { AttachmentCopy } from './attachment-copy.ts'
import { StorageIcon } from './StorageIcon.tsx'
import { formatBytes } from './storage-format.ts'

interface LocalUploadModalProps {
  sessionId: string
  copy: AttachmentCopy
  onStarted: (result: StartLocalUploadResponse) => void
  onClose: () => void
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof CosStorageApiError ? error.message : fallback
}

function parentPath(path: string): string {
  if (path === '') return ''
  const segments = path.slice(0, -1).split('/')
  segments.pop()
  return segments.length === 0 ? '' : `${segments.join('/')}/`
}

export function LocalUploadModal({ sessionId, copy, onStarted, onClose }: LocalUploadModalProps): React.JSX.Element {
  const [local, setLocal] = useState<BrowseLocalUploadResponse>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [destinationPath, setDestinationPath] = useState('')
  const [destinationItems, setDestinationItems] = useState<CosStorageItem[]>()
  const [conflictMode, setConflictMode] = useState<LocalUploadConflictMode>('ask')
  const [loadingLocal, setLoadingLocal] = useState(true)
  const [loadingDestination, setLoadingDestination] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string>()
  const [conflicts, setConflicts] = useState<string[]>([])

  const selectedEntries = useMemo(
    () => local?.entries.filter(entry => selectedIds.has(entry.id)) ?? [],
    [local, selectedIds],
  )
  const selectedFileCount = selectedEntries.filter(entry => entry.kind === 'file').length
  const selectedFolderCount = selectedEntries.filter(entry => entry.kind === 'folder').length

  const loadLocal = async (action: 'current' | 'up' | 'enter' | 'root', options: { name?: string; root?: string } = {}) => {
    setLoadingLocal(true)
    setError(undefined)
    try {
      const response = await browseLocalUpload({
        sessionId,
        ...(local === undefined ? {} : { currentPath: local.currentPath }),
        action,
        ...options,
      })
      setLocal(response)
      setSelectedIds(new Set())
    } catch (loadError) {
      setError(messageOf(loadError, copy.localUploadFailed))
    } finally {
      setLoadingLocal(false)
    }
  }

  const loadDestination = async (path: string) => {
    setLoadingDestination(true)
    setError(undefined)
    try {
      const response = await listCosAttachmentObjects({ sessionId, path })
      setDestinationItems(response.items.filter(item => item.kind === 'folder'))
    } catch (loadError) {
      setError(messageOf(loadError, copy.cosAttachmentFailed))
    } finally {
      setLoadingDestination(false)
    }
  }

  useEffect(() => {
    void loadLocal('current')
    void loadDestination('')
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !starting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, starting])

  const toggle = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const enterLocal = (id: string) => {
    if (local?.entries.find(entry => entry.id === id)?.kind !== 'folder') return
    void loadLocal('enter', { name: id })
  }

  const enterDestination = (item: CosStorageItem) => {
    setDestinationPath(item.path)
    void loadDestination(item.path)
  }

  const start = async (mode = conflictMode) => {
    if (local === undefined || selectedIds.size === 0 || starting) return
    setStarting(true)
    setError(undefined)
    try {
      const response = await startLocalUpload({
        sessionId,
        currentPath: local.currentPath,
        itemIds: Array.from(selectedIds),
        destinationPath,
        conflictMode: mode,
      })
      if (response.conflicts.length > 0 && mode === 'ask') {
        setConflicts(response.conflicts)
        setStarting(false)
        return
      }
      onStarted(response)
      onClose()
    } catch (startError) {
      setError(messageOf(startError, copy.localUploadFailed))
      setStarting(false)
    }
  }

  return (
    <div className="dsh-cos-attachment-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !starting) onClose()
    }}>
      <section className="dsh-cos-local-upload" role="dialog" aria-modal="true" aria-labelledby="dsh-cos-local-upload-title">
        <header>
          <div>
            <h2 id="dsh-cos-local-upload-title">{copy.localUploadTitle}</h2>
            <p>{copy.localUploadDescription}</p>
          </div>
          <button type="button" aria-label={copy.close} disabled={starting} onClick={onClose}>×</button>
        </header>

        <section className="dsh-cos-local-upload__source" aria-labelledby="dsh-cos-local-source-title">
          <div className="dsh-cos-local-upload__section-title">
            <h3 id="dsh-cos-local-source-title">{copy.localUploadSource}</h3>
            <span>{selectedEntries.length === 0 ? copy.localUploadNoneSelected : copy.localUploadSelected(selectedFileCount, selectedFolderCount)}</span>
          </div>
          <div className="dsh-cos-local-upload__toolbar">
            <button type="button" disabled={loadingLocal || starting || local === undefined || local.currentPath === local.roots[0]} onClick={() => void loadLocal('up')}>{copy.back}</button>
            <span title={local?.currentPath}>{local?.currentPath ?? copy.loading}</span>
            <select
              aria-label={copy.localUploadLocation}
              disabled={loadingLocal || starting || local === undefined}
              value=""
              onChange={event => {
                if (event.target.value !== '') void loadLocal('root', { root: event.target.value })
              }}
            >
              <option value="">{copy.localUploadLocation}</option>
              {local?.roots.map(root => <option key={root} value={root}>{root}</option>)}
            </select>
            <button type="button" disabled={loadingLocal || starting} onClick={() => void loadLocal('current')}>{copy.refresh}</button>
          </div>
          <div className="dsh-cos-local-upload__list">
            {loadingLocal && <div className="dsh-cos-attachment-state">{copy.loading}</div>}
            {!loadingLocal && local?.entries.length === 0 && <div className="dsh-cos-attachment-state">{copy.empty}</div>}
            {!loadingLocal && local?.entries.map(entry => {
              const item: CosStorageItem = {
                kind: entry.kind,
                name: entry.name,
                key: entry.id,
                path: entry.id,
                size: entry.size,
                lastModified: entry.modifiedAt,
              }
              return (
                <div key={entry.id} className={`dsh-cos-local-upload__entry${selectedIds.has(entry.id) ? ' is-selected' : ''}`}>
                  <button type="button" className="dsh-cos-local-upload__toggle" aria-pressed={selectedIds.has(entry.id)} onClick={() => toggle(entry.id)}>{selectedIds.has(entry.id) ? '✓' : ''}</button>
                  <button type="button" className="dsh-cos-local-upload__entry-main" onClick={() => toggle(entry.id)} onDoubleClick={() => enterLocal(entry.id)}>
                    <StorageIcon item={item} />
                    <span>{entry.name}</span>
                    <small>{entry.kind === 'folder' ? copy.folder : formatBytes(entry.size)}</small>
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <section className="dsh-cos-local-upload__destination" aria-labelledby="dsh-cos-local-destination-title">
          <div className="dsh-cos-local-upload__section-title">
            <h3 id="dsh-cos-local-destination-title">{copy.localUploadDestination}</h3>
            <span>{destinationPath === '' ? copy.allFiles : destinationPath}</span>
          </div>
          <div className="dsh-cos-local-upload__toolbar">
            <button type="button" disabled={loadingDestination || starting || destinationPath === ''} onClick={() => {
              const next = parentPath(destinationPath)
              setDestinationPath(next)
              void loadDestination(next)
            }}>{copy.back}</button>
            <span>{copy.localUploadDestinationHint}</span>
            <button type="button" disabled={loadingDestination || starting} onClick={() => void loadDestination(destinationPath)}>{copy.refresh}</button>
          </div>
          <div className="dsh-cos-local-upload__destination-list">
            {loadingDestination && <span>{copy.loading}</span>}
            {!loadingDestination && destinationItems?.length === 0 && <span>{copy.localUploadDestinationEmpty}</span>}
            {!loadingDestination && destinationItems?.map(item => (
              <button type="button" key={item.key} onClick={() => enterDestination(item)}>
                <StorageIcon item={item} /><span>{item.name}</span>
              </button>
            ))}
          </div>
        </section>

        {error && <div className="dsh-cos-local-upload__error" role="alert">{error}</div>}
        {conflicts.length > 0 && (
          <div className="dsh-cos-local-upload__conflicts" role="alert">
            <strong>{copy.localUploadConflicts(conflicts.length)}</strong>
            <span title={conflicts.join('\n')}>{conflicts.slice(0, 3).join('、')}{conflicts.length > 3 ? '…' : ''}</span>
            <div>
              <button type="button" disabled={starting} onClick={() => void start('skip')}>{copy.localUploadSkip}</button>
              <button type="button" className="is-primary" disabled={starting} onClick={() => void start('overwrite')}>{copy.localUploadOverwrite}</button>
            </div>
          </div>
        )}
        <footer>
          <label>
            <span>{copy.localUploadConflictMode}</span>
            <select disabled={starting} value={conflictMode} onChange={event => setConflictMode(event.target.value as LocalUploadConflictMode)}>
              <option value="ask">{copy.localUploadAsk}</option>
              <option value="overwrite">{copy.localUploadOverwrite}</option>
              <option value="skip">{copy.localUploadSkip}</option>
            </select>
          </label>
          <div>
            <button type="button" disabled={starting} onClick={onClose}>{copy.cancel}</button>
            <button type="button" className="is-primary" disabled={selectedIds.size === 0 || starting} onClick={() => void start()}>{starting ? copy.localUploadStarting : copy.localUploadStart}</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
