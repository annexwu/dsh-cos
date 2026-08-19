import React, { useEffect, useRef, useState } from 'react'
import type { StorageCopy } from './storage-copy.ts'

interface NewFolderModalProps {
  copy: StorageCopy
  onCreate: (name: string) => Promise<void>
  onClose: () => void
}

export function NewFolderModal({ copy, onCreate, onClose }: NewFolderModalProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (name.trim() === '' || busy) return
    setBusy(true)
    setError(undefined)
    try {
      await onCreate(name)
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '创建失败，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dsh-cos-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <form className="dsh-cos-folder-dialog" role="dialog" aria-modal="true" aria-labelledby="dsh-cos-folder-title" onSubmit={event => void submit(event)}>
        <header>
          <h2 id="dsh-cos-folder-title">{copy.newFolder}</h2>
          <button type="button" aria-label={copy.close} disabled={busy} onClick={onClose}>×</button>
        </header>
        <div className="dsh-cos-folder-dialog__body">
          <label>
            <span>{copy.folderName}</span>
            <input
              ref={inputRef}
              value={name}
              maxLength={255}
              placeholder={copy.folderPlaceholder}
              disabled={busy}
              onChange={(event) => {
                setName(event.target.value)
                setError(undefined)
              }}
            />
          </label>
          {error && <div className="dsh-cos-folder-dialog__error" role="alert">{error}</div>}
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>{copy.cancel}</button>
          <button type="submit" className="is-primary" disabled={busy || name.trim() === ''}>{busy ? copy.creating : copy.create}</button>
        </footer>
      </form>
    </div>
  )
}
