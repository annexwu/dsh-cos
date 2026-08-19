import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { StorageCopy } from './storage-copy.ts'
import type { UploadConflictPolicy } from './upload-coordinator.ts'
import { formatBytes } from './storage-format.ts'
import {
  candidatesFromDrop,
  candidatesFromFiles,
  groupCandidates,
  type UploadCandidate,
} from './upload-selection.ts'

interface UploadModalProps {
  copy: StorageCopy
  onUpload: (candidates: UploadCandidate[], conflictPolicy: UploadConflictPolicy) => void | Promise<void>
  onClose: () => void
}

export function UploadModal({ copy, onUpload, onClose }: UploadModalProps): React.JSX.Element {
  const [candidates, setCandidates] = useState<UploadCandidate[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [conflictPolicy, setConflictPolicy] = useState<UploadConflictPolicy>('overwrite')
  const [error, setError] = useState<string>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const groups = useMemo(() => groupCandidates(candidates), [candidates])
  const totalSize = candidates.reduce((sum, item) => sum + item.file.size, 0)

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '')
    folderInputRef.current?.setAttribute('directory', '')
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const append = (items: UploadCandidate[]) => {
    setCandidates(current => [...current, ...items])
    setError(undefined)
  }

  const submit = async () => {
    if (candidates.length === 0 || busy) {
      if (candidates.length === 0) setError(copy.noSelection)
      return
    }
    setError(undefined)
    onClose()
    void Promise.resolve(onUpload(candidates, conflictPolicy)).catch(() => undefined)
  }

  return (
    <div className="dsh-cos-upload-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section className="dsh-cos-upload-modal" role="dialog" aria-modal="true" aria-labelledby="dsh-cos-upload-title">
        <header>
          <div>
            <h2 id="dsh-cos-upload-title">{copy.uploadTitle}</h2>
            <span>{copy.selectedFiles(candidates.length)} · {formatBytes(totalSize)}</span>
          </div>
          <button type="button" aria-label={copy.close} disabled={busy} onClick={onClose}>×</button>
        </header>

        <div className="dsh-cos-upload-modal__body">
          <input
            ref={fileInputRef}
            className="dsh-cos-storage-file-input"
            type="file"
            multiple
            onChange={(event) => {
              append(candidatesFromFiles(Array.from(event.target.files ?? []), false))
              event.target.value = ''
            }}
          />
          <input
            ref={folderInputRef}
            className="dsh-cos-storage-file-input"
            type="file"
            multiple
            onChange={(event) => {
              append(candidatesFromFiles(Array.from(event.target.files ?? []), true))
              event.target.value = ''
            }}
          />

          <div className="dsh-cos-upload-modal__buttons">
            <button type="button" className="is-primary" disabled={busy} onClick={() => fileInputRef.current?.click()}>{copy.selectFiles}</button>
            <button type="button" disabled={busy} onClick={() => folderInputRef.current?.click()}>{copy.selectFolder}</button>
          </div>

          <div
            className={`dsh-cos-upload-dropzone${dragging ? ' is-dragging' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
              setDragging(true)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              void candidatesFromDrop(event.dataTransfer).then(append).catch((dropError: unknown) => {
                setError(dropError instanceof Error ? dropError.message : '无法读取拖拽内容。')
              })
            }}
          >
            {groups.length === 0 ? (
              <div className="dsh-cos-upload-dropzone__empty">
                <span aria-hidden="true">＋</span>
                <strong>{copy.dragTitle}</strong>
                <p>{copy.dragDescription}</p>
              </div>
            ) : (
              <div className="dsh-cos-upload-selection">
                <div className="dsh-cos-upload-selection__head">
                  <span>{copy.selectedObjects}</span>
                  <span>{copy.size}</span>
                  <span>{copy.removeSelection}</span>
                </div>
                {groups.map(group => (
                  <div key={group.id} className="dsh-cos-upload-selection__row">
                    <div>
                      <span className="dsh-cos-upload-selection__icon" aria-hidden="true">{group.files > 1 ? '▰' : '▱'}</span>
                      <span title={group.name}>{group.name}</span>
                      {group.files > 1 && <small>{copy.selectedFiles(group.files)}</small>}
                    </div>
                    <span>{formatBytes(group.size)}</span>
                    <button type="button" disabled={busy} aria-label={`${copy.removeSelection} ${group.name}`} onClick={() => {
                      setCandidates(current => current.filter(item => item.groupId !== group.id))
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && <div className="dsh-cos-upload-modal__error" role="alert">{error}</div>}
        </div>

        <footer>
          <label className="dsh-cos-upload-conflict-select">
            <span>{copy.conflictPolicy}</span>
            <select value={conflictPolicy} disabled={busy} onChange={event => setConflictPolicy(event.target.value as UploadConflictPolicy)}>
              <option value="overwrite">{copy.conflictOverwrite}</option>
              <option value="skip">{copy.conflictSkip}</option>
              <option value="rename">{copy.conflictRename}</option>
            </select>
          </label>
          <div className="dsh-cos-upload-modal__footer-actions">
            <button type="button" disabled={busy} onClick={onClose}>{copy.cancel}</button>
            <button type="button" className="is-primary" disabled={busy || candidates.length === 0} onClick={() => void submit()}>{copy.startUpload}</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
