import React, { useEffect, useMemo, useState } from 'react'
import type { CosStorageItem, CosObjectUrlDomain } from '../protocol.ts'
import type { StorageCopy } from './storage-copy.ts'

interface LinkModalProps {
  item: CosStorageItem
  customDomain: string
  copy: StorageCopy
  onCreate: (expiresSeconds: number, domain: CosObjectUrlDomain) => Promise<void>
  onClose: () => void
}

const DURATIONS = [
  { seconds: 300, key: 'linkDuration5Minutes' },
  { seconds: 1800, key: 'linkDuration30Minutes' },
  { seconds: 3600, key: 'linkDuration1Hour' },
  { seconds: 86400, key: 'linkDuration1Day' },
  { seconds: 604800, key: 'linkDuration7Days' },
] as const

export function LinkModal({ item, customDomain, copy, onCreate, onClose }: LinkModalProps): React.JSX.Element {
  const [expiresSeconds, setExpiresSeconds] = useState(3600)
  const [domain, setDomain] = useState<CosObjectUrlDomain>(customDomain !== '' ? 'custom' : 'default')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const hasCustomDomain = customDomain !== ''
  const durationOptions = useMemo(() => DURATIONS.map(option => ({
    seconds: option.seconds,
    label: copy[option.key],
  })), [copy])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      await onCreate(expiresSeconds, domain)
      onClose()
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : copy.linkCreateFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dsh-cos-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section className="dsh-cos-link-dialog" role="dialog" aria-modal="true" aria-labelledby="dsh-cos-link-title">
        <header>
          <div>
            <h2 id="dsh-cos-link-title">{copy.linkTitle}</h2>
            <p title={item.name}>{item.name}</p>
          </div>
          <button type="button" aria-label={copy.close} disabled={busy} onClick={onClose}>×</button>
        </header>
        <div className="dsh-cos-link-dialog__body">
          <label>
            <span>{copy.linkDuration}</span>
            <select value={expiresSeconds} disabled={busy} onChange={event => setExpiresSeconds(Number(event.target.value))}>
              {durationOptions.map(option => <option key={option.seconds} value={option.seconds}>{option.label}</option>)}
            </select>
          </label>
          {hasCustomDomain && (
            <fieldset disabled={busy}>
              <legend>{copy.linkDomain}</legend>
              <label><input type="radio" name="dsh-cos-link-domain" checked={domain === 'default'} onChange={() => setDomain('default')} />{copy.linkDefaultDomain}</label>
              <label><input type="radio" name="dsh-cos-link-domain" checked={domain === 'custom'} onChange={() => setDomain('custom')} />{copy.linkCustomDomain} <small>{customDomain}</small></label>
            </fieldset>
          )}
          {error && <div className="dsh-cos-folder-dialog__error" role="alert">{error}</div>}
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>{copy.cancel}</button>
          <button type="button" className="is-primary" disabled={busy} onClick={() => void submit()}>{busy ? copy.linkCreating : copy.linkConfirm}</button>
        </footer>
      </section>
    </div>
  )
}
